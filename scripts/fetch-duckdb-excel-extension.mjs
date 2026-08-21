// Disposable, one-time developer script (18-F, D18F.1) — not part of the
// product, never imported from src/. Downloads the `excel` core extension
// binary for the exact @duckdb/node-api version this project has pinned, so
// the app can `LOAD` it by local path with `enable_external_access = false`
// (D18A.3) instead of reaching the network at runtime.
//
// Run once per @duckdb/node-api version bump:
//   node scripts/fetch-duckdb-excel-extension.mjs
import { DuckDBInstance } from '@duckdb/node-api'
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEST_DIR = join(import.meta.dirname, '..', 'resources', 'duckdb-extensions')
const DEST_FILE = join(DEST_DIR, 'excel.duckdb_extension')

async function findNewestExtensionFile(startDir) {
  let newest = null
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.name === 'excel.duckdb_extension') {
        const info = await stat(full)
        if (!newest || info.mtimeMs > newest.mtimeMs) newest = { path: full, mtimeMs: info.mtimeMs }
      }
    }
  }
  await walk(startDir)
  return newest?.path ?? null
}

async function main() {
  // No restricted config on purpose — this instance's only job is to let
  // DuckDB's own INSTALL reach the network and cache the binary, the normal
  // (non-D18A.3) path.
  const instance = await DuckDBInstance.create(':memory:')
  const connection = await instance.connect()

  console.log('Running INSTALL excel; LOAD excel; against an unrestricted :memory: instance...')
  await connection.run('INSTALL excel;')
  await connection.run('LOAD excel;')
  console.log('excel extension installed and loaded.')

  const versionReader = await connection.runAndReadAll(
    "SELECT * FROM duckdb_extensions() WHERE extension_name = 'excel'"
  )
  console.log('duckdb_extensions() row:', versionReader.getRowObjectsJS())

  // DuckDB's own extension cache — ~/.duckdb/extensions/<duckdb-version>/<platform>/
  const cacheRoot = join(homedir(), '.duckdb', 'extensions')
  const found = await findNewestExtensionFile(cacheRoot)
  if (!found) {
    throw new Error(`Could not find excel.duckdb_extension under ${cacheRoot} after LOAD`)
  }
  console.log('Found cached extension at:', found)

  await mkdir(DEST_DIR, { recursive: true })
  await copyFile(found, DEST_FILE)
  const size = (await stat(DEST_FILE)).size
  console.log(`Copied to ${DEST_FILE} (${size} bytes, ${(size / 1024).toFixed(1)} KB)`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
