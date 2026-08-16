import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureAttachment, storedHashes, sweepUnreferenced } from './storage'

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'crivo-attachments-'))
}

describe('ensureAttachment', () => {
  it('copies the source file to dir/hash', async () => {
    const source = tempDir()
    const sourcePath = join(source, 'vendas.csv')
    writeFileSync(sourcePath, 'id,valor\n1,10\n')
    const dir = join(tempDir(), 'attachments')

    await ensureAttachment(dir, 'abc123', sourcePath)

    expect(readFileSync(join(dir, 'abc123'), 'utf8')).toBe('id,valor\n1,10\n')
    rmSync(source, { recursive: true, force: true })
    rmSync(dir, { recursive: true, force: true })
  })

  it('does not touch the source again when the hash already exists', async () => {
    const source = tempDir()
    const sourcePath = join(source, 'vendas.csv')
    writeFileSync(sourcePath, 'first write')
    const dir = join(tempDir(), 'attachments')
    await ensureAttachment(dir, 'abc123', sourcePath)

    // A second source with the SAME hash but different bytes must not
    // overwrite the stored copy — dedup means "already have it", not "merge".
    writeFileSync(sourcePath, 'second write, never read')
    await ensureAttachment(dir, 'abc123', sourcePath)

    expect(readFileSync(join(dir, 'abc123'), 'utf8')).toBe('first write')
    rmSync(source, { recursive: true, force: true })
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('storedHashes', () => {
  it('returns an empty list for a directory that does not exist yet', async () => {
    const dir = join(tempDir(), 'never-created')
    expect(await storedHashes(dir)).toEqual([])
  })

  it('lists every file under dir', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'h1'), 'a')
    writeFileSync(join(dir, 'h2'), 'b')

    expect(await storedHashes(dir)).toEqual(expect.arrayContaining(['h1', 'h2']))
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('sweepUnreferenced', () => {
  it('deletes a hash the referenced set does not contain', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'kept'), 'a')
    writeFileSync(join(dir, 'orphan'), 'b')

    await sweepUnreferenced(dir, new Set(['kept']))

    expect(existsSync(join(dir, 'kept'))).toBe(true)
    expect(existsSync(join(dir, 'orphan'))).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  it('is a no-op on a directory that was never created', async () => {
    const dir = join(tempDir(), 'never-created')
    await expect(sweepUnreferenced(dir, new Set())).resolves.toBeUndefined()
  })
})
