import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock, TEST_MODEL } from '@test/api-mock'
import type { AiModel, Api } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import ConversationsProvider from './ConversationsProvider'
import ConversationList from './ConversationList'
import ConversationView from './ConversationView'
import NewConversationButton from './NewConversationButton'

/*
 * Level 2 for the selector that replaced the free-text model input (D15.1,
 * D15.2, D15.7). The store half of the api mock is backed by the REAL
 * conversation handlers against ':memory:', so "each conversation keeps its own
 * model" is exercised through the same json_patch the app ships.
 */

const ready = { ok: true, value: { service: 'ollama', version: '0.5.1' } } as const
const PROMPT = 'Pergunte algo ao modelo…'

/** A second model, with a capability the app had no word for until it arrived. */
const CODER: AiModel = {
  provider: 'ollama',
  name: 'qwen2.5-coder:3b',
  parameterSize: '3.1B',
  sizeBytes: 1_929_000_000,
  capabilities: ['completion', 'tools', 'insert'],
  contextLength: 32768,
  attention: { blockCount: 36, headCountKv: 2, headDim: 128, slidingWindow: null }
}

function providers(children: ReactNode): React.JSX.Element {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <ConversationsProvider>{children}</ConversationsProvider>
    </QueryClientProvider>
  )
}

function mount(): Api {
  const api = installApiMock()
  vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
  vi.mocked(api.ai.models).mockResolvedValue({ ok: true, value: [TEST_MODEL, CODER] })
  vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'pronto' } })
  render(
    providers(
      <>
        <NewConversationButton />
        <ConversationList />
        <ConversationView />
      </>
    )
  )
  return api
}

function selector(): HTMLSelectElement {
  return screen.getByLabelText('Modelo') as HTMLSelectElement
}

describe('ModelSelector', () => {
  it('lists the installed models with size and context ceiling', async () => {
    mount()

    await screen.findByRole('option', { name: /gemma3:4b/ })
    // The option text is what the catalog knows, which is the whole reason for
    // the extra /api/show per model: neither number exists in /api/tags.
    expect(screen.getByRole('option', { name: /gemma3:4b/ })).toHaveTextContent('3,1 GB')
    expect(screen.getByRole('option', { name: /gemma3:4b/ })).toHaveTextContent('128k')
    expect(screen.getByRole('option', { name: /qwen2\.5-coder:3b/ })).toHaveTextContent('32k')
  })

  it('preselects the first installed model instead of a hardcoded name', async () => {
    mount()

    await waitFor(() => expect(selector().value).toBe('gemma3:4b'))
  })

  it('badges vision on the model that has it, and nothing else', async () => {
    mount()

    await screen.findByText('imagem')
    expect(screen.queryByText('ferramentas')).not.toBeInTheDocument()
  })

  it('renders an unknown capability under its raw name', async () => {
    // `insert` arrived with the qwen2.5-coder models and the app has no word
    // for it. Showing it raw is what keeps the string[] decision honest on
    // screen: a closed list would silently drop it.
    const user = userEvent.setup()
    mount()
    await screen.findByRole('option', { name: /qwen/ })

    await user.selectOptions(selector(), 'qwen2.5-coder:3b')

    expect(await screen.findByText('insert')).toBeInTheDocument()
    expect(screen.getByText('ferramentas')).toBeInTheDocument()
  })

  it('sends the chosen model, not the default one', async () => {
    const user = userEvent.setup()
    const api = mount()
    await screen.findByRole('option', { name: /qwen/ })

    await user.selectOptions(selector(), 'qwen2.5-coder:3b')
    await user.type(screen.getByPlaceholderText(PROMPT), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() =>
      expect(api.ai.chat).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'qwen2.5-coder:3b' }),
        expect.any(String)
      )
    )
  })

  it('keeps a model per conversation, not per window', async () => {
    // The point of storing it in the conversation's `settings` rather than in
    // component state: switching away and back has to restore what THAT
    // conversation was using.
    const user = userEvent.setup()
    mount()
    await screen.findByRole('option', { name: /qwen/ })

    // Captured once, while it is still the only thing by that name: a created
    // conversation carries DEFAULT_TITLE, which IS 'Nova conversa', so after the
    // first click the query matches two buttons. Same family as the `exact:
    // true` rule the testing skill records for per-row actions.
    const newConversation = screen.getByRole('button', { name: 'Nova conversa' })

    await user.click(newConversation)
    await user.selectOptions(selector(), 'qwen2.5-coder:3b')
    await waitFor(() => expect(selector().value).toBe('qwen2.5-coder:3b'))

    await user.click(newConversation)

    // The second conversation chose nothing, so it falls back to the catalog's
    // first entry — it does not inherit the previous conversation's pick.
    await waitFor(() => expect(selector().value).toBe('gemma3:4b'))
  })

  it('records the model on a conversation that the send itself created', async () => {
    // Typing into an empty app creates the conversation (D13.9), and that row
    // is born with empty settings. Without this, the transcript would say the
    // reply came from qwen while reopening the conversation showed gemma —
    // the row and its own messages telling different stories.
    const user = userEvent.setup()
    const api = mount()
    await screen.findByRole('option', { name: /qwen/ })

    await user.selectOptions(selector(), 'qwen2.5-coder:3b')
    await user.type(screen.getByPlaceholderText(PROMPT), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() =>
      expect(api.conversation.updateSettings).toHaveBeenCalledWith(expect.any(String), {
        model: 'qwen2.5-coder:3b'
      })
    )
  })

  it('says so when the machine has no model installed', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.models).mockResolvedValue({ ok: true, value: [] })
    render(providers(<ConversationView />))

    // An empty catalog is a legitimate state, not a red error card: a fresh
    // Ollama with nothing pulled needs "install a model", not "something broke".
    expect(await screen.findByText('Nenhum modelo instalado.')).toBeInTheDocument()
  })

  it('degrades to a legible state instead of breaking when the catalog fails', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.models).mockResolvedValue({
      ok: false,
      error: { kind: 'unavailable', service: 'ollama', hint: 'Rode ollama serve.' }
    })
    render(providers(<ConversationView />))

    await screen.findByText('Ollama 0.5.1')
    // The composer and the rest of the view still render; only the selector is
    // in an error state. A catalog that fails must not take the screen with it.
    expect(screen.getByPlaceholderText(PROMPT)).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('refetches the catalog when asked, because installing a model is invisible', async () => {
    const user = userEvent.setup()
    const api = mount()
    await screen.findByRole('option', { name: /qwen/ })
    expect(api.ai.models).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Recarregar a lista de modelos' }))

    await waitFor(() => expect(api.ai.models).toHaveBeenCalledTimes(2))
  })
})
