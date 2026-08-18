import { utilityProcess, type UtilityProcess } from 'electron'
import { join } from 'node:path'

/** Forks the DuckDB worker built next to main/index.js (D18A.1). */
export function spawnDuckdbWorker(): UtilityProcess {
  return utilityProcess.fork(join(__dirname, 'duckdbWorker.js'))
}

/**
 * Round-trips a message through the worker and logs the reply — live proof
 * that main and the DuckDB utilityProcess talk across the process boundary
 * (D18A.5). Passo 5 replaces the echo with a real query; nothing here is
 * meant to survive into 18-B.
 */
export function probeDuckdbWorker(): void {
  const worker = spawnDuckdbWorker()
  worker.on('message', (data) => {
    console.log('[duckdb worker]', data)
  })
  worker.postMessage('duckdb worker handshake')
}
