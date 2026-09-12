import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock, TEST_MODEL } from '@test/api-mock'
import { providers } from '@test/renderer-providers'
import type { Api } from '@shared/ipc'
import ConversationView from './ConversationView'
import { useConversations } from './conversationsContext'

/*
 * Level 2 for the meter (D15.4) and the gate (D15.5) — the point of the plan.
 *
 * What is being prevented: the provider drops the beginning of an overflowing
 * prompt and answers anyway, with confidence, about the second half. Measured:
 * a 1.850-token prompt sent with num_ctx 512 came back with prompt_eval_count
 * 259 and no error, no warning, no status field.
 */

const ready = { ok: true, value: { service: 'ollama', version: '0.5.1' } } as const
const PROMPT = 'Pergunte algo ao modelo…'

/**
 * @param extra - Rendered beside the view. Only the conversation-switch test
 *   needs it: `ConversationView` does not carry the list, and the sidebar is
 *   not what is under test here.
 */
function mount(extra?: ReactNode): Api {
  const api = installApiMock()
  // The docs tests of this file consult, and consulting requires a key since
  // 23-I (D23I.5).
  vi.mocked(api.secrets.has).mockResolvedValue(true)
  vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
  vi.mocked(api.ai.models).mockResolvedValue({ ok: true, value: [TEST_MODEL] })
  vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'pronto' } })
  render(
    providers(
      <>
        {extra}
        <ConversationView />
      </>
    )
  )
  return api
}

/**
 * Moves to another conversation, for the stamping test alone. Through the
 * provider's own `create`, which selects what it creates — writing straight to
 * `api.conversation.create` would leave the list query holding the old rows.
 */
function Switcher(): React.JSX.Element {
  const { create } = useConversations()
  return (
    <button type="button" onClick={() => create()}>
      outra conversa
    </button>
  )
}

/**
 * Pastes instead of typing. `user.type` dispatches one keystroke per character,
 * and four thousand of them blow the 5 s test budget — the draft has to be
 * long, so it arrives the way a long draft actually arrives.
 */
async function paste(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  await user.click(screen.getByPlaceholderText(PROMPT))
  await user.paste(text)
}

/**
 * Narrows the window to MIN_NUM_CTX (1024 tokens) so a modest draft can
 * overflow it inside a test. 1024 is below the smallest fixed band (4096,
 * 21-C-C), so the free numeric field is the only reachable path — the raw
 * token count stays the domain either way, same guarantee the old slider
 * carried (F2.5): a pre-existing value never gets rounded to the nearest
 * option on a stray blur.
 */
async function narrowWindow(): Promise<void> {
  const field = await screen.findByLabelText('Personalizado')
  fireEvent.change(field, { target: { value: '1024' } })
  fireEvent.blur(field)
  await waitFor(() => expect((field as HTMLInputElement).value).toBe('1024'))
}

describe('context budget', () => {
  it('shows what the next send would cost before it is sent', async () => {
    const user = userEvent.setup()
    mount()
    await screen.findByText(/de 32.768 tokens/)

    await user.type(screen.getByPlaceholderText(PROMPT), 'oi')

    // The estimate moves with the draft: the meter exists so the overflow is
    // visible BEFORE it happens, not reported after.
    expect(await screen.findByText(/~1 de 32.768 tokens/)).toBeInTheDocument()
  })

  it('commits the exact value of a clicked band, through the whole pipeline (21-C-C)', async () => {
    mount()
    await screen.findByText(/de 32\.768 tokens/)

    // Popover content stays in the DOM under jsdom, just visually hidden
    // (design-system skill, reference.md) — same reason narrowWindow reaches
    // the numeric field without opening the trigger first.
    const band = await screen.findByRole('button', { name: '8k', hidden: true })
    fireEvent.click(band)

    expect(await screen.findByText(/de 8\.192 tokens/)).toBeInTheDocument()
  })

  it('counts the reply too, and calibrates on what was actually SENT', async () => {
    // The acceptance item of passo 4 that was never written, and the defect it
    // would have caught: dividing the characters that exist NOW by the tokens
    // of what was sent BEFORE makes the formula cancel itself, and the meter
    // reports last turn's prompt_eval_count forever.
    const user = userEvent.setup()
    const api = mount()
    vi.mocked(api.ai.chat).mockResolvedValue({
      ok: true,
      value: { content: 'r'.repeat(400), promptTokens: 40 }
    })
    await screen.findByText(/de 32.768 tokens/)

    await paste(user, 'p'.repeat(80))
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    // 80 characters were sent and the provider counted 40 tokens for them, so
    // this conversation runs at 2 chars/token. The transcript is now 480
    // characters — question plus reply — which is 240 tokens. The cancelling
    // formula reports 40: exactly the count of the question alone.
    expect(await screen.findByText(/~240 de 32\.768 tokens/)).toBeInTheDocument()

    // Second turn (21-C): the ratio EMA blends toward 3,2 chars/token
    // (2 * 0.6 + 5 * 0.4, 500 chars / 100 tokens observed) — but the anchor
    // from turn 1 (500 chars = exactly 100 real tokens, just measured) means
    // only the 200 NEW chars since then get estimated through that ratio,
    // not the whole 700. A ratio applied to the whole history would read
    // ~219 (700 / 3,2) — overcounting the already-known 500 chars as if they
    // were still at the drifted 3,2 density, when they are exactly 100.
    // Anchored: 100 (real) + ceil(200 / 3,2) = 100 + 63 = 163.
    vi.mocked(api.ai.chat).mockResolvedValue({
      ok: true,
      value: { content: 's'.repeat(200), promptTokens: 100 }
    })
    await paste(user, 'q'.repeat(20))
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText(/~163 de 32\.768 tokens/)).toBeInTheDocument()
  })

  it('sends when the turn fits', async () => {
    const user = userEvent.setup()
    const api = mount()
    await screen.findByText(/32.768 tokens/)

    await user.type(screen.getByPlaceholderText(PROMPT), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(api.ai.chat).toHaveBeenCalled())
  })

  it('refuses the send when the turn does not fit, and says what to do', async () => {
    const user = userEvent.setup()
    const api = mount()
    await screen.findByText(/32.768 tokens/)
    await narrowWindow()

    // ~1050 estimated tokens against a 1024 window — over the 90% the gate
    // allows, because the character estimate can undercount by a third.
    await paste(user, 'x'.repeat(4000))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/não cabe/)
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    expect(api.ai.chat).not.toHaveBeenCalled()
  })

  it('says a new conversation does not help when the message alone overflows', async () => {
    // Rare, and different in kind from a long history: the ways out offered
    // have to change, because "start a new conversation" would not work.
    const user = userEvent.setup()
    mount()
    await screen.findByText(/32.768 tokens/)
    await narrowWindow()

    await paste(user, 'x'.repeat(4000))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não resolve/)
  })

  it('fires before the nominal ceiling rather than after the damage', async () => {
    const user = userEvent.setup()
    mount()
    await screen.findByText(/32.768 tokens/)
    await narrowWindow()

    // 3.700 characters is ~974 tokens: UNDER the 1024 window. A gate placed at
    // the nominal ceiling would let this through, and the estimate is optimistic
    // by construction — a gate that only fires once the damage is done is a
    // report, not a gate.
    await paste(user, 'x'.repeat(3700))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

/**
 * The one assertion D23G.1 exists for: the panel's footer and the composer's
 * meter are two numbers on screen at once, and they come from a single
 * `budgetFor`. A second one in the panel would be free to disagree, and nothing
 * else in the suite would notice.
 */
describe('uma consulta de documentação no orçamento', () => {
  const SNIPPET = {
    key: 'a#0',
    title: 'invalidateQueries após mutação',
    description: '',
    tokens: 182,
    blocks: [],
    pageTitle: null,
    sourceUrl: null
  }

  async function consult(api: Api, user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByRole('button', { name: 'Adicionar anexo' }))
    // `hidden: true` because jsdom's own default sheet carries
    // `[popover]:not(:popover-open) { display:none }`, which the shim in
    // setup-renderer does not reach — every Popover child computes hidden here.
    await user.click(screen.getByRole('button', { name: /Documentação/, hidden: true }))
    await user.type(screen.getByLabelText('Biblioteca'), 'tanstack query')
    await user.type(screen.getByLabelText('Pergunta'), 'invalidar cache')

    vi.mocked(api.docs.search).mockResolvedValue({
      ok: true,
      value: {
        status: 'found',
        candidates: [
          {
            key: '/tanstack/query#89.5',
            id: '/tanstack/query',
            title: 'TanStack Query',
            description: '',
            branch: 'main',
            state: 'finalized',
            lastUpdateDate: '2026-09-01',
            totalTokens: 824953,
            totalSnippets: 2526,
            stars: 45043,
            trustScore: 8,
            benchmarkScore: 89.5,
            versions: []
          }
        ]
      }
    })
    await user.click(screen.getByRole('button', { name: 'Consultar' }))
    await screen.findByRole('radio', { checked: true })

    vi.mocked(api.docs.fetch).mockResolvedValue({
      ok: true,
      value: { status: 'ready', docs: { snippets: [SNIPPET], notes: [], rules: null } }
    })
    await user.click(screen.getByRole('button', { name: 'Consultar' }))
    await screen.findByRole('tablist')
  }

  it('adds the exact token count to the meter, and says so in the footer', async () => {
    const user = userEvent.setup()
    const api = mount()
    await screen.findByText(/de 32.768 tokens/)

    await consult(api, user)

    // 182 exactly, never a per-character estimate of the snippet (D23G.2).
    expect(screen.getByText('~182 de 32.768 tokens')).toBeInTheDocument()
    expect(screen.getByText(/1 de 1 · ~182 tok · cabe \(janela 32\.768/)).toBeInTheDocument()
  })

  it('drops back out of the meter when the snippet is unchecked', async () => {
    const user = userEvent.setup()
    const api = mount()
    await screen.findByText(/de 32.768 tokens/)

    await consult(api, user)
    await user.click(screen.getByRole('checkbox', { name: SNIPPET.title }))

    expect(screen.getByText('~0 de 32.768 tokens')).toBeInTheDocument()
  })

  // The footer refuses with the window named, and the meter agrees — the same
  // defence as budgetFor.fits (D15.5), since Ollama drops the prompt's head in
  // silence rather than failing.
  it('refuses to fit when the window is too small for the selection', async () => {
    const user = userEvent.setup()
    const api = mount()
    await screen.findByText(/de 32.768 tokens/)
    await narrowWindow()

    await consult(api, user)
    await paste(user, 'x'.repeat(3500))

    expect(screen.getByText('1 de 1 · ~182 tok · não cabe na janela de 1.024')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anexar' })).toBeDisabled()
  })

  it('refuses to attach when nothing is checked', async () => {
    const user = userEvent.setup()
    const api = mount()
    await screen.findByText(/de 32.768 tokens/)

    await consult(api, user)
    await user.click(screen.getByRole('checkbox', { name: SNIPPET.title }))

    expect(screen.getByRole('button', { name: 'Anexar' })).toBeDisabled()
  })

  // The whole point of the cut reaching the wire: `partForProvider` has handled
  // `docs` since 23-C, so attaching is what finally makes the model see it.
  it('sends the frozen consultation with the next message', async () => {
    const user = userEvent.setup()
    const api = mount()
    await screen.findByText(/de 32.768 tokens/)

    await consult(api, user)
    await user.click(screen.getByRole('button', { name: 'Anexar' }))
    await user.type(screen.getByPlaceholderText(PROMPT), 'como invalido?')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(api.ai.chat).toHaveBeenCalled())
    const sent = vi.mocked(api.ai.chat).mock.calls[0][0].messages.at(-1)
    expect(sent?.parts).toContainEqual(expect.objectContaining({ kind: 'docs', enabled: true }))
  })

  // Frozen means frozen (D23G.7): re-marking afterwards would leave the panel
  // describing something other than what the model was sent.
  it('freezes the selection once attached', async () => {
    const user = userEvent.setup()
    const api = mount()
    await screen.findByText(/de 32.768 tokens/)

    await consult(api, user)
    await user.click(screen.getByRole('button', { name: 'Anexar' }))

    expect(screen.getByRole('checkbox', { name: SNIPPET.title })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Anexar' })).not.toBeInTheDocument()
  })

  // Stamped like the composition (D23D.2): the meter of another transcript must
  // not carry a consultation composed for this one.
  it('does not follow the user into another conversation', async () => {
    const user = userEvent.setup()
    const api = mount(<Switcher />)
    await screen.findByText(/de 32.768 tokens/)

    await consult(api, user)
    await user.click(screen.getByRole('button', { name: 'Anexar' }))
    expect(screen.getByText('~182 de 32.768 tokens')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'outra conversa' }))

    await waitFor(() => expect(screen.getByText('~0 de 32.768 tokens')).toBeInTheDocument())
  })
})
