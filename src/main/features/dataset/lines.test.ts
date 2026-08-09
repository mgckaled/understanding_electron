import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLines } from './lines'

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const lines: string[] = []
  for await (const line of iterable) lines.push(line)
  return lines
}

describe('readLines', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'crivo-lines-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('yields each line of an existing file', async () => {
    const path = join(dir, 'sample.csv')
    await writeFile(path, 'id,name\n1,Ana\n2,Bruno\n', 'utf-8')

    const lines = await collect(readLines(path))

    expect(lines).toEqual(['id,name', '1,Ana', '2,Bruno'])
  })

  it('rejects with ENOENT for a path that does not exist', async () => {
    const path = join(dir, 'missing.csv')

    await expect(collect(readLines(path))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects with EISDIR when the path is a directory', async () => {
    await expect(collect(readLines(dir))).rejects.toMatchObject({ code: 'EISDIR' })
  })
})
