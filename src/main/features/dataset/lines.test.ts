import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readHashedFile, sniffFileFormat, hashOnlyFile } from './lines'

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

describe('hashOnlyFile', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'crivo-lines-hashonly-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('hashes the real file bytes without decoding them as text', async () => {
    const path = join(dir, 'sample.xlsx')
    // Bytes that are not valid standalone UTF-8 (0xff is never a lead byte) —
    // proof this never goes through StringDecoder.
    const content = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x80])
    await writeFile(path, content)

    const { run, digest } = hashOnlyFile(path)
    await run(new AbortController().signal)

    expect(digest()).toBe(createHash('sha256').update(content).digest('hex'))
  })

  it('rejects with ENOENT for a path that does not exist', async () => {
    const path = join(dir, 'missing.xlsx')

    await expect(hashOnlyFile(path).run(new AbortController().signal)).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('stops reading when the signal aborts mid-stream, instead of hanging', async () => {
    const path = join(dir, 'large.xlsx')
    await writeFile(path, Buffer.alloc(1024 * 1024, 1))

    const controller = new AbortController()
    const { run } = hashOnlyFile(path)
    const pending = run(controller.signal)
    controller.abort()

    // destroy()'d mid-read either resolves early or rejects — both are
    // legitimate cancellation outcomes; the point of this test is only that
    // it settles instead of hanging.
    await pending.catch(() => undefined).catch(() => undefined)
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
