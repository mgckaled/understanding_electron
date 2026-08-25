import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock, TEST_MODEL } from '@test/api-mock'
import type { AiModel, Api, ImagePart } from '@shared/ipc'
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

/**
 * `geminiReady` must be applied BEFORE render: useCloudCatalog's
 * useCloudSecret('gemini') fires its query as part of the initial mount, so
 * overriding `secrets.has` after `mount()` returns is already too late — the
 * query already captured the default `false` (N-1-C).
 */
function mount(geminiReady = false): Api {
  const api = installApiMock()
  vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
  vi.mocked(api.ai.models).mockResolvedValue({ ok: true, value: [TEST_MODEL, CODER] })
  vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'pronto' } })
  if (geminiReady) vi.mocked(api.secrets.has).mockImplementation(async (p) => p === 'gemini')
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

// The pill trigger, replacing the native <select> (DS-4 passo 7). A <button>
// is labelable, so `Field`'s <label for> still resolves the accessible name.
// Async (find, not get): the catalog is still loading for a tick after mount.
function modelTrigger(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: 'Modelo' })
}

// jsdom's own default stylesheet forces `[popover]:not(:popover-open)` to
// `display: none` regardless of real state (see the shim in
// test/setup-renderer.ts) — every query into popover content needs
// `hidden: true`, whether the popover was opened or not.
function modelOption(name: RegExp): HTMLElement {
  return screen.getByRole('option', { name, hidden: true })
}

async function chooseModel(user: ReturnType<typeof userEvent.setup>, name: RegExp): Promise<void> {
  await user.click(await modelTrigger())
  await user.click(modelOption(name))
}

describe('ModelSelector', () => {
  it('lists the installed models with size and context ceiling', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await modelTrigger())

    await waitFor(() => modelOption(/gemma3:4b/))
    // The option text is what the catalog knows, which is the whole reason for
    // the extra /api/show per model: neither number exists in /api/tags.
    expect(modelOption(/gemma3:4b/)).toHaveTextContent('3,1 GB')
    expect(modelOption(/gemma3:4b/)).toHaveTextContent('128k')
    expect(modelOption(/qwen2\.5-coder:3b/)).toHaveTextContent('32k')
  })

  it('preselects the first installed model instead of a hardcoded name', async () => {
    mount()

    expect(await modelTrigger()).toHaveTextContent('gemma3:4b')
  })

  it("shows a model's own capability chips on its row, not another model's", async () => {
    // The sigla scheme itself (F2.1: which capability maps to which sigla,
    // the tools/thinking "T" collision, the fallback for an unmapped
    // capability) is unit-tested in capabilities.test.tsx — this level only
    // checks each row carries its own model's chips (F2.2 widened this from
    // "only the selected model" to every row in the list).
    const user = userEvent.setup()
    mount()
    await user.click(await modelTrigger())

    const gemma = await waitFor(() => modelOption(/gemma3:4b/))
    expect(within(gemma).getByTitle('Imagem — entende imagens anexadas')).toHaveTextContent('IM')
    expect(within(gemma).queryByTitle('Ferramentas — function calling')).not.toBeInTheDocument()

    const coder = modelOption(/qwen2\.5-coder:3b/)
    expect(within(coder).getByTitle('Ferramentas — function calling')).toHaveTextContent('TO')
    expect(
      within(coder).getByTitle('Inserção — fill-in-middle, autocomplete com sufixo')
    ).toHaveTextContent('IN')
    expect(within(coder).queryByTitle('Imagem — entende imagens anexadas')).not.toBeInTheDocument()
  })

  it('shows GLM as a real, disabled-without-a-key option, with its second line (N-1-C)', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await modelTrigger())

    // mount() never configures a GLM key (api-mock's secrets.has defaults to
    // false) — the button exists and shows the real model name, but is not
    // clickable, same "correção, não cortesia" the nível-3 gate uses. Matched
    // by a regex, not an exact name: the accessible name now includes the
    // second line's content too (context, rate limit, chips).
    const glm = await screen.findByRole('button', { name: /glm-4\.7-flash/, hidden: true })
    expect(glm).toBeDisabled()
    // formatContext divides by 1024 (binary thousands), same as every other
    // row — 200.000 trained tokens reads "195k", not a round "200k".
    expect(glm).toHaveTextContent('195k de contexto')
    expect(glm).toHaveTextContent('1 simultânea')

    // Not a selectable option: the arrow-key listbox is scoped to Locais.
    expect(
      screen.queryByRole('option', { name: /glm-4\.7-flash/, hidden: true })
    ).not.toBeInTheDocument()
  })

  it('does not fire onSelect when clicking a cloud row with no key stored', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await modelTrigger())

    const glm = await screen.findByRole('button', { name: /glm-4\.7-flash/, hidden: true })
    await user.click(glm)

    // Still on the local model — a disabled button swallows the click.
    expect(await modelTrigger()).toHaveTextContent('gemma3:4b')
  })

  it('shows both cloud providers, each gated by its own key (N-1-C)', async () => {
    const user = userEvent.setup()
    mount(true)
    await user.click(await modelTrigger())

    const glm = await screen.findByRole('button', { name: /glm-4\.7-flash/, hidden: true })
    const flashLite = screen.getByRole('button', { name: /gemini-3\.5-flash-lite/, hidden: true })
    const flash = screen.getByRole('button', { name: /gemini-3\.7-flash/, hidden: true })
    // GLM has no key in this test — still disabled; the two Gemini rows do.
    expect(glm).toBeDisabled()
    expect(flashLite).toBeEnabled()
    expect(flash).toBeEnabled()
    expect(flashLite).toHaveTextContent('15 RPM')
    expect(flash).toHaveTextContent('20 RPD')
  })

  it('selecting a Gemini model before the first send does not revert to the first Ollama model (N-1-C, same regression N-1-B proved for GLM)', async () => {
    const user = userEvent.setup()
    mount(true)
    await user.click(await modelTrigger())

    const flashLite = await screen.findByRole('button', {
      name: /gemini-3\.5-flash-lite/,
      hidden: true
    })
    await user.click(flashLite)

    expect(await modelTrigger()).toHaveTextContent('gemini-3.5-flash-lite')
  })

  it('sends and locks on a Gemini model, and resolves it normally on reload (N-1-C)', async () => {
    const user = userEvent.setup()
    const api = mount(true)
    await user.click(await modelTrigger())
    await user.click(await screen.findByRole('button', { name: /gemini-3\.7-flash/, hidden: true }))
    await waitFor(async () => expect(await modelTrigger()).toHaveTextContent('gemini-3.7-flash'))
    await user.type(screen.getByPlaceholderText(PROMPT), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() =>
      expect(api.ai.chat).toHaveBeenCalledWith(
        expect.objectContaining({ service: 'gemini', model: 'gemini-3.7-flash' }),
        expect.any(String)
      )
    )

    // A locked cloud conversation still resolves its model on reload — the
    // same regression N-1-B's advisor review caught for GLM, generalized by
    // feeding `allModels` (Ollama + GLM + Gemini) to resolveModel, not just
    // the local catalog.
    await user.click(screen.getByRole('button', { name: 'Recarregar a lista de modelos' }))
    expect(await modelTrigger()).toHaveTextContent('gemini-3.7-flash')
    expect(await modelTrigger()).toBeDisabled()
  })

  it('sends the chosen model, not the default one', async () => {
    const user = userEvent.setup()
    const api = mount()

    await chooseModel(user, /qwen2\.5-coder:3b/)
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
    await modelTrigger()

    // Captured once, while it is still the only thing by that name: a created
    // conversation carries DEFAULT_TITLE, which IS 'Nova conversa', so after the
    // first click the query matches two buttons. Same family as the `exact:
    // true` rule the testing skill records for per-row actions.
    const newConversation = screen.getByRole('button', { name: 'Nova conversa' })

    // Picked AFTER the conversation exists, not before: choosing while `pending`
    // (no conversation yet) would not carry over — a fresh conversation's own
    // `settings` starts empty, it does not inherit `pending` (ConversationView).
    await user.click(newConversation)
    await chooseModel(user, /qwen2\.5-coder:3b/)
    await waitFor(async () => expect(await modelTrigger()).toHaveTextContent('qwen2.5-coder:3b'))

    await user.click(newConversation)

    // The second conversation chose nothing, so it falls back to the catalog's
    // first entry — it does not inherit the previous conversation's pick.
    await waitFor(async () => expect(await modelTrigger()).toHaveTextContent('gemma3:4b'))
  })

  it('records the whole pair on the send that creates the conversation', async () => {
    // The lock is only as good as what it writes down (D15.13). Recording the
    // model alone would leave the window still derived from live free RAM —
    // grey control, floating value.
    const user = userEvent.setup()
    const api = mount()
    await chooseModel(user, /qwen2\.5-coder:3b/)
    await user.type(screen.getByPlaceholderText(PROMPT), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() =>
      // service travels atomically with model (N-1-B, DN1B.7) — the pair the
      // lock writes down is now a triple.
      expect(api.conversation.updateSettings).toHaveBeenCalledWith(expect.any(String), {
        model: 'qwen2.5-coder:3b',
        service: 'ollama',
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

  it('degrades to a legible state instead of breaking when the catalog fails, and the picker stays usable for GLM (N-1-B)', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
    vi.mocked(api.ai.models).mockResolvedValue({
      ok: false,
      error: { kind: 'unavailable', service: 'ollama', hint: 'Rode ollama serve.' }
    })
    render(providers(<ConversationView />))

    // The Ollama version moved to the sidebar footer (DS-3), so the selector's
    // own error is the sync point — and it is the state this test is about.
    await screen.findByText('Serviço indisponível no momento.')
    // The composer and the rest of the view still render; only the Locais
    // section is in an error state. A downed Ollama must not also hide the
    // trigger, or the GLM row sitting beside Locais inside it (N-1-B) — with
    // nothing local to fall back to, the picker resolves to the one entry
    // left: GLM.
    expect(screen.getByPlaceholderText(PROMPT)).toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'Modelo' })
    expect(trigger).toBeEnabled()
    expect(trigger).toHaveTextContent('glm-4.7-flash')
  })

  it('refetches the catalog when asked, because installing a model is invisible', async () => {
    const user = userEvent.setup()
    const api = mount()
    await user.click(await modelTrigger())
    await waitFor(() => modelOption(/qwen/))
    expect(api.ai.models).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Recarregar a lista de modelos' }))

    await waitFor(() => expect(api.ai.models).toHaveBeenCalledTimes(2))
  })

  it('rereads free memory on reload, because the advice depends on it', async () => {
    // "Feche aplicativos e recarregue" is only true if the button rereads the
    // figure the ceiling is computed from.
    const user = userEvent.setup()
    const api = mount()
    await user.click(await modelTrigger())
    await waitFor(() => modelOption(/qwen/))
    expect(api.app.memory).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Recarregar a lista de modelos' }))

    await waitFor(() => expect(api.app.memory).toHaveBeenCalledTimes(2))
  })
})

/*
 * What the list actually draws. Level 1 covered `selectableModels` and passed
 * while the options came from the unfiltered state — the filter worked and the
 * list on screen came from somewhere else (D15.11).
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
    const user = userEvent.setup()
    mountWith([TEST_MODEL, VARIANT, CODER])
    await user.click(await modelTrigger())

    await waitFor(() => modelOption(/gemma3:4b/))
    expect(screen.queryByRole('option', { name: /custom/, hidden: true })).not.toBeInTheDocument()
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(2)
  })

  it('leaves out a model that cannot converse', async () => {
    const user = userEvent.setup()
    mountWith([TEST_MODEL, EMBEDDER])
    await user.click(await modelTrigger())

    await waitFor(() => modelOption(/gemma3:4b/))
    expect(screen.queryByRole('option', { name: /nomic/, hidden: true })).not.toBeInTheDocument()
  })

  it('keeps the variant when its parent is not installed', async () => {
    const user = userEvent.setup()
    mountWith([VARIANT, CODER])
    await user.click(await modelTrigger())

    expect(await screen.findByRole('option', { name: /custom/, hidden: true })).toBeInTheDocument()
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
    expect(await modelTrigger()).toBeEnabled()

    await send(user)

    await waitFor(async () => expect(await modelTrigger()).toBeDisabled())
  })

  it('turns the window from a control into a stated number', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await modelTrigger())
    await screen.findByLabelText('Contexto', { selector: 'input' })
    await user.click(await modelTrigger())

    await send(user)

    expect(await screen.findByText(/32\.768 tokens · travado/)).toBeInTheDocument()
    // Not a disabled input: one still reads as "editable later", which is the
    // opposite of what the lock promises.
    expect(screen.queryByLabelText('Contexto', { selector: 'input' })).not.toBeInTheDocument()
  })

  it('refuses the send when the locked window no longer fits, without shrinking it', async () => {
    // The asymmetric failure mode: the reservation is remade on every load, and
    // free RAM varies by 3 GB on this machine. Silently dropping to what fits
    // would give back the instability the lock removes.
    const user = userEvent.setup()
    const api = mount()
    await user.click(await modelTrigger())
    await screen.findByLabelText('Contexto', { selector: 'input' })
    await user.click(await modelTrigger())
    await send(user)
    await screen.findByText(/travado/)

    vi.mocked(api.app.memory).mockResolvedValue({
      freeBytes: 4 * 1024 ** 3,
      totalBytes: 16 * 1024 ** 3
    })
    await user.click(screen.getByRole('button', { name: 'Recarregar a lista de modelos' }))
    await user.click(await modelTrigger())

    expect(await screen.findByText(/reservou 32\.768 tokens/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(PROMPT)).toBeDisabled()
  })

  it('says the locked model is gone instead of answering with another one', async () => {
    // The silent fallback that was right before the lock is wrong under it: the
    // conversation would be answered by a model its transcript never used.
    const user = userEvent.setup()
    const api = mount()
    await chooseModel(user, /qwen2\.5-coder:3b/)
    await send(user)
    await waitFor(async () => expect(await modelTrigger()).toBeDisabled())

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
    const user = userEvent.setup()
    mountBig()
    await user.click(await modelTrigger())

    expect(await screen.findByRole('option', { name: /não cabe/, hidden: true })).toBeEnabled()
  })

  it('says why, instead of offering a context window of zero', async () => {
    const user = userEvent.setup()
    mountBig()
    await user.click(await modelTrigger())

    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent(
      /Não cabe na memória livre/
    )
    expect(screen.queryByLabelText('Contexto', { selector: 'input' })).not.toBeInTheDocument()
  })

  it('closes the composer, because there is no window to send into', async () => {
    const user = userEvent.setup()
    mountBig()
    await user.click(await modelTrigger())
    await screen.findByRole('alert', { hidden: true })

    expect(screen.getByPlaceholderText(PROMPT)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })
})

/*
 * D17.11's second checkpoint: the popover already keeps a vision-less model
 * from attaching an image, but the model can still change AFTER the attach.
 * canSend folds that case into the same generic disabled Enviar — no alert of
 * its own, unlike the overflow gate (D15.5).
 */
describe('the vision gate on send', () => {
  const IMAGE: ImagePart = {
    kind: 'image',
    hash: 'img1',
    fileName: 'grafico.png',
    mimeType: 'image/png'
  }

  it('shows the miniature in the transcript once an attached image is sent', async () => {
    // The aceite table's "mostra miniatura" clause — the card is
    // AttachmentCard → ImageCard, collapsed behind a filename header until
    // clicked, then an <img src="attachment://<hash>"> above the user's own
    // bubble (ConversationView.tsx).
    const user = userEvent.setup()
    const api = mount()
    vi.mocked(api.image.pick).mockResolvedValue({ ok: true, value: { path: '/grafico.png' } })
    vi.mocked(api.image.attach).mockResolvedValue({ ok: true, value: IMAGE })

    await user.click(screen.getByRole('button', { name: 'Adicionar anexo' }))
    await user.click(screen.getByRole('button', { name: 'Imagens', hidden: true }))
    await screen.findByText('grafico.png')
    await user.type(screen.getByPlaceholderText(PROMPT), 'o que é isso?')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await user.click(await screen.findByRole('button', { name: /grafico\.png/ }))
    const miniature = await screen.findByRole('img', { name: 'grafico.png' })
    expect(miniature).toHaveAttribute('src', 'attachment://img1')
  })

  it('disables Enviar without a new alert when the model loses vision after attaching', async () => {
    const user = userEvent.setup()
    const api = mount()
    vi.mocked(api.image.pick).mockResolvedValue({ ok: true, value: { path: '/grafico.png' } })
    vi.mocked(api.image.attach).mockResolvedValue({ ok: true, value: IMAGE })

    await user.click(screen.getByRole('button', { name: 'Adicionar anexo' }))
    await user.click(screen.getByRole('button', { name: 'Imagens', hidden: true }))
    await screen.findByText('grafico.png')
    await user.type(screen.getByPlaceholderText(PROMPT), 'o que é isso?')
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled()

    await chooseModel(user, /qwen2\.5-coder:3b/)

    expect(await screen.findByRole('button', { name: 'Enviar' })).toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
