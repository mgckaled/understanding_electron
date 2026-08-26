import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentPart, ImagePart, DatasetPart, Message } from '@shared/ipc'
import { ArtifactContext, type ArtifactApi, type ArtifactRef } from './artifactContext'
import ArtifactCount from './ArtifactCount'
import { artifactsOf, toArtifactRef } from './artifactsOf'

const DOC: DocumentPart = {
  kind: 'document',
  hash: 'h-doc',
  fileName: 'notas.md',
  format: 'md',
  text: 'x'
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
  columns: ['a'],
  rowCount: 1
}

function turn(id: string, part?: DocumentPart | ImagePart | DatasetPart): Message {
  return {
    id,
    role: 'user',
    parts: part === undefined ? [{ kind: 'text', text: 'oi' }] : [part],
    createdAt: 1
  }
}

function mount(messages: Message[], current: ArtifactRef | null = null): ArtifactApi {
  const api: ArtifactApi = { current, toggle: vi.fn(), close: vi.fn() }
  render(
    <ArtifactContext value={api}>
      <ArtifactCount messages={messages} />
    </ArtifactContext>
  )
  return api
}

describe('artifactsOf', () => {
  it('keeps only what the panel can open, oldest first', () => {
    const refs = artifactsOf([turn('m1', DOC), turn('m2'), turn('m3', IMG)])

    expect(refs.map((ref) => ref.id)).toEqual(['h-doc', 'h-img'])
  })

  it('leaves a dataset out until F-3-D, so the count never promises a panel that cannot open', () => {
    expect(toArtifactRef(DATA)).toBeNull()
    expect(artifactsOf([turn('m1', DATA)])).toEqual([])
  })

  it('counts cards, not distinct files', () => {
    expect(artifactsOf([turn('m1', DOC), turn('m2', DOC)])).toHaveLength(2)
  })
})

describe('ArtifactCount', () => {
  it('does not exist when the conversation has no openable attachment', () => {
    mount([turn('m1'), turn('m2', DATA)])

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows how many there are', () => {
    mount([turn('m1', DOC), turn('m2', IMG)])

    expect(screen.getByRole('button', { name: /Abrir anexos da conversa \(2\)/ })).toBeVisible()
  })

  it('opens the most recent one, not the first', async () => {
    const api = mount([turn('m1', DOC), turn('m2', IMG)])

    await userEvent.click(screen.getByRole('button'))

    expect(api.toggle).toHaveBeenCalledWith(
      { kind: 'image', id: 'h-img', part: IMG },
      expect.anything()
    )
  })

  it('closes the panel that is already open, whichever artifact it holds', async () => {
    const openDoc: ArtifactRef = { kind: 'document', id: 'h-doc', part: DOC }
    const api = mount([turn('m1', DOC), turn('m2', IMG)], openDoc)
    const button = screen.getByRole('button', { name: /Fechar/ })

    expect(button).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(button)

    // The one being closed, never the newest — closing the panel by handing it
    // a different artifact would swap instead of close.
    expect(api.toggle).toHaveBeenCalledWith(openDoc, expect.anything())
  })
})
