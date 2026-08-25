import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dialog from './Dialog'

// jsdom's <dialog> shim (test/setup-renderer.ts) only lets the component mount
// and be driven — the top layer, focus trap, Esc and ::backdrop have no
// equivalent here and are verified live. What this level checks: the title is
// the dialog's accessible name, describedBy wires through when passed, and
// the close control reaches onClose.

describe('Dialog', () => {
  it('exposes the title as the accessible name', () => {
    render(
      <Dialog open title="Configurações" onClose={() => {}}>
        conteúdo
      </Dialog>
    )
    expect(screen.getByRole('dialog', { name: 'Configurações' })).toBeInTheDocument()
  })

  it('has no aria-describedby when describedBy is not passed', () => {
    render(
      <Dialog open title="Configurações" onClose={() => {}}>
        conteúdo
      </Dialog>
    )
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby')
  })

  it('wires aria-describedby to the given id', () => {
    render(
      <Dialog open title="Configurações" onClose={() => {}} describedBy="intro">
        <p id="intro">Ajustes desta máquina.</p>
      </Dialog>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-describedby', 'intro')
    expect(dialog).toHaveAccessibleDescription('Ajustes desta máquina.')
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Dialog open title="Configurações" onClose={onClose}>
        conteúdo
      </Dialog>
    )

    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
