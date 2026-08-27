import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ColumnProfile, Step } from '@shared/ipc'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
import { installApiMock } from '@test/api-mock'
import { createQueryClient } from '../../shared/queryClient'
import ConversationsProvider from '../conversation/ConversationsProvider'
import ArtifactSteps from './ArtifactSteps'
import type { Proposal } from './proposalsOf'

const STEPS: Step[] = [
  { kind: 'filter', column: 'idade', operator: 'gt', value: 18 },
  { kind: 'sort', column: 'valor', direction: 'desc' },
  { kind: 'limit', count: 100 }
]

const PROPOSAL: Proposal = {
  messageId: 'm1',
  part: { kind: 'stepProposal', hash: 'h1', proposalKind: 'steps', steps: STEPS }
}

function profile(column: string, nullPercentage: number): ColumnProfile {
  return {
    column,
    type: 'BIGINT',
    nullPercentage,
    approxUnique: 3,
    min: null,
    max: null,
    avg: null,
    topValues: undefined
  }
}

function mount(): ReturnType<typeof installApiMock> {
  const api = installApiMock()
  vi.mocked(api.dataset.transform).mockResolvedValue({
    ok: true,
    value: {
      bytes: columnsToArrowBytes({ idade: [20n, 31n] }),
      before: [profile('idade', 0)],
      after: [profile('idade', 0)]
    }
  })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ConversationsProvider>
        <ArtifactSteps proposal={PROPOSAL} hash="h1" rowCount={8412} />
      </ConversationsProvider>
    </QueryClientProvider>
  )
  return api
}

describe('ArtifactSteps', () => {
  it('reads the proposal in Portuguese, every step on', () => {
    mount()

    expect(screen.getByLabelText('filtrar idade maior que 18')).toBeChecked()
    expect(screen.getByLabelText('limitar a 100 linhas')).toBeChecked()
  })

  // DF3F.3: the model's original proposal must survive being experimented with.
  it('leaves a switched-off step in the list, and keeps it out of the run', async () => {
    const api = mount()

    await userEvent.click(screen.getByLabelText('limitar a 100 linhas'))
    await userEvent.click(screen.getByRole('button', { name: 'Ver resultado' }))

    expect(screen.getByLabelText('limitar a 100 linhas')).toBeVisible()
    expect(api.dataset.transform).toHaveBeenCalledWith('h1', [STEPS[0], STEPS[1]])
  })

  it('brings a step back when it is switched on again', async () => {
    const api = mount()
    const step = screen.getByLabelText('ordenar por valor (decrescente)')

    await userEvent.click(step)
    await userEvent.click(step)
    await userEvent.click(screen.getByRole('button', { name: 'Ver resultado' }))

    expect(api.dataset.transform).toHaveBeenCalledWith('h1', STEPS)
  })

  it('has nothing to run once every step is off', async () => {
    mount()

    await userEvent.click(screen.getByLabelText('filtrar idade maior que 18'))
    await userEvent.click(screen.getByLabelText('ordenar por valor (decrescente)'))
    await userEvent.click(screen.getByLabelText('limitar a 100 linhas'))

    expect(screen.getByRole('button', { name: 'Ver resultado' })).toBeDisabled()
  })

  // DF3F.5: the app already computed this and threw it away.
  it('shows how many rows and columns went in and came out', async () => {
    mount()

    await userEvent.click(screen.getByRole('button', { name: 'Ver resultado' }))

    expect(await screen.findByText(/8\.412 → 2 linhas · 1 → 1 colunas/)).toBeVisible()
    expect(screen.getByText(/Nada foi gravado/)).toBeVisible()
  })

  it('warns only when a column really lost its values', async () => {
    const api = mount()
    vi.mocked(api.dataset.transform).mockResolvedValue({
      ok: true,
      value: {
        bytes: columnsToArrowBytes({ idade: [20n] }),
        before: [profile('idade', 2), profile('nome', 0)],
        after: [profile('idade', 31), profile('nome', 5)]
      }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Ver resultado' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('idade: 2.0% → 31.0%')
    expect(alert).not.toHaveTextContent('nome')
  })
})

// DF3F.6: the trash deletes the assistant MESSAGE, which is what makes the
// line disappear from the transcript too — one act, not two.
describe('excluir a proposta', () => {
  async function mountWithConversation(): Promise<ReturnType<typeof installApiMock>> {
    const api = installApiMock()
    await api.conversation.create({ id: 'c1', title: 'Vendas', createdAt: 1 })
    await api.conversation.append('c1', {
      id: 'm1',
      role: 'assistant',
      parts: [PROPOSAL.part],
      createdAt: 2
    })
    render(
      <QueryClientProvider client={createQueryClient()}>
        <ConversationsProvider>
          <ArtifactSteps proposal={PROPOSAL} hash="h1" rowCount={8412} />
        </ConversationsProvider>
      </QueryClientProvider>
    )
    return api
  }

  it('asks first, and deletes nothing when cancelled', async () => {
    const api = await mountWithConversation()

    await userEvent.click(screen.getByRole('button', { name: 'Excluir proposta' }))
    await userEvent.click(screen.getByRole('button', { name: /Cancelar/ }))

    expect(await api.conversation.messages('c1')).toHaveLength(1)
  })

  it('removes the message once confirmed', async () => {
    const api = await mountWithConversation()

    await userEvent.click(screen.getByRole('button', { name: 'Excluir proposta' }))
    await userEvent.click(screen.getByRole('button', { name: /Excluir$/ }))

    await waitFor(async () => expect(await api.conversation.messages('c1')).toHaveLength(0))
  })
})

// Inherited from the card this replaced: the engine's own text reaches the
// screen, because "deu erro" is not actionable and a Binder Error is.
describe('erro do motor', () => {
  it('shows the engine text and leaves the steps editable', async () => {
    const api = mount()
    vi.mocked(api.dataset.transform).mockResolvedValue({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Binder Error: column "x" not found' }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Ver resultado' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('column "x" not found')
    expect(screen.getByLabelText('filtrar idade maior que 18')).toBeEnabled()
  })
})
