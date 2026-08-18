import { utilityProcess, type UtilityProcess } from 'electron'
import { join } from 'node:path'

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
 * Round-trips a message through the configured worker and logs every reply —
 * live proof that the restricted config actually holds (D18A.3) and that main
 * and the DuckDB utilityProcess talk across the process boundary (D18A.5).
 * Passo 5 replaces the echo with a real query; nothing here is meant to
 * survive into 18-B.
 */
export function probeDuckdbWorker(userDataPath: string): void {
  const worker = spawnDuckdbWorker(userDataPath)
  worker.on('message', (data) => {
    console.log('[duckdb worker]', data)
  })
  worker.postMessage('duckdb worker handshake')
}
