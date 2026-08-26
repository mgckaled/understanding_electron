import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentPart, ImagePart } from '@shared/ipc'
import ArtifactPanel from './ArtifactPanel'
import { copyArtifact } from './copyArtifact'
import { ArtifactContext, type ArtifactApi, type ArtifactRef } from './artifactContext'

// The clipboard itself is mocked, not jsdom's `navigator`: what `copyArtifact`
// really does — fetch through `attachment://`, ClipboardItem — has no meaning
// without a CSP and a protocol handler, so a level-2 test that stubbed it would
// be asserting against its own fake. What IS testable here is the panel's part:
// it asks, and it confirms only when the answer is yes.
vi.mock('./copyArtifact', () => ({ copyArtifact: vi.fn() }))

const DOC: DocumentPart = {
  kind: 'document',
  hash: 'h-doc',
  fileName: 'notas.md',
  format: 'md',
  text: '# Título\n\ncorpo do documento'
}
const IMG: ImagePart = {
  kind: 'image',
  hash: 'h-img',
  fileName: 'grafico.png',
  mimeType: 'image/png'
}

// The panel reads the context and nothing else, so a hand-made value is the
// whole environment it needs — no provider, no conversation, no query client.
function mount(current: ArtifactRef | null): ArtifactApi {
  const api: ArtifactApi = { current, toggle: vi.fn(), close: vi.fn() }
  render(
    <ArtifactContext value={api}>
      <ArtifactPanel />
    </ArtifactContext>
  )
  return api
}

describe('ArtifactPanel', () => {
  it('renders nothing when no artifact is open', () => {
    mount(null)
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('renders a markdown document as markdown, under its filename', () => {
    mount({ kind: 'document', id: DOC.hash, part: DOC })

    expect(screen.getByText('notas.md')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Título' })).toBeVisible()
  })

  it('renders a plain-text document without markdown', () => {
    mount({
      kind: 'document',
      id: 'h-txt',
      part: { ...DOC, fileName: 'notas.txt', format: 'txt' }
    })

    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText(/corpo do documento/)).toBeVisible()
  })

  it('says so when the extraction came back empty', () => {
    mount({ kind: 'document', id: 'h-vazio', part: { ...DOC, text: '   \n ' } })

    expect(screen.getByText('Este arquivo não tem texto extraído.')).toBeVisible()
  })

  it('serves the image through the attachment protocol', () => {
    mount({ kind: 'image', id: IMG.hash, part: IMG })

    expect(screen.getByRole('img', { name: 'grafico.png' })).toHaveAttribute(
      'src',
      'attachment://h-img'
    )
  })

  it('says so when the image fails to load', () => {
    mount({ kind: 'image', id: IMG.hash, part: IMG })

    fireEvent.error(screen.getByRole('img', { name: 'grafico.png' }))

    expect(screen.getByText('Não foi possível carregar esta imagem.')).toBeVisible()
  })

  it('closes through the header button', async () => {
    const api = mount({ kind: 'document', id: DOC.hash, part: DOC })

    await userEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))

    expect(api.close).toHaveBeenCalledOnce()
  })

  it('copies a document and confirms it, then goes back to offering the copy', async () => {
    vi.mocked(copyArtifact).mockResolvedValue(true)
    mount({ kind: 'document', id: DOC.hash, part: DOC })

    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }))

    expect(copyArtifact).toHaveBeenCalledWith({ kind: 'document', id: DOC.hash, part: DOC })
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Copiar' }, { timeout: 2000 })).toBeVisible()
  })

  it('does not confirm when the copy fails', async () => {
    vi.mocked(copyArtifact).mockResolvedValue(false)
    mount({ kind: 'document', id: DOC.hash, part: DOC })

    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }))

    expect(copyArtifact).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Copiado' })).toBeNull()
  })
})
