import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DatasetPart, DocumentPart, ImagePart } from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { createQueryClient } from '../../shared/queryClient'
import ArtifactPanel from './ArtifactPanel'
import { copyArtifact } from './copyArtifact'
import { ArtifactContext, type ArtifactRef } from './artifactContext'
import { fakeArtifactApi } from '@test/artifact-api'

// The clipboard itself is mocked, not jsdom's `navigator`: what `copyArtifact`
// really does — fetch through `attachment://`, ClipboardItem — has no meaning
// without a CSP and a protocol handler, so a level-2 test that stubbed it would
// be asserting against its own fake. What IS testable here is the panel's part:
// it asks, and it confirms only when the answer is yes.
vi.mock('./copyArtifact', async (real) => ({
  ...(await real<typeof import('./copyArtifact')>()),
  copyArtifact: vi.fn()
}))

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
const DATA: DatasetPart = {
  kind: 'dataset',
  hash: 'h-csv',
  fileName: 'vendas.csv',
  format: 'delimited',
  delimiter: ',',
  columns: ['id'],
  rowCount: 3
}

// The panel reads the context and nothing else; the query client is here only
// because a dataset body queries, and the two other kinds ignore it.
function mount(current: ArtifactRef | null): ReturnType<typeof fakeArtifactApi> {
  const api = fakeArtifactApi(current)
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ArtifactContext value={api}>
        <ArtifactPanel />
      </ArtifactContext>
    </QueryClientProvider>
  )
  return api
}

// Named, not bare: the sidebar is a complementary region too, and querying
// by role alone matched both in the real app while passing here (found live).
const PANEL = 'Anexo aberto'

describe('ArtifactPanel', () => {
  it('renders nothing when no artifact is open', () => {
    mount(null)
    expect(screen.queryByRole('complementary', { name: PANEL })).toBeNull()
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

  it('takes focus when it opens, so the keyboard does not land nowhere', () => {
    mount({ kind: 'document', id: DOC.hash, part: DOC })

    expect(screen.getByRole('complementary', { name: PANEL })).toHaveFocus()
  })

  it('closes on Esc while focus is inside it', async () => {
    const api = mount({ kind: 'document', id: DOC.hash, part: DOC })

    await userEvent.keyboard('{Escape}')

    expect(api.close).toHaveBeenCalledOnce()
  })

  // The inversion of the F-3-A case: the bytes were unreachable then, and the
  // `image:bytes` channel is what reaches them now (DF3E.1).
  it('offers the copy button for an image', () => {
    mount({ kind: 'image', id: IMG.hash, part: IMG })

    expect(screen.getByRole('button', { name: 'Copiar' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Fechar painel' })).toBeVisible()
  })

  // DF3D.10: tabular data leaves through export (trilha E), not the clipboard.
  // A document still copies — its text is the only way out it has.
  it('offers no copy button for a dataset', () => {
    const api = installApiMock()
    vi.mocked(api.dataset.query).mockReturnValue(new Promise(() => {}))

    mount({ kind: 'dataset', id: DATA.hash, part: DATA })

    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull()
    expect(screen.getByText('vendas.csv')).toBeVisible()
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
