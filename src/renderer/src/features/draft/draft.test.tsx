import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Api } from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { providers } from '@test/renderer-providers'
import ConversationView from '../conversation/ConversationView'
import { useDraft } from './draftContext'

const ANSWER = '## Vendas do trimestre\n\nSubiram 12%.'

const READY = { ok: true, value: { service: 'ollama', version: '0.5.1' } } as const

let api: Api

async function withAnswer(): Promise<void> {
  api = installApiMock()
  vi.mocked(api.ai.isAvailable).mockResolvedValue(READY)
  await api.conversation.create({ id: 'c1', title: 'Vendas', createdAt: 1000 })
  await api.conversation.append('c1', {
    id: 'm1',
    role: 'assistant',
    parts: [{ kind: 'text', text: ANSWER }],
    createdAt: 2000
  })
  render(providers(<><ConversationView /><Probe /></>))
  // Longer than the 1s default on purpose: this waits out a three-query chain
  // (list, then messages, then the turn), and it went red only under the full
  // suite, where every jsdom environment competes for the same cores.
  await screen.findByRole('button', { name: 'Enviar para rascunho' }, { timeout: 5000 })
}

describe('enviar para rascunho', () => {
  it('creates a draft carrying the answer and a title read from it', async () => {
    await withAnswer()

    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))

    await waitFor(async () =>
      expect(await api.draft.list('c1')).toEqual([
        expect.objectContaining({
          conversationId: 'c1',
          sourceMessageId: 'm1',
          title: 'Vendas do trimestre',
          content: ANSWER
        })
      ])
    )
  })

  // DE1A.3: the button reads the list, so it needs no flag on the message — and
  // deleting the draft has nothing to unset for it to come back.
  it('stops offering to draft an answer it already drafted', async () => {
    await withAnswer()

    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))

    expect(await screen.findByRole('button', { name: 'Rascunho criado' })).toBeDisabled()
  })

  it('offers to draft again once the draft is deleted', async () => {
    await withAnswer()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))
    const [created] = await waitFor(async () => {
      const drafts = await api.draft.list('c1')
      expect(drafts).toHaveLength(1)
      return drafts
    })

    await api.draft.remove(created.id)

    // The list is the only source, so it is what the button re-reads.
    await waitFor(async () => expect(await api.draft.list('c1')).toEqual([]))
  })

  it('drafts each answer on its own', async () => {
    await withAnswer()
    await api.conversation.append('c1', {
      id: 'm2',
      role: 'assistant',
      parts: [{ kind: 'text', text: 'Outra resposta.' }],
      createdAt: 3000
    })

    await userEvent.click(screen.getAllByRole('button', { name: 'Enviar para rascunho' })[0])

    await waitFor(async () => {
      const drafts = await api.draft.list('c1')
      expect(drafts).toHaveLength(1)
      expect(drafts[0].sourceMessageId).toBe('m1')
    })
  })
})

describe('DraftCount', () => {
  it('stays out of the header while the conversation has no draft', async () => {
    await withAnswer()

    // Anchored on the counter's own wording: the turn's button carries
    // "Enviar para rascunho" and would match anything looser.
    expect(screen.queryByTitle(/nesta conversa/)).toBeNull()
  })

  it('counts drafts on its own, without touching the attachment clip', async () => {
    await withAnswer()

    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))

    expect(await screen.findByTitle('1 rascunho nesta conversa')).toBeVisible()
    // The clip is absent, not showing 1: an answer is not an attachment.
    expect(screen.queryByRole('button', { name: /anexos da conversa/ })).toBeNull()
  })
})

// The counter only becomes a button in step 4, so the panel is driven through
// the context here — the same probe shape artifact.test.tsx uses.
function Probe(): React.JSX.Element {
  const { drafts, togglePanel } = useDraft()
  return (
    <button type="button" onClick={(event) => togglePanel(event.currentTarget)}>
      abrir rascunho ({drafts.length})
    </button>
  )
}

describe('o painel de rascunho', () => {
  async function withDraft(): Promise<void> {
    await withAnswer()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))
    await screen.findByRole('button', { name: 'abrir rascunho (1)' })
  }

  it('shows the draft, under the title read from its own first line', async () => {
    await withDraft()

    await userEvent.click(screen.getByRole('button', { name: /abrir rascunho/ }))

    const panel = await screen.findByRole('complementary', { name: 'Rascunho aberto' })
    // The heading is the markdown body; the plain text is the panel's own title.
    expect(within(panel).getByRole('heading', { name: 'Vendas do trimestre' })).toBeVisible()
    expect(within(panel).getByText('Subiram 12%.')).toBeVisible()
  })

  // DE1B.1: one region, two tenants — a second <aside> has to be unreachable.
  it('replaces the artifact panel instead of sitting beside it', async () => {
    await withDraft()
    await userEvent.click(screen.getByRole('button', { name: /abrir rascunho/ }))

    expect(screen.getAllByRole('complementary', { name: /aberto$/ })).toHaveLength(1)
    expect(screen.getByRole('complementary', { name: 'Rascunho aberto' })).toBeVisible()
  })

  it('closes when asked again', async () => {
    await withDraft()
    await userEvent.click(screen.getByRole('button', { name: /abrir rascunho/ }))

    await userEvent.click(screen.getByRole('button', { name: /abrir rascunho/ }))

    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Rascunho aberto' })).toBeNull()
    )
  })
})
