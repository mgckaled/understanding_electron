import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readHashedFile, sniffFileFormat } from './lines'

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

describe('sniffFileFormat', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'crivo-lines-sniff-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reads json for a JSON file, without reading past the sample window', async () => {
    const path = join(dir, 'sample.json')
    await writeFile(path, '[{"id": 1}, {"id": 2}]', 'utf-8')

    await expect(sniffFileFormat(path)).resolves.toBe('json')
  })

  it('reads delimited for a CSV file', async () => {
    const path = join(dir, 'sample.csv')
    await writeFile(path, 'id,nome\n1,Ana\n', 'utf-8')

    await expect(sniffFileFormat(path)).resolves.toBe('delimited')
  })
})
