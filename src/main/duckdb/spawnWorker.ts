import { utilityProcess, type UtilityProcess } from 'electron'
import { join } from 'node:path'
import type { ColumnProfile } from '@core/duckdb/profile'
import type { WorkerRequest, WorkerResponse } from '@core/duckdb/protocol'

/**
 * Forks the DuckDB worker built next to main/index.js (D18A.1). `userDataPath`
 * and `extensionPath` travel as fork arguments, not imported modules — the
 * worker never imports `electron` (D18A.2), so it cannot resolve
 * `app.getPath`/`process.resourcesPath` itself (D18F.2).
 */
export function spawnDuckdbWorker(userDataPath: string, extensionPath: string): UtilityProcess {
  const worker = utilityProcess.fork(
    join(__dirname, 'duckdbWorker.js'),
    [userDataPath, extensionPath],
    // serviceName fills `name` in app.getAppMetrics (and in child-process-gone);
    // without it every utility process reports as `Node Utility Process`, and
    // the observatory could not tell this one apart (O-1, passo 4).
    { stdio: 'pipe', serviceName: 'DuckDB' }
  )
  // 'inherit' (the default) did not surface worker output through electron-vite's
  // spawn chain on Windows — piping and forwarding explicitly is the reliable path.
  worker.stdout?.on('data', (chunk: Buffer) =>
    process.stdout.write(`[duckdb worker stdout] ${chunk}`)
  )
  worker.stderr?.on('data', (chunk: Buffer) =>
    process.stderr.write(`[duckdb worker stderr] ${chunk}`)
  )
  return worker
}

/**
 * Serializes every request to `worker` on a single tail promise, regardless
 * of `kind` — the protocol carries no correlation id (resolves on the
 * *next* `'message'`), so a query and a profile request in flight at once
 * would otherwise race for each other's reply (D18D.1).
 */
function createEnqueue(worker: UtilityProcess): {
  enqueue: (request: WorkerRequest) => Promise<WorkerResponse>
  queueDepth: () => number
} {
  let tail = Promise.resolve()
  let depth = 0

  function sendOne(request: WorkerRequest): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      function onMessage(message: WorkerResponse): void {
        cleanup()
        resolve(message)
      }
      // memory_limit is 2GB (D18A.4) and passo 6 deliberately runs an
      // uncapped profile query — worker death is a real path, and without
      // this the UI would spin forever with no error.
      function onExit(code: number): void {
        cleanup()
        reject(new Error(`DuckDB worker exited (code ${code}) before replying`))
      }
      function cleanup(): void {
        worker.off('message', onMessage)
        worker.off('exit', onExit)
      }
      worker.on('message', onMessage)
      worker.once('exit', onExit)
      worker.postMessage(request)
    })
  }

  return {
    enqueue(request) {
      depth++
      const settled = tail.then(() => sendOne(request))
      // Decrements on the same chain that already swallows the rejection
      // (O-2) — a separate settled.finally() would leave an unhandled
      // rejection on worker death, the exact path this counter watches for.
      tail = settled.then(
        () => {
          depth--
        },
        () => {
          depth--
        }
      )
      return settled
    },
    queueDepth: () => depth
  }
}

/**
 * Builds the three closures `queryDataset`/`profileDataset`/`attachDataset`
 * (JSON path) call, bound to one worker kept alive for the app's whole life
 * (D18B.3-bis — one connection, spawned once). All three share one
 * `createEnqueue` queue (D18D.1, generalized D18E.3): a new request kind
 * must go through the same serialization as the others, not around it.
 */
export function createDuckdbWorkerClient(worker: UtilityProcess): {
  runQuery: (hash: string, sql: string) => Promise<Uint8Array>
  runProfile: (hash: string, includeTopValues?: boolean) => Promise<ColumnProfile[]>
  runSchema: (hash: string) => Promise<{ columns: string[]; rowCount: number }>
  runTransform: (
    hash: string,
    sql: string
  ) => Promise<{ bytes: Uint8Array; before: ColumnProfile[]; after: ColumnProfile[] }>
  queueDepth: () => number
} {
  const { enqueue, queueDepth } = createEnqueue(worker)

  return {
    async runQuery(hash, sql) {
      const response = await enqueue({ kind: 'query', hash, sql })
      if (response.kind !== 'query') {
        throw new Error(`DuckDB worker replied with kind "${response.kind}", expected "query"`)
      }
      if (!response.ok) throw new Error(response.message)
      return response.bytes
    },
    async runProfile(hash, includeTopValues) {
      const response = await enqueue({ kind: 'profile', hash, includeTopValues })
      if (response.kind !== 'profile') {
        throw new Error(`DuckDB worker replied with kind "${response.kind}", expected "profile"`)
      }
      if (!response.ok) throw new Error(response.message)
      return response.profile
    },
    async runSchema(hash) {
      const response = await enqueue({ kind: 'schema', hash })
      if (response.kind !== 'schema') {
        throw new Error(`DuckDB worker replied with kind "${response.kind}", expected "schema"`)
      }
      if (!response.ok) throw new Error(response.message)
      return { columns: response.columns, rowCount: response.rowCount }
    },
    async runTransform(hash, sql) {
      const response = await enqueue({ kind: 'transform', hash, sql })
      if (response.kind !== 'transform') {
        throw new Error(`DuckDB worker replied with kind "${response.kind}", expected "transform"`)
      }
      if (!response.ok) throw new Error(response.message)
      return { bytes: response.bytes, before: response.before, after: response.after }
    },
    queueDepth
  }
}
