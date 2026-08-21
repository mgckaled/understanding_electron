// Disposable proof script (18-F passo 1, D18F.1) — not part of the product.
// Confirms which branch of the advisor's finding is real: does the vendored
// `excel.duckdb_extension` LOAD under the app's *default* instance config
// (no `allow_unsigned_extensions`), through the real startup sequence in
// core/duckdb/config.ts? If this fails with a signature error, the fix
// belongs to `DuckDBInstance.create`'s options (passo 2), not to config.ts.
//
// Run: node scripts/prove-excel-extension-load.mjs
import { DuckDBInstance } from '@duckdb/node-api'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDuckDbStartupCommands } from '../src/core/duckdb/config.ts'

const EXTENSION_PATH = join(
  import.meta.dirname,
  '..',
  'resources',
  'duckdb-extensions',
  'excel.duckdb_extension'
)

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), 'crivo-excel-proof-'))

  // DEFAULT config — no allow_unsigned_extensions, no options object at all —
  // the same call shape workers/duckdb/index.ts uses today.
  const instance = await DuckDBInstance.create(':memory:')
  const connection = await instance.connect()

  const commands = buildDuckDbStartupCommands({
    extensionPaths: [EXTENSION_PATH],
    allowedDirectories: [tempDir],
    memoryLimit: '2GB',
    tempDirectory: tempDir
  })

  console.log('Startup commands:')
  for (const sql of commands) console.log('  ' + sql)

  for (const sql of commands) {
    await connection.run(sql)
  }
  console.log('\nAll startup commands ran — including LOAD — under DEFAULT instance config.')
  console.log('lock_configuration is now true. Querying read_xlsx AFTER the lock...\n')

  // No real .xlsx yet (that is passo 5) — the point here is only that the
  // function exists and the engine accepts the call post-lock, proving the
  // extension is genuinely loaded, not just that LOAD didn't throw.
  const reader = await connection.runAndReadAll(
    "SELECT function_name FROM duckdb_functions() WHERE function_name = 'read_xlsx'"
  )
  const rows = reader.getRowObjectsJS()
  if (rows.length === 0) {
    throw new Error('read_xlsx is not registered after LOAD — extension did not actually load')
  }
  console.log('read_xlsx is registered:', rows)
  console.log(
    '\nPROOF PASSED: excel.duckdb_extension loads under default (signed-extension) config.'
  )
}

main().catch((error) => {
  console.error('\nPROOF FAILED:', error.message)
  console.error(
    'If this is a signature error, the fix belongs to DuckDBInstance.create options (passo 2), not core/duckdb/config.ts.'
  )
  process.exitCode = 1
})
