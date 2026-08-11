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
  attention: { blockCount: 36, headCountKv: 2, headDim: 128, slidingWindow: null },
  variantOf: null
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

  it('records the whole pair on the send that creates the conversation', async () => {
    // The lock is only as good as what it writes down (D15.13). Recording the
    // model alone would leave the window still derived from live free RAM —
    // grey control, floating value.
    const user = userEvent.setup()
    const api = mount()
    await screen.findByRole('option', { name: /qwen/ })

    await user.selectOptions(selector(), 'qwen2.5-coder:3b')
    await user.type(screen.getByPlaceholderText(PROMPT), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() =>
      expect(api.conversation.updateSettings).toHaveBeenCalledWith(expect.any(String), {
        model: 'qwen2.5-coder:3b',
        numCtx: 32768
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

  it('rereads free memory on reload, because the advice depends on it', async () => {
    // "Feche aplicativos e recarregue" is only true if the button rereads the
    // figure the ceiling is computed from.
    const user = userEvent.setup()
    const api = mount()
    await screen.findByRole('option', { name: /qwen/ })
    expect(api.app.memory).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Recarregar a lista de modelos' }))

    await waitFor(() => expect(api.app.memory).toHaveBeenCalledTimes(2))
  })
})

/*
 * What the <select> actually draws. Level 1 covered `selectableModels` and
 * passed while the options came from the unfiltered state — the filter worked
 * and the list on screen came from somewhere else (D15.11).
 */
describe('what the list offers', () => {
  const VARIANT: AiModel = {
    ...TEST_MODEL,
    name: 'gemma3-4b-custom:latest',
    variantOf: 'gemma3:4b'
  }
  const EMBEDDER: AiModel = {
    ...TEST_MODEL,
    name: 'nomic-embed-text:latest',
    capabilities: ['embedding'],
    contextLength: 2048,
    attention: null
  }

  function mountWith(models: AiModel[]): void {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.models).mockResolvedValue({ ok: true, value: models })
    render(providers(<ConversationView />))
  }

  it('leaves a Modelfile variant of a listed model out of the options', async () => {
    mountWith([TEST_MODEL, VARIANT, CODER])

    await screen.findByRole('option', { name: /gemma3:4b/ })
    expect(screen.queryByRole('option', { name: /custom/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('leaves out a model that cannot converse', async () => {
    mountWith([TEST_MODEL, EMBEDDER])

    await screen.findByRole('option', { name: /gemma3:4b/ })
    expect(screen.queryByRole('option', { name: /nomic/ })).not.toBeInTheDocument()
  })

  it('keeps the variant when its parent is not installed', async () => {
    mountWith([VARIANT, CODER])

    expect(await screen.findByRole('option', { name: /custom/ })).toBeInTheDocument()
  })

  it('reports empty when nothing left can converse', async () => {
    mountWith([EMBEDDER])

    expect(await screen.findByText('Nenhum modelo instalado.')).toBeInTheDocument()
  })
})

/*
 * The lock (D15.13). Level 2 because level 1 already passed while the screen
 * showed something else once (D15.11): the pair is only locked if the CONTROLS
 * say so, and `disabled={isLoading}` goes back to false as soon as the reply
 * lands.
 */
describe('the pair locks on the first send', () => {
  async function send(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.type(screen.getByPlaceholderText(PROMPT), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
  }

  it('stops offering another model once there is a turn', async () => {
    const user = userEvent.setup()
    mount()
    await screen.findByRole('option', { name: /qwen/ })
    expect(selector()).toBeEnabled()

    await send(user)

    await waitFor(() => expect(selector()).toBeDisabled())
  })

  it('turns the window from a control into a stated number', async () => {
    const user = userEvent.setup()
    mount()
    await screen.findByLabelText('Contexto')

    await send(user)

    expect(await screen.findByText(/32\.768 tokens · travado/)).toBeInTheDocument()
    // Not a disabled input: one still reads as "editable later", which is the
    // opposite of what the lock promises.
    expect(screen.queryByLabelText('Contexto')).not.toBeInTheDocument()
  })

  it('refuses the send when the locked window no longer fits, without shrinking it', async () => {
    // The asymmetric failure mode: the reservation is remade on every load, and
    // free RAM varies by 3 GB on this machine. Silently dropping to what fits
    // would give back the instability the lock removes.
    const user = userEvent.setup()
    const api = mount()
    await screen.findByLabelText('Contexto')
    await send(user)
    await screen.findByText(/travado/)

    vi.mocked(api.app.memory).mockResolvedValue({
      freeBytes: 4 * 1024 ** 3,
      totalBytes: 16 * 1024 ** 3
    })
    await user.click(screen.getByRole('button', { name: 'Recarregar a lista de modelos' }))

    expect(await screen.findByText(/reservou 32\.768 tokens/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(PROMPT)).toBeDisabled()
  })

  it('says the locked model is gone instead of answering with another one', async () => {
    // The silent fallback that was right before the lock is wrong under it: the
    // conversation would be answered by a model its transcript never used.
    const user = userEvent.setup()
    const api = mount()
    await screen.findByRole('option', { name: /qwen/ })
    await user.selectOptions(selector(), 'qwen2.5-coder:3b')
    await send(user)
    await waitFor(() => expect(selector()).toBeDisabled())

    vi.mocked(api.ai.models).mockResolvedValue({ ok: true, value: [TEST_MODEL] })
    await user.click(screen.getByRole('button', { name: 'Recarregar a lista de modelos' }))

    expect(await screen.findByText(/não está mais instalado/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(PROMPT)).toBeDisabled()
  })
})

/*
 * A model too large for the memory free right now. `contextCeiling` returns 0
 * for it, which is the true answer — the failure was treating zero as a window.
 */
describe('a model that does not fit', () => {
  const BIG: AiModel = {
    provider: 'ollama',
    name: 'qwen2.5:7b',
    parameterSize: '7.6B',
    sizeBytes: 5.9 * 1024 ** 3,
    capabilities: ['completion', 'tools'],
    contextLength: 32768,
    attention: { blockCount: 28, headCountKv: 4, headDim: 128, slidingWindow: null },
    variantOf: null
  }

  function mountBig(): Api {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.models).mockResolvedValue({ ok: true, value: [BIG] })
    render(providers(<ConversationView />))
    return api
  }

  it('marks it in the list instead of disabling the option', async () => {
    // Free RAM is a snapshot of a machine the user is also using: closing a
    // browser changes the answer, so a dead option would be worse than a mark.
    mountBig()

    expect(await screen.findByRole('option', { name: /não cabe/ })).toBeEnabled()
  })

  it('says why, instead of offering a context window of zero', async () => {
    mountBig()

    expect(await screen.findByRole('alert')).toHaveTextContent(/Não cabe na memória livre/)
    expect(screen.queryByLabelText('Contexto')).not.toBeInTheDocument()
  })

  it('closes the composer, because there is no window to send into', async () => {
    mountBig()
    await screen.findByRole('alert')

    expect(screen.getByPlaceholderText(PROMPT)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })
})
