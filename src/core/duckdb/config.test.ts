import { buildDuckDbStartupCommands } from './config'

describe('buildDuckDbStartupCommands', () => {
  const baseOptions = {
    extensionPaths: [],
    allowedDirectories: ['C:/Users/dev/AppData/Roaming/crivo/attachments'],
    memoryLimit: '2GB',
    tempDirectory: 'C:/Users/dev/AppData/Roaming/crivo/duckdb-tmp'
  }

  it('locks the configuration last, regardless of extension list', () => {
    const commands = buildDuckDbStartupCommands(baseOptions)

    expect(commands.at(-1)).toBe('SET lock_configuration = true;')
  })

  it('loads extensions before any SET, in the given order', () => {
    const commands = buildDuckDbStartupCommands({
      ...baseOptions,
      extensionPaths: ['C:/ext/excel.duckdb_extension', 'C:/ext/other.duckdb_extension']
    })

    expect(commands.slice(0, 2)).toEqual([
      "LOAD 'C:/ext/excel.duckdb_extension';",
      "LOAD 'C:/ext/other.duckdb_extension';"
    ])
    expect(commands[2]).toBe(
      "SET allowed_directories = ['C:/Users/dev/AppData/Roaming/crivo/attachments'];"
    )
  })

  it('produces no LOAD statement when the extension list is empty (18-A default)', () => {
    const commands = buildDuckDbStartupCommands(baseOptions)

    expect(commands.some((c) => c.startsWith('LOAD'))).toBe(false)
  })

  // DuckDB rejects `SET allowed_directories` and `SET temp_directory` once
  // enable_external_access is already false ("Cannot change allowed_
  // directories when enable_external_access is disabled"; "Modifying the
  // temp_directory has been disabled by configuration") — live-verified,
  // corrects D18A.3's original order.
  it('sets the directory allow-list and temp_directory before disabling external access', () => {
    const commands = buildDuckDbStartupCommands(baseOptions)

    expect(commands).toEqual([
      "SET allowed_directories = ['C:/Users/dev/AppData/Roaming/crivo/attachments'];",
      "SET temp_directory = 'C:/Users/dev/AppData/Roaming/crivo/duckdb-tmp';",
      'SET enable_external_access = false;',
      'SET autoinstall_known_extensions = false;',
      'SET autoload_known_extensions = false;',
      "SET memory_limit = '2GB';",
      'SET lock_configuration = true;'
    ])
  })

  it('normalizes Windows backslashes to forward slashes in every path', () => {
    const commands = buildDuckDbStartupCommands({
      extensionPaths: ['C:\\ext\\excel.duckdb_extension'],
      allowedDirectories: ['C:\\Users\\dev\\AppData\\Roaming\\crivo\\attachments'],
      memoryLimit: '2GB',
      tempDirectory: 'C:\\Users\\dev\\AppData\\Roaming\\crivo\\duckdb-tmp'
    })

    expect(commands).toEqual([
      "LOAD 'C:/ext/excel.duckdb_extension';",
      "SET allowed_directories = ['C:/Users/dev/AppData/Roaming/crivo/attachments'];",
      "SET temp_directory = 'C:/Users/dev/AppData/Roaming/crivo/duckdb-tmp';",
      'SET enable_external_access = false;',
      'SET autoinstall_known_extensions = false;',
      'SET autoload_known_extensions = false;',
      "SET memory_limit = '2GB';",
      'SET lock_configuration = true;'
    ])
  })
})
