import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import type { Api, AppError, ChatReply, JobEvent, Result } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import SettingsProvider from '../settings/SettingsProvider'
import Settings from '../settings/Settings'
import ConversationsProvider from './ConversationsProvider'
import ConversationList from './ConversationList'
import ConversationView from './ConversationView'
import NewConversationButton from './NewConversationButton'

const ready = { ok: true, value: { service: 'ollama', version: '0.5.1' } } as const

const PROMPT = 'Pergunte algo ao modelo…'

/*
 * The only thing plano 14 changed in this file is this wrapper — the server
 * cache needs its provider, and a fresh QueryClient per test keeps them from
 * sharing state. Every assertion below is the fase-13 one, unchanged, which is
 * exactly what step 3 existed to collect on (D13.2).
 */
function providers(children: ReactNode): React.JSX.Element {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <SettingsProvider>
        <ConversationsProvider>{children}</ConversationsProvider>
      </SettingsProvider>
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
  await screen.findByText('Ollama 0.5.1')
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
  await screen.findByText('Ollama 0.5.1')
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

  it('sends the prompt and renders the assistant reply', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'Olá!' } })
    const user = userEvent.setup()

    renderView()
    await screen.findByText('Ollama 0.5.1')
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
        messages: [{ role: 'user', content: 'oi' }],
        numThread: 4
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
    await screen.findByText('Ollama 0.5.1')
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
    await screen.findByText('Ollama 0.5.1')
    await user.type(screen.getByPlaceholderText(PROMPT), 'p1')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('r1')

    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'r2' } })
    await user.type(screen.getByPlaceholderText(PROMPT), 'p2')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('r2')

    // The turns come from the store now, so this is the assertion that the
    // store round-trip did not lose the conversation.
    expect(vi.mocked(api.ai.chat).mock.calls[1]?.[0].messages).toEqual([
      { role: 'user', content: 'p1' },
      { role: 'assistant', content: 'r1' },
      { role: 'user', content: 'p2' }
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
    await screen.findByText('Ollama 0.5.1')

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
    await screen.findByText('Ollama 0.5.1')
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
    await user.click(screen.getByRole('button', { name: 'Renomear Nova conversa' }))
    await user.type(screen.getByLabelText('Novo título da conversa'), 'Vendas{Enter}')

    expect(screen.getByRole('button', { name: 'Nova conversaVendas' })).toBeInTheDocument()
  })

  it('removes a conversation and elects the remaining one', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'resposta A' } })
    const user = userEvent.setup()

    renderShell()
    await screen.findByText('Ollama 0.5.1')
    await user.type(screen.getByPlaceholderText(PROMPT), 'pergunta A')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('resposta A')
    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))

    await user.click(screen.getByRole('button', { name: 'Excluir Nova conversa' }))

    expect(screen.queryByRole('button', { name: 'Excluir Nova conversa' })).not.toBeInTheDocument()
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
    await screen.findByText('Ollama 0.5.1')
    await user.type(screen.getByPlaceholderText(PROMPT), 'p1')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('r1')

    expect(vi.mocked(api.ai.chat).mock.calls[0]?.[0].numThread).toBe(4)

    await user.click(screen.getByRole('button', { name: 'Configurações' }))
    const threads = screen.getByLabelText('Threads de CPU')
    await user.clear(threads)
    await user.type(threads, '2')
    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    // The conversation was never replaced — the reply is still there.
    expect(screen.getByText('r1')).toBeInTheDocument()

    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'r2' } })
    await user.type(screen.getByPlaceholderText(PROMPT), 'p2')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('r2')

    expect(vi.mocked(api.ai.chat).mock.calls[1]?.[0].numThread).toBe(2)
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
    await screen.findByText('Ollama 0.5.1')
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
