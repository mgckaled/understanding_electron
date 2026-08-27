import type { DatasetPart, DocumentPart, ImagePart } from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { canCopy, copyArtifact } from './copyArtifact'

const DOC: DocumentPart = {
  kind: 'document',
  hash: 'h-doc',
  fileName: 'notas.md',
  format: 'md',
  text: 'corpo'
}
const PNG: ImagePart = {
  kind: 'image',
  hash: 'h-png',
  // The name a rasterised SVG keeps (D17.7) — the case DF3E.2 exists for.
  fileName: 'logo.svg',
  mimeType: 'image/png'
}
const JPEG: ImagePart = { ...PNG, hash: 'h-jpg', fileName: 'foto.jpg', mimeType: 'image/jpeg' }
const DATA: DatasetPart = {
  kind: 'dataset',
  hash: 'h-csv',
  fileName: 'vendas.csv',
  format: 'delimited',
  delimiter: ',',
  columns: ['a'],
  rowCount: 1
}

// jsdom has none of the three. They are stubbed here rather than in
// setup-renderer.ts because one suite needs them, and what is asserted below
// is which path runs — never the encoder, which would be testing the stub.
const write = vi.fn()
const writeText = vi.fn()
const createImageBitmap = vi.fn()

beforeEach(() => {
  vi.stubGlobal(
    'ClipboardItem',
    class {
      constructor(readonly items: Record<string, Blob>) {}
    }
  )
  vi.stubGlobal('createImageBitmap', createImageBitmap)
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext = (): { drawImage: () => void } => ({ drawImage: () => {} })
      convertToBlob = async (): Promise<Blob> =>
        new Blob([new Uint8Array([9])], { type: 'image/png' })
    }
  )
  createImageBitmap.mockResolvedValue({ width: 2, height: 2, close: vi.fn() })
  vi.stubGlobal('navigator', { clipboard: { write, writeText } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('canCopy', () => {
  it('covers document and image, and leaves tabular data to export', () => {
    expect(canCopy({ kind: 'document', id: 'x', part: DOC })).toBe(true)
    expect(canCopy({ kind: 'image', id: 'x', part: PNG })).toBe(true)
    expect(canCopy({ kind: 'dataset', id: 'x', part: DATA })).toBe(false)
  })
})

describe('copyArtifact', () => {
  it('writes a document as text', async () => {
    expect(await copyArtifact({ kind: 'document', id: 'x', part: DOC })).toBe(true)
    expect(writeText).toHaveBeenCalledWith('corpo')
  })

  it('sends a PNG straight through, without decoding it', async () => {
    const api = installApiMock()
    vi.mocked(api.image.bytes).mockResolvedValue({ ok: true, value: new Uint8Array([1, 2]) })

    expect(await copyArtifact({ kind: 'image', id: 'x', part: PNG })).toBe(true)

    expect(api.image.bytes).toHaveBeenCalledWith('h-png')
    expect(createImageBitmap).not.toHaveBeenCalled()
    expect(write).toHaveBeenCalledOnce()
  })

  // Chromium refuses image/jpeg in a ClipboardItem, so this branch is the
  // difference between working and throwing for half the app's images.
  it('re-encodes a JPEG before writing', async () => {
    const api = installApiMock()
    vi.mocked(api.image.bytes).mockResolvedValue({ ok: true, value: new Uint8Array([1, 2]) })

    expect(await copyArtifact({ kind: 'image', id: 'x', part: JPEG })).toBe(true)

    expect(createImageBitmap).toHaveBeenCalledOnce()
    const [[items]] = write.mock.calls
    expect(Object.keys(items[0].items)).toEqual(['image/png'])
  })

  it('does not touch the clipboard when the channel fails', async () => {
    const api = installApiMock()
    vi.mocked(api.image.bytes).mockResolvedValue({
      ok: false,
      error: { kind: 'not-found', path: 'x' }
    })

    expect(await copyArtifact({ kind: 'image', id: 'x', part: PNG })).toBe(false)
    expect(write).not.toHaveBeenCalled()
  })

  it('reports failure instead of throwing when the clipboard refuses', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'))

    expect(await copyArtifact({ kind: 'document', id: 'x', part: DOC })).toBe(false)
  })
})
