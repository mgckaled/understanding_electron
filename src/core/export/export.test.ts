import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exportFileName } from './fileName'
import { toPlainText } from './toPlainText'
import { writeAtomic } from './write'

describe('exportFileName', () => {
  it('keeps a title that is already a valid name', () => {
    expect(exportFileName('Vendas do trimestre', 'md')).toBe('Vendas do trimestre.md')
  })

  it.each([
    ['Receita: 2026/2027', 'Receita 2026 2027.md'],
    ['Antes <> depois', 'Antes depois.md'],
    ['Caminho C:\\dados', 'Caminho C dados.md'],
    ['Quanto? *tudo*', 'Quanto tudo.md']
  ])('replaces what Windows rejects in %s', (title, expected) => {
    expect(exportFileName(title, 'md')).toBe(expected)
  })

  it('drops control characters', () => {
    expect(exportFileName('Vendas\u0007do\u001fano', 'md')).toBe('Vendas do ano.md')
  })

  it.each(['CON', 'nul', 'Com1', 'LPT9'])('steps around the reserved name %s', (title) => {
    expect(exportFileName(title, 'txt')).toBe(`${title}_.txt`)
  })

  it('never ends the name in a dot or a space', () => {
    expect(exportFileName('Resumo final... ', 'md')).toBe('Resumo final.md')
  })

  it('cuts a long title without leaving a trailing space', () => {
    const name = exportFileName(`${'a'.repeat(79)} bbbb`, 'md')

    expect(name).toBe(`${'a'.repeat(79)}.md`)
  })

  it.each([
    ['', 'empty'],
    ['   ', 'blank'],
    [':::', 'forbidden only']
  ])('falls back on %s input (%s)', (title) => {
    expect(exportFileName(title, 'txt')).toBe('rascunho.txt')
  })
})

describe('toPlainText', () => {
  it('removes the marks and keeps the paragraphs apart', () => {
    const out = toPlainText('# Vendas\n\nSubiram **12%** no trimestre.\n\nO resto caiu.')

    expect(out).not.toContain('#')
    expect(out).not.toContain('**')
    expect(out).toContain('Vendas')
    // The reason strip-markdown was chosen over mdast-util-to-string (DE1D.6).
    expect(out).toMatch(/Subiram 12% no trimestre\.\s*\n\s*\nO resto caiu\./)
  })

  it('flattens a list into lines of text', () => {
    const out = toPlainText('- primeiro\n- segundo')

    expect(out).toContain('primeiro')
    expect(out).toContain('segundo')
    expect(out).not.toContain('- ')
  })

  it('keeps the text of a link and drops its target', () => {
    const out = toPlainText('Veja o [relatório](https://exemplo.com/a.pdf).')

    expect(out).toContain('relatório')
    expect(out).not.toContain('https://')
  })
})

describe('writeAtomic', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'crivo-export-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const target = (): string => join(dir, 'saida.md')

  it('writes the file and leaves no temporary behind', async () => {
    const result = await writeAtomic(target(), '# Vendas')

    expect(result.ok).toBe(true)
    expect(await readFile(target(), 'utf-8')).toBe('# Vendas')
    expect(await readdir(dir)).toEqual(['saida.md'])
  })

  it('replaces a file that was already there', async () => {
    await writeFile(target(), 'antigo')

    await writeAtomic(target(), 'novo')

    expect(await readFile(target(), 'utf-8')).toBe('novo')
  })

  // DE1D.2: a passing lock (Defender, the search indexer) is the case the
  // retry exists for, and it is not reproducible without injecting the rename.
  it('retries a locked rename and succeeds', async () => {
    let attempts = 0
    const rename = vi.fn(async (from: string, to: string) => {
      attempts += 1
      if (attempts < 3) throw Object.assign(new Error('locked'), { code: 'EPERM' })
      const { rename: real } = await import('node:fs/promises')
      await real(from, to)
    })

    const result = await writeAtomic(target(), 'novo', { rename, wait: async () => undefined })

    expect(result.ok).toBe(true)
    expect(rename).toHaveBeenCalledTimes(3)
  })

  // DE1D.3: EPERM here means "held by another program", not "no permission" —
  // mapFsError would say the wrong thing.
  it('gives up on a lasting lock with file-in-use, leaving nothing behind', async () => {
    const rename = vi.fn(async () => {
      throw Object.assign(new Error('locked'), { code: 'EPERM' })
    })

    const result = await writeAtomic(target(), 'novo', { rename, wait: async () => undefined })

    expect(result).toEqual({ ok: false, error: { kind: 'file-in-use', path: target() } })
    expect(await readdir(dir)).toEqual([])
  })

  it('does not retry an error that is not a lock', async () => {
    const rename = vi.fn(async () => {
      throw Object.assign(new Error('gone'), { code: 'ENOENT' })
    })

    const result = await writeAtomic(target(), 'novo', { rename, wait: async () => undefined })

    expect(rename).toHaveBeenCalledOnce()
    expect(result).toEqual({ ok: false, error: { kind: 'not-found', path: target() } })
  })
})
