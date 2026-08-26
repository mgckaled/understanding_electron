import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentPart, ImagePart } from '@shared/ipc'
import { ArtifactContext, type ArtifactApi, type ArtifactRef } from '../artifact/artifactContext'
import DocumentCard from './DocumentCard'
import ImageCard from './ImageCard'

const DOC: DocumentPart = {
  kind: 'document',
  hash: 'h-doc',
  fileName: 'especificacao.md',
  format: 'md',
  text: 'conteudo'
}
const IMG: ImagePart = {
  kind: 'image',
  hash: 'h-img',
  fileName: 'grafico.png',
  mimeType: 'image/png'
}

function mount(node: React.JSX.Element, current: ArtifactRef | null = null): ArtifactApi {
  const api: ArtifactApi = {
    current,
    artifacts: current === null ? [] : [current],
    toggle: vi.fn(),
    close: vi.fn()
  }
  render(<ArtifactContext value={api}>{node}</ArtifactContext>)
  return api
}

describe('os cartões de anexo como gatilho do painel (DF3A.6)', () => {
  it('hands the document to the panel, with the clicked element as the trigger', async () => {
    const api = mount(<DocumentCard part={DOC} />)
    const trigger = screen.getByRole('button')

    await userEvent.click(trigger)

    expect(api.toggle).toHaveBeenCalledWith({ kind: 'document', id: 'h-doc', part: DOC }, trigger)
  })

  it('hands the image to the panel the same way', async () => {
    const api = mount(<ImageCard part={IMG} />)
    const trigger = screen.getByRole('button')

    await userEvent.click(trigger)

    expect(api.toggle).toHaveBeenCalledWith({ kind: 'image', id: 'h-img', part: IMG }, trigger)
  })

  it('marks itself as the open one, and never claims to be expanded', () => {
    mount(<DocumentCard part={DOC} />, { kind: 'document', id: 'h-doc', part: DOC })
    const trigger = screen.getByRole('button')

    expect(trigger).toHaveAttribute('aria-current', 'true')
    expect(trigger).not.toHaveAttribute('aria-expanded')
  })

  it('leaves the other card unmarked while one is open', () => {
    mount(<ImageCard part={IMG} />, { kind: 'document', id: 'h-doc', part: DOC })

    expect(screen.getByRole('button')).not.toHaveAttribute('aria-current')
  })

  it('never renders the body inline any more', () => {
    mount(<DocumentCard part={DOC} />, { kind: 'document', id: 'h-doc', part: DOC })

    expect(screen.queryByText('conteudo')).toBeNull()
  })
})
