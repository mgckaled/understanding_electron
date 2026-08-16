import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readHashedFile } from './lines'

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const lines: string[] = []
  for await (const line of iterable) lines.push(line)
  return lines
}

describe('readHashedFile', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'crivo-lines-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('yields each line and hashes the real file bytes', async () => {
    const path = join(dir, 'sample.csv')
    const content = 'id,endereço\n1,início\n2,Bruno\n'
    await writeFile(path, content, 'utf-8')

    const { lines, digest } = readHashedFile(path)
    const collected = await collect(lines)

    expect(collected).toEqual(['id,endereço', '1,início', '2,Bruno'])
    expect(digest()).toBe(createHash('sha256').update(Buffer.from(content, 'utf-8')).digest('hex'))
  })

  it('rejects with ENOENT for a path that does not exist', async () => {
    const path = join(dir, 'missing.csv')

    await expect(collect(readHashedFile(path).lines)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects with EISDIR when the path is a directory', async () => {
    await expect(collect(readHashedFile(dir).lines)).rejects.toMatchObject({ code: 'EISDIR' })
  })
})
