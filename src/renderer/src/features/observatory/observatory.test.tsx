import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import Observatory from './Observatory'

describe('Observatory', () => {
  beforeEach(() => {
    installApiMock()
  })

  it('renders no panel while the modal is closed', () => {
    render(<Observatory />)

    expect(screen.queryByRole('navigation', { name: 'Painéis' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Runtime' })).not.toBeInTheDocument()
  })

  it('opens on the first panel and lists only groups that have one', async () => {
    const user = userEvent.setup()
    render(<Observatory />)

    await user.click(screen.getByRole('button', { name: 'Observatório' }))

    expect(await screen.findByRole('heading', { name: 'Runtime' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Estado' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Armazenamento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Índices' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Atividade' })).not.toBeInTheDocument()
  })

  // The invariant the whole modal's lightness rests on (§ 4.2): switching must
  // UNMOUNT, never hide. A stack toggled by CSS would leave both in the DOM and
  // pass every assertion but this one.
  it('unmounts the previous panel when another is selected', async () => {
    const user = userEvent.setup()
    render(<Observatory />)

    await user.click(screen.getByRole('button', { name: 'Observatório' }))
    await user.click(await screen.findByRole('button', { name: 'Processos' }))

    expect(screen.getByRole('heading', { name: 'Processos' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Runtime' })).not.toBeInTheDocument()
  })

  it('marks the current panel with aria-current', async () => {
    const user = userEvent.setup()
    render(<Observatory />)

    await user.click(screen.getByRole('button', { name: 'Observatório' }))

    expect(await screen.findByRole('button', { name: 'Runtime' })).toHaveAttribute(
      'aria-current',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Processos' })).not.toHaveAttribute('aria-current')
  })
})
