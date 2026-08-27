import { createHash } from 'node:crypto'
import { join } from 'node:path'
import * as jobs from '../../jobs'
import { pickImage, attachImage, readImageBytes } from './handlers'

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01])
const SVG_BYTES = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP', 'ascii')
])
const RASTERIZED_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x02])

// The two new deps introduced by D17.7 — never called on a PNG/JPEG source.
const rasterize = vi.fn(async () => {
  throw new Error('unexpected rasterize call for a PNG/JPEG source')
})
const storeAttachmentBytes = vi.fn()

describe('pickImage', () => {
  it('returns the picked path when the user selects a file', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/a.png'] })

    const result = await pickImage(undefined, showOpenDialog)

    expect(result).toEqual({ ok: true, value: { path: '/a.png' } })
  })

  it('returns ok(null) when the user cancels the dialog', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] })

    const result = await pickImage(undefined, showOpenDialog)

    expect(result).toEqual({ ok: true, value: null })
  })

  it('accepts svg and webp alongside png/jpeg (D17.7)', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] })

    await pickImage(undefined, showOpenDialog)

    expect(showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ name: 'Imagem', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }]
      })
    )
  })
})

describe('attachImage', () => {
  it('returns the image part with the mime type sniffed from bytes, and stores it', async () => {
    const storeAttachment = vi.fn().mockResolvedValue(undefined)
    const readImageFile = vi.fn().mockResolvedValue(PNG_BYTES)

    const result = await attachImage(
      { path: '/fotos/grafico.png', jobId: 'attach-ok' },
      readImageFile,
      '/tmp/attachments',
      storeAttachment,
      vi.fn(),
      rasterize,
      storeAttachmentBytes
    )

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'image',
        hash: createHash('sha256').update(PNG_BYTES).digest('hex'),
        fileName: 'grafico.png',
        mimeType: 'image/png'
      }
    })
    expect(storeAttachment).toHaveBeenCalledWith(
      '/tmp/attachments',
      createHash('sha256').update(PNG_BYTES).digest('hex'),
      '/fotos/grafico.png'
    )
    expect(rasterize).not.toHaveBeenCalled()
  })

  it('sniffs JPEG independent of the extension the file happened to have', async () => {
    const readImageFile = vi.fn().mockResolvedValue(JPEG_BYTES)

    const result = await attachImage(
      { path: '/x.jpg', jobId: 'attach-jpeg' },
      readImageFile,
      '/tmp/attachments',
      vi.fn().mockResolvedValue(undefined),
      vi.fn(),
      rasterize,
      storeAttachmentBytes
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.mimeType).toBe('image/jpeg')
  })

  it('rasterizes an SVG source and stores the PNG output, never the source bytes (D17.7)', async () => {
    const storeAttachment = vi.fn()
    const store = vi.fn().mockResolvedValue(undefined)
    const raster = vi.fn().mockResolvedValue(RASTERIZED_PNG)
    const readImageFile = vi.fn().mockResolvedValue(SVG_BYTES)

    const result = await attachImage(
      { path: '/icones/logo.svg', jobId: 'attach-svg' },
      readImageFile,
      '/tmp/attachments',
      storeAttachment,
      vi.fn(),
      raster,
      store
    )

    expect(raster).toHaveBeenCalledWith(SVG_BYTES, 'image/svg+xml')
    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'image',
        hash: createHash('sha256').update(RASTERIZED_PNG).digest('hex'),
        fileName: 'logo.svg',
        mimeType: 'image/png'
      }
    })
    expect(store).toHaveBeenCalledWith(
      '/tmp/attachments',
      createHash('sha256').update(RASTERIZED_PNG).digest('hex'),
      RASTERIZED_PNG
    )
    expect(storeAttachment).not.toHaveBeenCalled()
  })

  it('rasterizes a WebP source the same way (D17.7)', async () => {
    const store = vi.fn().mockResolvedValue(undefined)
    const raster = vi.fn().mockResolvedValue(RASTERIZED_PNG)
    const readImageFile = vi.fn().mockResolvedValue(WEBP_BYTES)

    const result = await attachImage(
      { path: '/fotos/banner.webp', jobId: 'attach-webp' },
      readImageFile,
      '/tmp/attachments',
      vi.fn(),
      vi.fn(),
      raster,
      store
    )

    expect(raster).toHaveBeenCalledWith(WEBP_BYTES, 'image/webp')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.mimeType).toBe('image/png')
  })

  it('refuses an unrecognized format as blocked, and never stores or rasterizes it', async () => {
    const storeAttachment = vi.fn()
    const readImageFile = vi.fn().mockResolvedValue(Buffer.from('not an image', 'utf8'))

    const result = await attachImage(
      { path: '/x.png', jobId: 'attach-bad' },
      readImageFile,
      '/tmp/attachments',
      storeAttachment,
      vi.fn(),
      rasterize,
      storeAttachmentBytes
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('blocked')
    expect(storeAttachment).not.toHaveBeenCalled()
    expect(rasterize).not.toHaveBeenCalled()
  })

  it('maps an ENOENT error and never stores anything when the read fails', async () => {
    const fsError = Object.assign(new Error('no such file'), { code: 'ENOENT' })
    const storeAttachment = vi.fn()

    const result = await attachImage(
      { path: '/missing.png', jobId: 'attach-missing' },
      vi.fn().mockRejectedValue(fsError),
      '/tmp/attachments',
      storeAttachment,
      vi.fn(),
      rasterize,
      storeAttachmentBytes
    )

    expect(result).toEqual({ ok: false, error: { kind: 'not-found', path: '/missing.png' } })
    expect(storeAttachment).not.toHaveBeenCalled()
  })

  it('never stores anything when the job is cancelled mid-read', async () => {
    const jobId = 'attach-cancel'
    const storeAttachment = vi.fn()
    const readImageFile = vi.fn().mockImplementation(async (_path: string, signal: AbortSignal) => {
      jobs.cancel(jobId)
      return Promise.reject(
        Object.assign(new Error('aborted'), { name: 'AbortError', aborted: signal.aborted })
      )
    })

    const result = await attachImage(
      { path: '/x.png', jobId },
      readImageFile,
      '/tmp/attachments',
      storeAttachment,
      vi.fn(),
      rasterize,
      storeAttachmentBytes
    )

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
    expect(storeAttachment).not.toHaveBeenCalled()
  })
})

describe('readImageBytes', () => {
  const HASH = 'a'.repeat(64)

  it('reads the blob addressed by the hash', async () => {
    const readFile = vi.fn().mockResolvedValue(Buffer.from([1, 2, 3]))

    const result = await readImageBytes({ hash: HASH }, '/tmp/attachments', readFile)

    expect(result).toEqual({ ok: true, value: Buffer.from([1, 2, 3]) })
    expect(readFile).toHaveBeenCalledWith(join('/tmp/attachments', HASH))
  })

  // The guard has to run BEFORE the path is built — a rejection that happens
  // after `join` has already resolved `..` is not a guard, it is a log line.
  it('refuses a hash that would escape the attachments directory, without touching the disk', async () => {
    const readFile = vi.fn()

    const result = await readImageBytes({ hash: '../../etc/passwd' }, '/tmp/attachments', readFile)

    expect(result).toEqual({
      ok: false,
      error: { kind: 'blocked', reason: 'Identificador de anexo inválido.' }
    })
    expect(readFile).not.toHaveBeenCalled()
  })

  it('reports a swept blob as not-found rather than throwing', async () => {
    const readFile = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { code: 'ENOENT' }))

    const result = await readImageBytes({ hash: HASH }, '/tmp/attachments', readFile)

    expect(result).toEqual({
      ok: false,
      error: { kind: 'not-found', path: join('/tmp/attachments', HASH) }
    })
  })
})
