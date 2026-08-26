import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentPart, ImagePart } from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { createQueryClient } from '../../shared/queryClient'
import ConversationsProvider from '../conversation/ConversationsProvider'
import { useConversations } from '../conversation/conversationsContext'
import ArtifactPanel from './ArtifactPanel'
import ArtifactProvider from './ArtifactProvider'
import { useArtifact, type ArtifactRef } from './artifactContext'

const DOC: DocumentPart = {
  kind: 'document',
  hash: 'h-doc',
  fileName: 'notas.md',
  format: 'md',
  text: '# Notas'
}
const IMG: ImagePart = {
  kind: 'image',
  hash: 'h-img',
  fileName: 'grafico.png',
  mimeType: 'image/png'
}

const DOC_REF: ArtifactRef = { kind: 'document', id: DOC.hash, part: DOC }
const IMG_REF: ArtifactRef = { kind: 'image', id: IMG.hash, part: IMG }

// Stands in for the attachment cards, which only become triggers in passo 4.
function Probe(): React.JSX.Element {
  const { toggle } = useArtifact()
  const { select } = useConversations()
  return (
    <>
      <button onClick={(event) => toggle(DOC_REF, event.currentTarget)}>abrir doc</button>
      <button onClick={(event) => toggle(IMG_REF, event.currentTarget)}>abrir img</button>
      <button onClick={() => select('outra')}>trocar de conversa</button>
    </>
  )
}

function mount(): void {
  installApiMock()
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ConversationsProvider>
        <ArtifactProvider>
          <Probe />
          <ArtifactPanel />
        </ArtifactProvider>
      </ConversationsProvider>
    </QueryClientProvider>
  )
}

describe('ArtifactProvider', () => {
  it('opens the panel for the clicked artifact', async () => {
    mount()
    expect(screen.queryByRole('complementary')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'abrir doc' }))

    expect(screen.getByRole('complementary')).toBeVisible()
    expect(screen.getByText('notas.md')).toBeVisible()
  })

  it('closes when the same artifact is clicked again', async () => {
    mount()
    const trigger = screen.getByRole('button', { name: 'abrir doc' })

    await userEvent.click(trigger)
    await userEvent.click(trigger)

    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('swaps to the other artifact without closing in between', async () => {
    mount()

    await userEvent.click(screen.getByRole('button', { name: 'abrir doc' }))
    await userEvent.click(screen.getByRole('button', { name: 'abrir img' }))

    expect(screen.getByRole('complementary')).toBeVisible()
    expect(screen.getByText('grafico.png')).toBeVisible()
    expect(screen.queryByText('notas.md')).toBeNull()
  })

  it('closes when the conversation changes', async () => {
    mount()

    await userEvent.click(screen.getByRole('button', { name: 'abrir doc' }))
    await userEvent.click(screen.getByRole('button', { name: 'trocar de conversa' }))

    expect(screen.queryByRole('complementary')).toBeNull()
  })
})
