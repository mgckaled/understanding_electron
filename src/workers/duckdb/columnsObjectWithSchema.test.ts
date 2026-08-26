import { DuckDBInstance } from '@duckdb/node-api'
import { columnsObjectWithSchema } from './columnsObjectWithSchema'

// Real engine, never a fake reader (skill testing/data) — the bug this exists
// to catch only shows up against the actual binding's zero-row behaviour.
describe('columnsObjectWithSchema', () => {
  it('keeps every column, as an empty array, when the query returns zero rows', async () => {
    const instance = await DuckDBInstance.create(':memory:')
    const connection = await instance.connect()
    await connection.run('CREATE TABLE t (id INTEGER, nome VARCHAR)')

    const reader = await connection.runAndReadAll('SELECT * FROM t WHERE 1 = 0')

    expect(columnsObjectWithSchema(reader)).toEqual({ id: [], nome: [] })
  })

  it('matches getColumnsObject() when rows come back', async () => {
    const instance = await DuckDBInstance.create(':memory:')
    const connection = await instance.connect()
    await connection.run('CREATE TABLE t (id INTEGER, nome VARCHAR)')
    await connection.run("INSERT INTO t VALUES (1, 'Ana'), (2, 'Bruno')")

    const reader = await connection.runAndReadAll('SELECT * FROM t ORDER BY id')

    expect(columnsObjectWithSchema(reader)).toEqual({ id: [1, 2], nome: ['Ana', 'Bruno'] })
  })
})
