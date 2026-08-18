import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock, TEST_MODEL } from '@test/api-mock'
import type { Api } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import ConversationsProvider from './ConversationsProvider'
import ConversationView from './ConversationView'

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
  vi.mocked(api.ai.models).mockResolvedValue({ ok: true, value: [TEST_MODEL] })
  vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'pronto' } })
  render(providers(<ConversationView />))
  return api
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
 * Narrows the window to its smallest step (1024 tokens — MIN_NUM_CTX) so a
 * modest draft can overflow it inside a test. The control is a range slider
 * over the raw token count, same domain as the `<input type="number">` it
 * replaced — an earlier index-based version was reverted after advisor
 * review found it could round a pre-existing value on a stray blur (F2.5).
 * `fireEvent` mirrors a completed drag: `change` moves the value, `mouseUp`
 * is what Slider listens for to call `onChangeCommitted`.
 */
async function narrowWindow(): Promise<void> {
  const field = await screen.findByLabelText('Contexto')
  fireEvent.change(field, { target: { value: '1024' } })
  fireEvent.mouseUp(field)
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
