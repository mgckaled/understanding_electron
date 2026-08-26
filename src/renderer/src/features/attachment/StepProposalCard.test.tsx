import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ColumnProfile, StepProposalPart } from '@shared/ipc'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
import { installApiMock } from '@test/api-mock'
import StepProposalCard from './StepProposalCard'

const PART: StepProposalPart = {
  kind: 'stepProposal',
  hash: 'h1',
  proposalKind: 'steps',
  steps: [
    { kind: 'filter', column: 'idade', operator: 'gt', value: 18 },
    { kind: 'limit', count: 10 }
  ]
}

function profile(overrides: Partial<ColumnProfile>): ColumnProfile {
  return {
    column: 'idade',
    type: 'BIGINT',
    nullPercentage: 0,
    approxUnique: 40,
    min: '18',
    max: '65',
    avg: 34.2,
    ...overrides
  }
}

describe('StepProposalCard', () => {
  it('renders each step in Portuguese', () => {
    render(<StepProposalCard part={PART} />)

    expect(screen.getByText('filtrar idade maior que 18')).toBeVisible()
    expect(screen.getByText('limitar a 10 linhas')).toBeVisible()
  })

  it('asks for confirmation before removing a step, then removes it on Remover', async () => {
    const user = userEvent.setup()
    render(<StepProposalCard part={PART} />)

    await user.click(screen.getByRole('button', { name: 'Remover passo 1' }))
    expect(screen.getByText('Deseja remover o passo de forma definitiva?')).toBeVisible()
    // Both steps are still there — the dialog only asks, it does not act yet.
    expect(screen.getByText('filtrar idade maior que 18')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Remover' }))

    expect(screen.queryByText('filtrar idade maior que 18')).not.toBeInTheDocument()
    expect(screen.getByText('limitar a 10 linhas')).toBeVisible()
  })

  it('keeps the step when the removal is cancelled', async () => {
    const user = userEvent.setup()
    render(<StepProposalCard part={PART} />)

    await user.click(screen.getByRole('button', { name: 'Remover passo 1' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByText('filtrar idade maior que 18')).toBeVisible()
    expect(screen.getByText('limitar a 10 linhas')).toBeVisible()
  })

  it('applies the remaining steps and renders the preview table', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({ idade: [20n, 30n] })
    vi.mocked(api.dataset.transform).mockResolvedValue({
      ok: true,
      value: {
        bytes,
        before: [profile({ nullPercentage: 0 })],
        after: [profile({ nullPercentage: 0 })]
      }
    })
    const user = userEvent.setup()

    render(<StepProposalCard part={PART} />)
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(await screen.findByText('20')).toBeVisible()
    expect(screen.getByText('30')).toBeVisible()
    expect(api.dataset.transform).toHaveBeenCalledWith('h1', PART.steps)
  })

  it('sends only the remaining steps after a removal', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.transform).mockResolvedValue({
      ok: true,
      value: { bytes: columnsToArrowBytes({}), before: [], after: [] }
    })
    const user = userEvent.setup()

    render(<StepProposalCard part={PART} />)
    await user.click(screen.getByRole('button', { name: 'Remover passo 1' }))
    await user.click(screen.getByRole('button', { name: 'Remover' }))
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(api.dataset.transform).toHaveBeenCalledWith('h1', [{ kind: 'limit', count: 10 }])
  })

  it('shows the engine error text when transform fails', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.transform).mockResolvedValue({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Unknown column: "idade"' }
    })
    const user = userEvent.setup()

    render(<StepProposalCard part={PART} />)
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown column: "idade"')
  })

  it("warns when a column's null percentage jumps past the threshold (D19.6)", async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.transform).mockResolvedValue({
      ok: true,
      value: {
        bytes: columnsToArrowBytes({ idade: [20n] }),
        before: [profile({ column: 'idade', nullPercentage: 2 })],
        after: [profile({ column: 'idade', nullPercentage: 40 })]
      }
    })
    const user = userEvent.setup()

    render(<StepProposalCard part={PART} />)
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('idade')
    expect(alert).toHaveTextContent('2.0%')
    expect(alert).toHaveTextContent('40.0%')
  })

  it('does not warn for a small null percentage change', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.transform).mockResolvedValue({
      ok: true,
      value: {
        bytes: columnsToArrowBytes({ idade: [20n] }),
        before: [profile({ column: 'idade', nullPercentage: 2 })],
        after: [profile({ column: 'idade', nullPercentage: 5 })]
      }
    })
    const user = userEvent.setup()

    render(<StepProposalCard part={PART} />)
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))

    await screen.findByText('20')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
