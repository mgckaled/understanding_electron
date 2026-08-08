import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import type { Api, ChatReply, JobEvent, Result } from '@shared/ipc'
import AiChatPanel from './AiChatPanel'

const ready = { ok: true, value: { service: 'ollama', version: '0.5.1' } } as const

const PROMPT = 'Pergunte algo ao modelo…'

/** Drives a full send and resolves the reply, returning the rendered container. */
async function reply(
  content: string,
  prompt = 'oi'
): Promise<{ api: Api; container: HTMLElement }> {
  const api = installApiMock()
  vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
  vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content } })
  const user = userEvent.setup()
  const { container } = render(<AiChatPanel />)
  await screen.findByText('Ollama 0.5.1')
  await user.type(screen.getByPlaceholderText(PROMPT), prompt)
  await user.click(screen.getByRole('button', { name: 'Enviar' }))
  return { api, container }
}

describe('AiChatPanel', () => {
  it('shows the hint and disables the input when Ollama is unavailable', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue({
      ok: false,
      error: { kind: 'unavailable', service: 'ollama', hint: 'Rode ollama serve na porta 11434.' }
    })

    render(<AiChatPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('ollama serve')
    expect(screen.getByPlaceholderText('Pergunte algo ao modelo…')).toBeDisabled()
  })

  it('sends the prompt and renders the assistant reply', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'Olá!' } })
    const user = userEvent.setup()

    render(<AiChatPanel />)
    await screen.findByText('Ollama 0.5.1')
    await user.type(screen.getByPlaceholderText('Pergunte algo ao modelo…'), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText('Olá!')).toBeInTheDocument()
    expect(screen.getByText('oi')).toBeInTheDocument()
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

    render(<AiChatPanel />)
    await screen.findByText('Ollama 0.5.1')
    await user.type(screen.getByPlaceholderText('Pergunte algo ao modelo…'), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))

    const usedJobId = vi.mocked(api.ai.chat).mock.calls[0]?.[1]
    expect(api.job.cancel).toHaveBeenCalledWith(usedJobId)
  })
})

// The assistant reply is markdown; these assert the structure produced, queried
// by role rather than by whole phrase (D11.7). The user's own message stays raw.
describe('AiChatPanel — markdown da resposta', () => {
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

    expect(await screen.findByText('**oi**')).toBeInTheDocument()
  })
})

// Syntax highlighting (fase 12). The palette's contrast is measured elsewhere,
// in tokens.contrast.test.ts; what these assert is that the right hljs-* class
// lands on the right token — the half that CSS cannot fix if it is wrong.
describe('AiChatPanel — realce de sintaxe', () => {
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

    const { container } = render(<AiChatPanel />)
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
