import duckdb from '@duckdb/node-api'

process.parentPort.on('message', (e) => {
  process.parentPort.postMessage(`${e.data} (duckdb ${duckdb.version()})`)
})
