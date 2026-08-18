import { join } from 'node:path'
import duckdb, { DuckDBInstance } from '@duckdb/node-api'
import { buildDuckDbStartupCommands, DUCKDB_MEMORY_LIMIT } from '@core/duckdb/config'

const userDataPath = process.argv[2]
const attachmentsDir = join(userDataPath, 'attachments')
const tempDir = join(userDataPath, 'duckdb-tmp')

async function checkLive(label: string, run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return `[${label}] UNEXPECTED OK`
  } catch (err) {
    return `[${label}] rejected as expected -> ${(err as Error).message.split('\n')[0]}`
  }
}

async function main(): Promise<void> {
  const instance = await DuckDBInstance.create(':memory:')
  const connection = await instance.connect()

  for (const sql of buildDuckDbStartupCommands({
    extensionPaths: [],
    allowedDirectories: [attachmentsDir, tempDir],
    memoryLimit: DUCKDB_MEMORY_LIMIT,
    tempDirectory: tempDir
  })) {
    await connection.run(sql)
  }

  // Passo 4 acceptance (D18A.3): the trap must prove itself live, not just the
  // command order — a mistyped setting can pass silently otherwise.
  const outsideRead = await checkLive('read outside allowed_directories', () =>
    connection.run("SELECT * FROM read_csv('C:/Windows/win.ini')")
  )
  const postLockSet = await checkLive('SET after lock_configuration', () =>
    connection.run("SET memory_limit = '8GB'")
  )

  process.parentPort.postMessage(
    `duckdb ${duckdb.version()} configured\n${outsideRead}\n${postLockSet}`
  )

  // Passo 5: a real query through the configured connection — duckdb.version()
  // never touches the instance or the restricted config, so it cannot stand
  // in for this proof (D18A.3 Passo 5 acceptance).
  process.parentPort.on('message', async (e) => {
    const reader = await connection.runAndReadAll(String(e.data))
    process.parentPort.postMessage(JSON.stringify(reader.getRowObjects()))
  })
}

void main()
