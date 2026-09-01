import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import { createQueryClient } from '../../shared/queryClient'
import Observatory from './Observatory'

function renderObservatory(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <Observatory />
    </QueryClientProvider>
  )
}

describe('Observatory', () => {
  beforeEach(() => {
    installApiMock()
  })

  it('renders no panel while the modal is closed', () => {
    renderObservatory()

    expect(screen.queryByRole('navigation', { name: 'Painéis' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Runtime' })).not.toBeInTheDocument()
  })

  it('opens on the first panel and lists only groups that have one', async () => {
    const user = userEvent.setup()
    renderObservatory()

    await user.click(screen.getByRole('button', { name: 'Observatório' }))

    // Ten panel modules now load in this one lazy chunk (O-7 added Desempenho) —
    // RTL's default findBy timeout (1s) flakes under a full-suite parallel
    // run; the explicit timeouts match ArtifactPanel.test.tsx's precedent.
    expect(
      await screen.findByRole('heading', { name: 'Runtime' }, { timeout: 8000 })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Estado' })).toBeInTheDocument()
    // Armazenamento now has a panel (O-3, Banco de dados) — this is DO1.10
    // working as designed, not a regression of the O-1 assertion.
    expect(screen.getByRole('heading', { name: 'Armazenamento' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Índices' })).not.toBeInTheDocument()
    // Atividade now has a panel too (O-6, Eventos) — same DO1.10 mechanism.
    expect(screen.getByRole('heading', { name: 'Atividade' })).toBeInTheDocument()
  }, 10000)

  // The invariant the whole modal's lightness rests on (§ 4.2): switching must
  // UNMOUNT, never hide. A stack toggled by CSS would leave both in the DOM and
  // pass every assertion but this one.
  it('unmounts the previous panel when another is selected', async () => {
    const user = userEvent.setup()
    renderObservatory()

    await user.click(screen.getByRole('button', { name: 'Observatório' }))
    await user.click(await screen.findByRole('button', { name: 'Processos' }))

    expect(screen.getByRole('heading', { name: 'Processos' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Runtime' })).not.toBeInTheDocument()
  })

  it('marks the current panel with aria-current', async () => {
    const user = userEvent.setup()
    renderObservatory()

    await user.click(screen.getByRole('button', { name: 'Observatório' }))

    expect(await screen.findByRole('button', { name: 'Runtime' })).toHaveAttribute(
      'aria-current',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Processos' })).not.toHaveAttribute('aria-current')
  })
})
