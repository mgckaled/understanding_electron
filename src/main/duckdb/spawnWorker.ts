import { utilityProcess, type UtilityProcess } from 'electron'
import { join } from 'node:path'
import type { WorkerQueryResponse } from '@core/duckdb/protocol'

/**
 * Forks the DuckDB worker built next to main/index.js (D18A.1). `userDataPath`
 * travels as a fork argument, not an imported module — the worker never
 * imports `electron` (D18A.2), so it cannot resolve `app.getPath` itself.
 */
export function spawnDuckdbWorker(userDataPath: string): UtilityProcess {
  const worker = utilityProcess.fork(join(__dirname, 'duckdbWorker.js'), [userDataPath], {
    stdio: 'pipe'
  })
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
 * Builds the `runQuery` closure `queryDataset` calls, bound to one worker
 * kept alive for the app's whole life (D18B.3-bis — one connection, spawned
 * once). Calls are serialized on a tail promise: the protocol carries no
 * correlation id (resolves on the *next* `'message'`), so two queries in
 * flight — two expanded `DatasetCard`s firing at once — would otherwise
 * race for each other's reply.
 */
export function createDuckdbRunQuery(
  worker: UtilityProcess
): (hash: string, sql: string) => Promise<Uint8Array> {
  let tail = Promise.resolve()

  function runOne(hash: string, sql: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      function onMessage(message: WorkerQueryResponse): void {
        cleanup()
        if (message.ok) resolve(message.bytes)
        else reject(new Error(message.message))
      }
      // memory_limit is 2GB (D18A.4) and passo 5 deliberately runs an
      // uncapped ~100k-row query — worker death is a real path, and without
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
      worker.postMessage({ hash, sql })
    })
  }

  return (hash, sql) => {
    const settled = tail.then(() => runOne(hash, sql))
    // Swallow so one query's rejection doesn't poison the tail for the next.
    tail = settled.then(
      () => undefined,
      () => undefined
    )
    return settled
  }
}
