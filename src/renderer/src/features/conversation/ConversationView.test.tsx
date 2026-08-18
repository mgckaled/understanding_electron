import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import type {
  Api,
  AppError,
  ChatReply,
  DatasetPart,
  DocumentPart,
  ImagePart,
  JobEvent,
  Result
} from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import Settings from '../settings/Settings'
import ConversationsProvider from './ConversationsProvider'
import ConversationList from './ConversationList'
import ConversationView from './ConversationView'
import NewConversationButton from './NewConversationButton'

const ready = { ok: true, value: { service: 'ollama', version: '0.5.1' } } as const

const PROMPT = 'Pergunte algo ao modelo…'

/**
 * The view is usable once availability resolved and the composer is enabled. The
 * Ollama version that used to signal this moved to the sidebar footer (DS-3),
 * outside this view, so the composer's own enabled state is the sync point.
 */
async function whenReady(): Promise<void> {
  await waitFor(() => expect(screen.getByPlaceholderText(PROMPT)).toBeEnabled())
}

/*
 * The only thing plano 14 changed in this file is this wrapper — the server
 * cache needs its provider, and a fresh QueryClient per test keeps them from
 * sharing state. Every assertion below is the fase-13 one, unchanged, which is
 * exactly what step 3 existed to collect on (D13.2).
 */
function providers(children: ReactNode): React.JSX.Element {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <ConversationsProvider>{children}</ConversationsProvider>
    </QueryClientProvider>
  )
}

/** The view alone, under the stores it now reads from. */
function renderView(): HTMLElement {
  return render(providers(<ConversationView />)).container
}

/** The view plus the sidebar pieces, for anything about switching or settings. */
function renderShell(): void {
  render(
    providers(
      <>
        <NewConversationButton />
        <Settings />
        <ConversationList />
        <ConversationView />
      </>
    )
  )
}

/** Drives a full send and resolves the reply, returning the rendered container. */
async function reply(
  content: string,
  prompt = 'oi'
): Promise<{ api: Api; container: HTMLElement }> {
  const api = installApiMock()
  vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
  vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content } })
  const user = userEvent.setup()
  const container = renderView()
  await whenReady()
  await user.type(screen.getByPlaceholderText(PROMPT), prompt)
  await user.click(screen.getByRole('button', { name: 'Enviar' }))
  return { api, container }
}

/**
 * Sends a prompt, optionally lets `chunk` arrive, then fails the request with
 * `error`. The reply is held open until then, which is what makes the partial
 * text exist at the moment of the interruption.
 */
async function interrupted(error: AppError, chunk?: string): Promise<Api> {
  const api = installApiMock()
  vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
  let settle: (result: Result<ChatReply>) => void = () => {}
  vi.mocked(api.ai.chat).mockReturnValue(
    new Promise<Result<ChatReply>>((resolve) => {
      settle = resolve
    })
  )
  let emit: ((event: JobEvent) => void) | undefined
  vi.mocked(api.job.onEvent).mockImplementation((listener) => {
    emit = listener
    return vi.fn()
  })
  const user = userEvent.setup()

  renderView()
  await whenReady()
  await user.type(screen.getByPlaceholderText(PROMPT), 'oi')
  await user.click(screen.getByRole('button', { name: 'Enviar' }))

  const jobId = vi.mocked(api.ai.chat).mock.calls[0]?.[1] as JobEvent['jobId']
  if (chunk !== undefined) act(() => emit?.({ jobId, type: 'chunk', text: chunk }))
  await act(async () => settle({ ok: false, error }))
  return api
}

describe('ConversationView', () => {
  it('shows the hint and disables the composer when Ollama is unavailable', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue({
      ok: false,
      error: { kind: 'unavailable', service: 'ollama', hint: 'Rode ollama serve na porta 11434.' }
    })

    renderView()

    expect(await screen.findByRole('alert')).toHaveTextContent('ollama serve')
    expect(screen.getByPlaceholderText(PROMPT)).toBeDisabled()
  })

  it('retries the probe when "Tentar novamente" is clicked', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValueOnce({
      ok: false,
      error: { kind: 'unavailable', service: 'ollama', hint: 'Rode ollama serve na porta 11434.' }
    })
    const user = userEvent.setup()

    renderView()
    await screen.findByRole('alert')
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await whenReady()

    expect(api.ai.isAvailable).toHaveBeenCalledTimes(2)
  })

  it('sends the prompt and renders the assistant reply', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'Olá!' } })
    const user = userEvent.setup()

    renderView()
    await whenReady()
    await user.type(screen.getByPlaceholderText(PROMPT), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText('Olá!')).toBeInTheDocument()
    // The title is the first user message truncated (D13.9), so the text is on
    // screen twice — as the heading and as the message. Both are asserted: the
    // heading is the behaviour, the <p> is the message itself.
    expect(screen.getByRole('heading', { name: 'oi' })).toBeInTheDocument()
    expect(screen.getByText('oi', { selector: 'p' })).toBeInTheDocument()
    expect(api.ai.chat).toHaveBeenCalledWith(
      {
        service: 'ollama',
        model: 'gemma3:4b',
        // ai:chat carries Message[] now (D17.5) — main materializes the
        // provider's flat shape; that claim moved to a level-3 test of the
        // handler (main/features/ai/handlers.test.ts).
        messages: [
          { id: 'draft', role: 'user', parts: [{ kind: 'text', text: 'oi' }], createdAt: 0 }
        ],
        numThread: 4,
        // Sent explicitly since plano 15. Leaving it out is what left Ollama's
        // own default of 4096 in charge — a number nobody chose, and one a
        // single 8k-token document overflows on its own, in silence.
        numCtx: 32768
      },
      expect.any(String)
    )
  })

  it('cancels the in-flight job with the jobId used for the chat', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.chat).mockReturnValue(new Promise<Result<ChatReply>>(() => {}))
    const user = userEvent.setup()

    renderView()
    await whenReady()
    await user.type(screen.getByPlaceholderText(PROMPT), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))

    const usedJobId = vi.mocked(api.ai.chat).mock.calls[0]?.[1]
    expect(api.job.cancel).toHaveBeenCalledWith(usedJobId)
  })

  it('carries the whole history into the next call, not just the new prompt', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'r1' } })
    const user = userEvent.setup()

    renderView()
    await whenReady()
    await user.type(screen.getByPlaceholderText(PROMPT), 'p1')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('r1')

    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'r2' } })
    await user.type(screen.getByPlaceholderText(PROMPT), 'p2')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('r2')

    // The turns come from the store now, so this is the assertion that the
    // store round-trip did not lose the conversation. ai:chat carries
    // Message[] (D17.5) — stored turns have a real id/createdAt, the draft
    // has the placeholder ones useConversationChat always uses.
    expect(vi.mocked(api.ai.chat).mock.calls[1]?.[0].messages).toEqual([
      {
        id: expect.any(String),
        role: 'user',
        parts: [{ kind: 'text', text: 'p1' }],
        createdAt: expect.any(Number)
      },
      {
        id: expect.any(String),
        role: 'assistant',
        parts: [{ kind: 'text', text: 'r1' }],
        createdAt: expect.any(Number),
        model: 'gemma3:4b'
      },
      { id: 'draft', role: 'user', parts: [{ kind: 'text', text: 'p2' }], createdAt: 0 }
    ])
  })
})

// The level-2 test the plan asks for: two conversations, each history its own.
describe('ConversationView — troca de conversa', () => {
  it('preserves each conversation history when switching between them', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'resposta A' } })
    const user = userEvent.setup()

    renderShell()
    await whenReady()

    await user.type(screen.getByPlaceholderText(PROMPT), 'pergunta A')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('resposta A')

    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'resposta B' } })
    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))
    await user.type(screen.getByPlaceholderText(PROMPT), 'pergunta B')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('resposta B')

    expect(screen.queryByText('resposta A')).not.toBeInTheDocument()

    // The title comes from the first user message (D13.9), so the row is
    // findable by what was typed into it.
    await user.click(screen.getByRole('button', { name: 'pergunta A' }))

    expect(await screen.findByText('resposta A')).toBeInTheDocument()
    expect(screen.queryByText('resposta B')).not.toBeInTheDocument()
  })

  it('keeps a stream out of a conversation it does not belong to', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.chat).mockReturnValue(new Promise<Result<ChatReply>>(() => {}))
    let emit: ((event: JobEvent) => void) | undefined
    vi.mocked(api.job.onEvent).mockImplementation((listener) => {
      emit = listener
      return vi.fn()
    })
    const user = userEvent.setup()

    renderShell()
    await whenReady()
    await user.type(screen.getByPlaceholderText(PROMPT), 'pergunta A')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    const jobId = vi.mocked(api.ai.chat).mock.calls[0]?.[1] as JobEvent['jobId']
    act(() => emit?.({ jobId, type: 'chunk', text: 'chegando' }))
    expect(screen.getByText('chegando')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))

    // The reply is addressed to the conversation it was sent from — showing it
    // under the new one would be the answer landing in the wrong transcript.
    expect(screen.queryByText('chegando')).not.toBeInTheDocument()
  })

  it('renames a conversation from the sidebar', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    const user = userEvent.setup()

    renderShell()
    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))
    await user.click(screen.getByRole('button', { name: 'Mais ações para Nova conversa' }))
    // hidden: true — see the Popover shim in test/setup-renderer.ts.
    await user.click(
      screen.getByRole('button', { name: 'Editar título de Nova conversa', hidden: true })
    )
    await user.type(screen.getByLabelText('Novo título da conversa'), 'Vendas{Enter}')

    expect(screen.getByRole('button', { name: 'Nova conversaVendas' })).toBeInTheDocument()
  })

  it('removes a conversation and elects the remaining one', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'resposta A' } })
    const user = userEvent.setup()

    renderShell()
    await whenReady()
    await user.type(screen.getByPlaceholderText(PROMPT), 'pergunta A')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('resposta A')
    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))

    await user.click(screen.getByRole('button', { name: 'Mais ações para Nova conversa' }))
    // hidden: true — same jsdom limitation noted above.
    await user.click(screen.getByRole('button', { name: 'Excluir Nova conversa', hidden: true }))

    expect(
      screen.queryByRole('button', { name: 'Mais ações para Nova conversa' })
    ).not.toBeInTheDocument()
    expect(await screen.findByText('resposta A')).toBeInTheDocument()
  })
})

// Settings is machine scale (D13.4) and a modal, not a destination (D13.8).
// That it does not unmount the conversation is verified live, with a reply
// actually streaming; what is asserted here is the half a unit test can see —
// the new value reaching the next call, and the conversation still on screen.
describe('Configurações', () => {
  it('applies the new num_thread to the next call, leaving the transcript in place', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'r1' } })
    const user = userEvent.setup()

    renderShell()
    await whenReady()
    await user.type(screen.getByPlaceholderText(PROMPT), 'p1')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('r1')

    expect(vi.mocked(api.ai.chat).mock.calls[0]?.[0].numThread).toBe(4)

    await user.click(screen.getByRole('button', { name: 'Configurações' }))
    const threads = screen.getByRole('group', { name: 'Threads de CPU' })
    await user.click(within(threads).getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    // The conversation was never replaced — the reply is still there.
    expect(screen.getByText('r1')).toBeInTheDocument()

    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'r2' } })
    await user.type(screen.getByPlaceholderText(PROMPT), 'p2')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('r2')

    expect(vi.mocked(api.ai.chat).mock.calls[1]?.[0].numThread).toBe(2)
  })

  it('keeps the value across a remount — the level-2 shadow of reopening the app', async () => {
    const api = installApiMock()
    const user = userEvent.setup()

    const first = render(providers(<Settings />))
    await user.click(screen.getByRole('button', { name: 'Configurações' }))
    const firstThreads = screen.getByRole('group', { name: 'Threads de CPU' })
    await user.click(within(firstThreads).getByRole('button', { name: '2' }))
    // The whole current settings object, not a true patch — setSettings spreads
    // `previous` (DS-4 passo 6: `theme` rides along once it exists).
    await waitFor(() =>
      expect(api.settings.write).toHaveBeenCalledWith({ numThread: 2, theme: 'system' })
    )
    first.unmount()

    // Same window.api, so the same database — but a brand new tree and a brand
    // new QueryClient. That is as close as level 2 gets to closing the app; the
    // real close-and-reopen is the level-4 spec, and only it can prove the rest.
    render(providers(<Settings />))
    await user.click(screen.getByRole('button', { name: 'Configurações' }))

    const threads = await screen.findByRole('group', { name: 'Threads de CPU' })
    expect(within(threads).getByRole('button', { name: '2' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('changes the theme from the sidebar (DS-4 passo 6)', async () => {
    const api = installApiMock()
    const user = userEvent.setup()

    render(providers(<Settings />))
    await user.click(screen.getByRole('button', { name: 'Configurações' }))
    const theme = screen.getByRole('group', { name: 'Aparência' })

    expect(within(theme).getByRole('button', { name: 'Sistema' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await user.click(within(theme).getByRole('button', { name: 'Escuro' }))

    await waitFor(() =>
      expect(api.settings.write).toHaveBeenCalledWith({ numThread: 4, theme: 'dark' })
    )
    expect(within(theme).getByRole('button', { name: 'Escuro' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})

// The assistant reply is markdown; these assert the structure produced, queried
// by role rather than by whole phrase (D11.7). The user's own message stays raw.
describe('ConversationView — markdown da resposta', () => {
  it('renders bold and a list, with no raw asterisk on screen', async () => {
    await reply('**forte** com:\n\n- um\n- dois')

    // The thread is itself an <ol>, so target the markdown <ul> by its items.
    const um = await screen.findByText('um')
    expect(um.closest('ul')).not.toBeNull()
    expect(screen.getByText('dois')).toBeInTheDocument()
    expect(screen.getByText('forte').tagName).toBe('STRONG')
    expect(screen.queryByText(/\*\*/)).toBeNull()
  })

  it('renders a fenced code block preserving line breaks', async () => {
    const { container } = await reply('Veja:\n\n```csv\nID,Nome\nA,B\n```')

    await screen.findByText('Veja:')
    const pre = container.querySelector('pre')
    expect(pre?.textContent).toContain('ID,Nome')
    expect(pre?.textContent).toContain('A,B')
  })

  it('renders a GFM table', async () => {
    await reply('| a | b |\n| --- | --- |\n| 1 | 2 |')

    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('opens an external link through the shell instead of navigating', async () => {
    const { api } = await reply('Veja [aqui](https://exemplo.com).')
    vi.mocked(api.shell.openExternal).mockResolvedValue({ ok: true, value: undefined })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('link', { name: 'aqui' }))

    expect(api.shell.openExternal).toHaveBeenCalledWith('https://exemplo.com')
  })

  it('renders a relative link as plain text, never as an anchor', async () => {
    const { api } = await reply('Veja o [guia](/guia).')

    expect(await screen.findByText(/guia/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(api.shell.openExternal).not.toHaveBeenCalled()
  })

  it('renders injected HTML inert — no img element reaches the DOM', async () => {
    const { container } = await reply('<img src=x onerror=alert(1)> fim')

    await screen.findByText(/fim/)
    // Without rehype-raw, react-markdown renders the raw HTML as literal text —
    // inert, never a DOM element. Asserting the `onerror` string is present (not
    // just that <img> is absent) is what catches someone adding rehype-raw later.
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('onerror')
  })

  it('keeps the user message literal, even with markdown syntax', async () => {
    await reply('resposta', '**oi**')

    // Scoped to the <p>: the heading carries the same text, since the title is
    // derived from this very message (D13.9).
    expect(await screen.findByText('**oi**', { selector: 'p' })).toBeInTheDocument()
  })
})

// Syntax highlighting (fase 12). The palette's contrast is measured elsewhere,
// in tokens.contrast.test.ts; what these assert is that the right hljs-* class
// lands on the right token — the half that CSS cannot fix if it is wrong.
describe('ConversationView — realce de sintaxe', () => {
  it('colours SQL keywords in a closed fenced block', async () => {
    const { container } = await reply('```sql\nSELECT name FROM users\n```')

    await screen.findByText('sql')
    expect(container.querySelector('.hljs-keyword')?.textContent).toBe('SELECT')
  })

  it('keeps a fence with no language uncoloured, and its text intact', async () => {
    const { container } = await reply('```\nSELECT 1\n```')

    // D12.5: no info string, no colour — the same rule GitHub applies, and what
    // keeps `detect` off from being a silent guess on a two-line snippet.
    expect(await screen.findByText('SELECT 1')).toBeInTheDocument()
    expect(container.querySelector('[class^="hljs-"]')).toBeNull()
  })

  it('puts an html tag and its attribute in different groups', async () => {
    const { container } = await reply('```html\n<div class="x">a</div>\n```')

    await screen.findByText('html')
    // This pair is the whole reason --syntax-tag diverges from Primer's light
    // theme (D12.4): Primer collapses entityTag onto constant there, which would
    // paint `div` and `class` the same colour while highlight.js keeps them apart.
    expect(container.querySelector('.hljs-name')?.textContent).toBe('div')
    expect(container.querySelector('.hljs-attr')?.textContent).toBe('class')
  })

  it('resolves a language alias — py reaches the python grammar', async () => {
    const { container } = await reply('```py\ndef soma(a, b):\n    return a + b\n```')

    await screen.findByText('py')
    expect(container.querySelector('.hljs-keyword')?.textContent).toBe('def')
    expect(container.querySelector('.hljs-title')?.textContent).toBe('soma')
  })

  it('still renders a script inside a fence as inert text', async () => {
    const { container } = await reply('```html\n<script>alert(1)</script>\n```')

    await screen.findByText('html')
    // The fase 11 guarantee must survive a rehype plugin being added (D12.2):
    // rehype-highlight only decorates the tree, so this stays text, not a node.
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('alert(1)')
  })

  it('leaves a still-streaming block uncoloured until the reply lands', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.chat).mockReturnValue(new Promise<Result<ChatReply>>(() => {}))
    let emit: ((event: JobEvent) => void) | undefined
    vi.mocked(api.job.onEvent).mockImplementation((listener) => {
      emit = listener
      return vi.fn()
    })
    const user = userEvent.setup()

    const container = renderView()
    await whenReady()
    await user.type(screen.getByPlaceholderText(PROMPT), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    const jobId = vi.mocked(api.ai.chat).mock.calls[0]?.[1] as JobEvent['jobId']
    act(() => emit?.({ jobId, type: 'chunk', text: '```sql\nSELECT nam' }))

    // completePartial closes the fence, so this IS a well-formed block — the
    // absence of colour comes from highlight={false}, not from broken markdown.
    expect(container.querySelector('pre')?.textContent).toContain('SELECT nam')
    expect(container.querySelector('[class^="hljs-"]')).toBeNull()
  })
})

// D16.4/D16.5: the card is its own element in the transcript, never inlined
// into the bubble — and what the provider receives materializes it anyway.
describe('ConversationView — anexo de dataset', () => {
  it('draws the card in the transcript and sends the dataset part on the payload', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/vendas.csv' } })
    vi.mocked(api.dataset.attach).mockResolvedValue({
      ok: true,
      value: {
        kind: 'dataset',
        hash: 'h1',
        fileName: 'vendas.csv',
        delimiter: ',',
        columns: ['id', 'valor'],
        rowCount: 3
      }
    })
    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'ok' } })
    const user = userEvent.setup()

    renderView()
    await whenReady()
    await user.click(screen.getByRole('button', { name: 'Adicionar anexo' }))
    await user.click(screen.getByRole('button', { name: 'Dados tabulares', hidden: true }))
    await screen.findByText('vendas.csv')

    await user.type(screen.getByPlaceholderText(PROMPT), 'o que tem aqui?')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    // The card is its own element (D16.4 Passo 4) — the bubble stays literal.
    expect(await screen.findByText('2 colunas · 3 linhas')).toBeInTheDocument()
    expect(screen.getByText('o que tem aqui?', { selector: 'p' })).toBeInTheDocument()

    // ai:chat carries Message[] now (D17.5) — the composer's job is to attach
    // the right PART, not to materialize it into text; that claim moved to a
    // level-3 test of the handler (main/features/ai/handlers.test.ts).
    const sentParts = vi.mocked(api.ai.chat).mock.calls[0]?.[0].messages[0]?.parts
    expect(sentParts).toEqual([
      {
        kind: 'dataset',
        hash: 'h1',
        fileName: 'vendas.csv',
        delimiter: ',',
        columns: ['id', 'valor'],
        rowCount: 3
      },
      { kind: 'text', text: 'o que tem aqui?' }
    ])
  })
})

function bigDatasetPart(columnCount: number): DatasetPart {
  return {
    kind: 'dataset',
    hash: 'big-hash',
    fileName: 'grande.csv',
    delimiter: ',',
    columns: Array.from({ length: columnCount }, (_, i) => `c${i}`),
    rowCount: 1000
  }
}

// D16.5's own defect, reproduced before the fix: the gate must measure what is
// actually SENT, not the transcript's messageText. A 30-token window cannot
// hold an 80-column card no matter how it is counted — the question is
// whether the app notices before or after sending it.
describe('ConversationView — o medidor mede o payload, não a transcrição (D16.5)', () => {
  it('refuses a send once a HISTORICAL dataset card is counted, not just its text', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    const conversationId = 'c-history-leak'
    await api.conversation.create({ id: conversationId, title: 'Vendas', createdAt: 1 })
    await api.conversation.updateSettings(conversationId, { model: 'gemma3:4b', numCtx: 30 })
    await api.conversation.append(conversationId, {
      id: 'm1',
      role: 'user',
      parts: [bigDatasetPart(80), { kind: 'text', text: 'oi' }],
      createdAt: 1
    })
    const user = userEvent.setup()

    renderView()
    await whenReady()
    await user.type(screen.getByPlaceholderText(PROMPT), 'e')

    // The card the model actually reads is hundreds of characters; a 30-token
    // window cannot hold it. Reading only messageText ("oi") would report it
    // fitting — the defect this test exists to catch.
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  it('refuses a send once a PENDING attachment is counted, before it is ever sent', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    const conversationId = 'c-pending-leak'
    await api.conversation.create({ id: conversationId, title: 'Vendas', createdAt: 1 })
    await api.conversation.updateSettings(conversationId, { model: 'gemma3:4b', numCtx: 30 })
    await api.conversation.append(conversationId, {
      id: 'm1',
      role: 'user',
      parts: [{ kind: 'text', text: 'oi' }],
      createdAt: 1
    })
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/grande.csv' } })
    vi.mocked(api.dataset.attach).mockResolvedValue({ ok: true, value: bigDatasetPart(80) })
    const user = userEvent.setup()

    renderView()
    await whenReady()
    await user.click(screen.getByRole('button', { name: 'Adicionar anexo' }))
    await user.click(screen.getByRole('button', { name: 'Dados tabulares', hidden: true }))
    await screen.findByText('grande.csv')
    await user.type(screen.getByPlaceholderText(PROMPT), 'e')

    // Nothing was SENT yet — the attachment sits pending, like the draft
    // (D16.6). A gate reading only draft.length sees one character and
    // reports fitting; the card it is about to send does not fit.
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })
})

// D14.3: what arrived is kept, marked. A conversation that discards half an
// answer lies by omission — you remember asking, and the transcript shows the
// question with nothing under it.
describe('ConversationView — resposta interrompida', () => {
  it('keeps a cancelled partial, marked as cancelled by the user', async () => {
    const api = await interrupted({ kind: 'cancelled' }, 'A resposta ia por aqui')

    expect(await screen.findByText(/interrompida por você/)).toBeInTheDocument()
    expect(screen.getByText('A resposta ia por aqui')).toBeInTheDocument()
    expect(vi.mocked(api.conversation.append).mock.calls[1]?.[1]).toMatchObject({
      role: 'assistant',
      stopped: 'cancelled'
    })
  })

  it('keeps a timed-out partial, marked with the OTHER reason', async () => {
    // The two are distinguishable because the handler's `timedOut` flag maps
    // them to different AppErrors. Collapsing them would tell the user their
    // own cancel took five minutes.
    await interrupted({ kind: 'timeout', afterMs: 300_000 }, 'Metade de uma frase')

    expect(await screen.findByText(/tempo esgotado/)).toBeInTheDocument()
    expect(screen.getByText('Metade de uma frase')).toBeInTheDocument()
  })

  it('writes nothing when the interruption arrives before the first token', async () => {
    const api = await interrupted({ kind: 'cancelled' })

    expect(screen.queryByText(/interrompida/)).toBeNull()
    // One append only — the user's own message. An empty assistant turn is
    // noise, not honesty.
    expect(api.conversation.append).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.conversation.append).mock.calls[0]?.[1]).toMatchObject({ role: 'user' })
  })

  it('writes nothing when the service was unreachable, partial or not', async () => {
    // The failure is of the CALL, not a reply cut short. A marker here would
    // claim an answer started when none did.
    const api = await interrupted(
      { kind: 'unavailable', service: 'ollama', hint: 'Rode ollama serve.' },
      'texto que nao deveria sobreviver'
    )

    expect(api.conversation.append).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/interrompida/)).toBeNull()
  })
})

/*
 * Plano 17, passo 8 — the three attachment kinds coexisting, each in its own
 * message (D17.3: one pending slot, never a mix in a single turn). Every kind
 * has its own dedicated coverage elsewhere (AttachButton.test.tsx for the
 * pick/attach flow, modelSelection.test.tsx for the image gate); what this
 * test alone proves is that sending one kind after another in the SAME
 * conversation does not leak state between turns — each card renders from
 * its OWN message's part, not a stale one left over from the last send.
 */
describe('ConversationView — os três tipos de anexo numa conversa', () => {
  const DATASET: DatasetPart = {
    kind: 'dataset',
    hash: 'h-dataset',
    fileName: 'vendas.csv',
    delimiter: ',',
    columns: ['id', 'valor'],
    rowCount: 10
  }
  const DOCUMENT: DocumentPart = {
    kind: 'document',
    hash: 'h-document',
    fileName: 'especificacao.md',
    format: 'md',
    text: 'a coluna id é a chave primária'
  }
  const IMAGE: ImagePart = {
    kind: 'image',
    hash: 'h-image',
    fileName: 'grafico.png',
    mimeType: 'image/png'
  }

  it('sends a dataset, a document, and an image as three separate messages', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'ok' } })
    vi.mocked(api.dataset.pick).mockResolvedValue({ ok: true, value: { path: '/vendas.csv' } })
    vi.mocked(api.dataset.attach).mockResolvedValue({ ok: true, value: DATASET })
    vi.mocked(api.document.pick).mockResolvedValue({ ok: true, value: { path: '/spec.md' } })
    vi.mocked(api.document.attach).mockResolvedValue({ ok: true, value: DOCUMENT })
    vi.mocked(api.image.pick).mockResolvedValue({ ok: true, value: { path: '/grafico.png' } })
    vi.mocked(api.image.attach).mockResolvedValue({ ok: true, value: IMAGE })
    const user = userEvent.setup()

    renderView()
    await whenReady()

    await user.click(screen.getByRole('button', { name: 'Adicionar anexo' }))
    await user.click(screen.getByRole('button', { name: 'Dados tabulares', hidden: true }))
    await screen.findByText('vendas.csv')
    await user.type(screen.getByPlaceholderText(PROMPT), 'o que tem nesse arquivo?')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('ok')

    await user.click(screen.getByRole('button', { name: 'Adicionar anexo' }))
    await user.click(screen.getByRole('button', { name: 'Documentos', hidden: true }))
    await screen.findByText('especificacao.md')
    await user.type(screen.getByPlaceholderText(PROMPT), 'o que diz a especificação?')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await user.click(screen.getByRole('button', { name: 'Adicionar anexo' }))
    await user.click(screen.getByRole('button', { name: 'Imagens', hidden: true }))
    await screen.findByText('grafico.png')
    await user.type(screen.getByPlaceholderText(PROMPT), 'o que é esse gráfico?')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    // All three cards on screen at once, each still carrying its OWN part —
    // the failure mode this guards is a card rendering the PREVIOUS turn's
    // attachment because state leaked across sends.
    expect(await screen.findByText('vendas.csv')).toBeInTheDocument()
    expect(screen.getByText('2 colunas · 10 linhas')).toBeInTheDocument()
    expect(screen.getByText('especificacao.md')).toBeInTheDocument()
    expect(screen.getByText('MD')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'grafico.png' })).toHaveAttribute(
      'src',
      'attachment://h-image'
    )

    // Three user turns, three assistant replies — none merged or dropped.
    // Scoped to the message list: the header <h1> echoes the first message's
    // text as the conversation's title (D13.9), which would double-count it.
    const thread = within(screen.getByRole('list'))
    expect(thread.getAllByText('o que tem nesse arquivo?')).toHaveLength(1)
    expect(thread.getAllByText('o que diz a especificação?')).toHaveLength(1)
    expect(thread.getAllByText('o que é esse gráfico?')).toHaveLength(1)
    expect(thread.getAllByText('ok')).toHaveLength(3)
  })
})
