import { createHash } from 'node:crypto'
import * as jobs from '../../jobs'
import { pickImage, attachImage } from './handlers'

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01])

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
      vi.fn()
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
  })

  it('sniffs JPEG independent of the extension the file happened to have', async () => {
    const readImageFile = vi.fn().mockResolvedValue(JPEG_BYTES)

    const result = await attachImage(
      { path: '/x.jpg', jobId: 'attach-jpeg' },
      readImageFile,
      '/tmp/attachments',
      vi.fn().mockResolvedValue(undefined),
      vi.fn()
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.mimeType).toBe('image/jpeg')
  })

  it('refuses an unrecognized format as blocked, and never stores it', async () => {
    const storeAttachment = vi.fn()
    const readImageFile = vi.fn().mockResolvedValue(Buffer.from('not an image', 'utf8'))

    const result = await attachImage(
      { path: '/x.png', jobId: 'attach-bad' },
      readImageFile,
      '/tmp/attachments',
      storeAttachment,
      vi.fn()
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('blocked')
    expect(storeAttachment).not.toHaveBeenCalled()
  })

  it('maps an ENOENT error and never stores anything when the read fails', async () => {
    const fsError = Object.assign(new Error('no such file'), { code: 'ENOENT' })
    const storeAttachment = vi.fn()

    const result = await attachImage(
      { path: '/missing.png', jobId: 'attach-missing' },
      vi.fn().mockRejectedValue(fsError),
      '/tmp/attachments',
      storeAttachment,
      vi.fn()
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
      vi.fn()
    )

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
    expect(storeAttachment).not.toHaveBeenCalled()
  })
})
