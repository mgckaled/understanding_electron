import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
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
      <textarea aria-label="composer de mentira" />
    </>
  )
}

// The provider derives `artifacts` from the real transcript, so the shortcut
// can only be proven with real messages in a real conversation — the mock's
// handlers run against an in-memory database (skill testing).
async function seed(): Promise<void> {
  const api = installApiMock()
  const id = 'c-artifacts'
  await api.conversation.create({ id, title: 'Anexos', createdAt: 1 })
  await api.conversation.append(id, { id: 'm1', role: 'user', parts: [DOC], createdAt: 1 })
  await api.conversation.append(id, { id: 'm2', role: 'user', parts: [IMG], createdAt: 2 })
}

function mount(): void {
  installApiMock()
  render(harness())
}

function harness(onOpen?: () => void): React.JSX.Element {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <ConversationsProvider>
        <ArtifactProvider onOpen={onOpen}>
          <Probe />
          <ArtifactPanel />
        </ArtifactProvider>
      </ConversationsProvider>
    </QueryClientProvider>
  )
}

// Named, not bare: the sidebar is a complementary region too, and querying
// by role alone matched both in the real app while passing here (found live).
const PANEL = 'Anexo aberto'

// Not imported from the provider: a test that reads the constant it checks
// cannot notice it changing.
const FADE_MS = 200

describe('ArtifactProvider', () => {
  it('opens the panel for the clicked artifact', async () => {
    mount()
    expect(screen.queryByRole('complementary', { name: PANEL })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'abrir doc' }))

    expect(screen.getByRole('complementary', { name: PANEL })).toBeVisible()
    expect(screen.getByText('notas.md')).toBeVisible()
  })

  it('closes when the same artifact is clicked again', async () => {
    mount()
    const trigger = screen.getByRole('button', { name: 'abrir doc' })

    await userEvent.click(trigger)
    await userEvent.click(trigger)

    await waitFor(() => expect(screen.queryByRole('complementary', { name: PANEL })).toBeNull())
  })

  it('stays mounted while it fades, and leaves the DOM only after (DF3C.1)', async () => {
    mount()
    const trigger = screen.getByRole('button', { name: 'abrir doc' })
    await userEvent.click(trigger)

    await userEvent.click(trigger)

    expect(screen.getByRole('complementary', { name: PANEL })).toHaveAttribute(
      'data-closing',
      'true'
    )
    await waitFor(() => expect(screen.queryByRole('complementary', { name: PANEL })).toBeNull())
  })

  it('cancels a pending fade when the panel is asked for again', async () => {
    mount()
    const trigger = screen.getByRole('button', { name: 'abrir doc' })
    await userEvent.click(trigger)
    await userEvent.click(trigger)

    await userEvent.click(trigger)

    // Waiting past the fade IS the assertion: a stray timer only closes the
    // panel later, so an immediate check passes against the bug.
    await new Promise((resolve) => setTimeout(resolve, FADE_MS + 100))
    const panel = screen.getByRole('complementary', { name: PANEL })
    expect(panel).toBeVisible()
    expect(panel).not.toHaveAttribute('data-closing')
  })

  it('asks the shell for room when it opens, never when it swaps (DF3C.3)', async () => {
    installApiMock()
    const onOpen = vi.fn()
    render(harness(onOpen))

    await userEvent.click(screen.getByRole('button', { name: 'abrir doc' }))
    await userEvent.click(screen.getByRole('button', { name: 'abrir img' }))

    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('swaps to the other artifact without closing in between', async () => {
    mount()

    await userEvent.click(screen.getByRole('button', { name: 'abrir doc' }))
    await userEvent.click(screen.getByRole('button', { name: 'abrir img' }))

    expect(screen.getByRole('complementary', { name: PANEL })).toBeVisible()
    expect(screen.getByText('grafico.png')).toBeVisible()
    expect(screen.queryByText('notas.md')).toBeNull()
  })

  it('gives focus back to the card that opened it', async () => {
    mount()
    const trigger = screen.getByRole('button', { name: 'abrir doc' })

    await userEvent.click(trigger)
    // The panel must hold focus first, or Esc would still be going to the card
    // and this test would pass without a round trip having happened.
    expect(screen.getByRole('complementary', { name: PANEL })).toHaveFocus()

    await userEvent.keyboard('{Escape}')

    // Synchronous on purpose: focus comes back before the fade ends (DF3C.1).
    expect(trigger).toHaveFocus()
    await waitFor(() => expect(screen.queryByRole('complementary', { name: PANEL })).toBeNull())
  })

  it('opens the newest artifact, not the first, when nothing is open', async () => {
    await seed()
    render(harness())
    await screen.findByRole('button', { name: 'abrir doc' })

    await userEvent.keyboard('{Control>}b{/Control}')

    const panel = await screen.findByRole('complementary', { name: PANEL })
    // Scoped to the panel's own title: with two artifacts the picker's popover
    // lists both names, so a bare getByText matches twice.
    expect(within(panel).getByRole('button', { name: /grafico\.png/ })).toBeVisible()
  })

  it('Ctrl+B closes whatever is open, whichever artifact that is', async () => {
    await seed()
    render(harness())

    await userEvent.click(screen.getByRole('button', { name: 'abrir doc' }))
    const panel = screen.getByRole('complementary', { name: PANEL })
    expect(within(panel).getByRole('button', { name: /notas\.md/ })).toBeVisible()

    await userEvent.keyboard('{Control>}b{/Control}')

    await waitFor(() => expect(screen.queryByRole('complementary', { name: PANEL })).toBeNull())
  })

  it('never fires while the user is typing', async () => {
    await seed()
    render(harness())

    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.keyboard('{Control>}b{/Control}')

    expect(screen.queryByRole('complementary', { name: PANEL })).toBeNull()
  })

  // ⚠️ These two are written as "the combo did nothing, and the NEXT plain
  // Ctrl+B opens" on purpose. Asserting absence right after the event is
  // vacuous — the panel would open on a later tick and the synchronous query
  // would still find nothing. Caught by provocation: removing the modifier
  // guard failed ZERO tests in the first version of this file. Because Ctrl+B
  // toggles, one stray fire flips the final state, so the last assertion is
  // what carries the proof.
  it('leaves Ctrl+Shift+B alone', async () => {
    await seed()
    render(harness())
    await screen.findByRole('button', { name: 'abrir doc' })

    await userEvent.keyboard('{Control>}{Shift>}b{/Shift}{/Control}')
    await userEvent.keyboard('{Control>}b{/Control}')

    expect(await screen.findByRole('complementary', { name: PANEL })).toBeVisible()
  })

  it('leaves Ctrl+Alt+B alone', async () => {
    await seed()
    render(harness())
    await screen.findByRole('button', { name: 'abrir doc' })

    await userEvent.keyboard('{Control>}{Alt>}b{/Alt}{/Control}')
    await userEvent.keyboard('{Control>}b{/Control}')

    expect(await screen.findByRole('complementary', { name: PANEL })).toBeVisible()
  })

  it('closes when the conversation changes', async () => {
    mount()

    await userEvent.click(screen.getByRole('button', { name: 'abrir doc' }))
    await userEvent.click(screen.getByRole('button', { name: 'trocar de conversa' }))

    expect(screen.queryByRole('complementary', { name: PANEL })).toBeNull()
  })
})
