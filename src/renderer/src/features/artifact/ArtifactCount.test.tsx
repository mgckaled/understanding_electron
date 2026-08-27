import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentPart, ImagePart, DatasetPart, Message } from '@shared/ipc'
import { ArtifactContext, type ArtifactRef } from './artifactContext'
import { fakeArtifactApi } from '@test/artifact-api'
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

const DOC_REF: ArtifactRef = { kind: 'document', id: 'h-doc', part: DOC }
const IMG_REF: ArtifactRef = { kind: 'image', id: 'h-img', part: IMG }

function mount(
  artifacts: ArtifactRef[],
  current: ArtifactRef | null = null
): ReturnType<typeof fakeArtifactApi> {
  const api = fakeArtifactApi(current, artifacts)
  render(
    <ArtifactContext value={api}>
      <ArtifactCount />
    </ArtifactContext>
  )
  return api
}

describe('artifactsOf', () => {
  it('keeps only what the panel can open, oldest first', () => {
    const refs = artifactsOf([turn('m1', DOC), turn('m2'), turn('m3', IMG)])

    expect(refs.map((ref) => ref.id)).toEqual(['h-doc', 'h-img'])
  })

  // The inversion of the F-3-B case: the clip counted only what the panel
  // could open, and the panel could not open a dataset. Now it can, and no
  // line of the clip changed to make it so (DF3B.7).
  it('counts a dataset, now that the panel opens one', () => {
    expect(toArtifactRef(DATA)).toEqual({ kind: 'dataset', id: 'h-csv', part: DATA })
    expect(artifactsOf([turn('m1', DATA)]).map((ref) => ref.id)).toEqual(['h-csv'])
  })

  it('counts cards, not distinct files', () => {
    expect(artifactsOf([turn('m1', DOC), turn('m2', DOC)])).toHaveLength(2)
  })
})

describe('ArtifactCount', () => {
  it('does not exist when the conversation has no openable attachment', () => {
    mount([])

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows how many there are', () => {
    mount([DOC_REF, IMG_REF])

    expect(screen.getByRole('button', { name: /Abrir anexos da conversa \(2\)/ })).toBeVisible()
  })

  it('asks the panel to toggle, and does not decide WHICH artifact opens', async () => {
    // That rule has two callers that must never disagree — this button and
    // Ctrl+B — so it lives in the provider (DF3B.1) and is proven there,
    // against the real one, in artifact.test.tsx.
    const api = mount([DOC_REF, IMG_REF])

    await userEvent.click(screen.getByRole('button'))

    expect(api.togglePanel).toHaveBeenCalledOnce()
    expect(api.toggle).not.toHaveBeenCalled()
  })

  it('says it is pressed while the panel is open', () => {
    mount([DOC_REF, IMG_REF], DOC_REF)

    expect(screen.getByRole('button', { name: /Fechar/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
