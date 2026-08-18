/** Fixed for 18-A (D18A.4) — remeasured live, not copied from ESCOPO.md. */
export const DUCKDB_MEMORY_LIMIT = '2GB'

export interface DuckDbStartupOptions {
  /** Extension files to `LOAD` by explicit path — empty until 18-F (D18A.3). */
  extensionPaths: string[]
  allowedDirectories: string[]
  memoryLimit: string
  tempDirectory: string
}

function sqlPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/'/g, "''")
}

function sqlStringList(paths: string[]): string {
  return `[${paths.map((path) => `'${sqlPath(path)}'`).join(', ')}]`
}

/**
 * Builds the DuckDB startup sequence: extensions load before the engine locks
 * down, and `lock_configuration` always runs last — so the 18-F extension
 * load never has to reopen this ordering.
 *
 * `allowed_directories` and `temp_directory` must both be set *before*
 * `enable_external_access = false` — DuckDB rejects changing either one once
 * external access is already disabled ("Cannot change allowed_directories
 * when enable_external_access is disabled"; "Modifying the temp_directory has
 * been disabled by configuration"). Two live-verified corrections to the
 * order D18A.3 first proposed; `memory_limit` has no such constraint.
 *
 * @param options - Paths and limits already resolved by the caller; this
 *   function stays pure and never touches `electron` or the file system.
 * @returns SQL statements to run, in the order they must run.
 */
export function buildDuckDbStartupCommands(options: DuckDbStartupOptions): string[] {
  const { extensionPaths, allowedDirectories, memoryLimit, tempDirectory } = options
  return [
    ...extensionPaths.map((path) => `LOAD '${sqlPath(path)}';`),
    `SET allowed_directories = ${sqlStringList(allowedDirectories)};`,
    `SET temp_directory = '${sqlPath(tempDirectory)}';`,
    `SET enable_external_access = false;`,
    `SET autoinstall_known_extensions = false;`,
    `SET autoload_known_extensions = false;`,
    `SET memory_limit = '${memoryLimit}';`,
    `SET lock_configuration = true;`
  ]
}
