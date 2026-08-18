import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from './Sidebar'

// Collapsing is behaviour, not layout: the three regions leave the tree and come
// back. Asserting the width or the class would be the tying test the `testing`
// skill warns about — it breaks on every style change and catches no bug.
describe('Sidebar', () => {
  it('drops the three regions when collapsed and restores them', async () => {
    const user = userEvent.setup()
    render(
      <Sidebar nav={<span>nav</span>} content={<span>lista</span>} footer={<span>versões</span>} />
    )

    expect(screen.getByText('lista')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Recolher a barra lateral' }))

    expect(screen.queryByText('nav')).not.toBeInTheDocument()
    expect(screen.queryByText('lista')).not.toBeInTheDocument()
    expect(screen.queryByText('versões')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expandir a barra lateral' }))

    expect(screen.getByText('lista')).toBeInTheDocument()
  })

  it('renders collapsedRail while collapsed, and its expand callback reopens the sidebar', async () => {
    const user = userEvent.setup()
    render(
      <Sidebar
        nav={<span>nav</span>}
        content={<span>lista</span>}
        footer={<span>versões</span>}
        collapsedRail={(expand) => (
          <button type="button" onClick={expand}>
            abrir
          </button>
        )}
      />
    )

    expect(screen.queryByRole('button', { name: 'abrir' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Recolher a barra lateral' }))

    expect(screen.getByRole('button', { name: 'abrir' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'abrir' }))

    expect(screen.getByText('lista')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'abrir' })).not.toBeInTheDocument()
  })
})
