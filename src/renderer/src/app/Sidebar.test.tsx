import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar, { type SidebarProps } from './Sidebar'

// The sidebar is controlled since F-3-C (DF3C.2); this holds the state App.tsx
// now holds, so the assertions below are the ones from before.
type OwnProps = Omit<SidebarProps, 'collapsed' | 'onCollapsedChange'>

function Controlled(props: OwnProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  return <Sidebar {...props} collapsed={collapsed} onCollapsedChange={setCollapsed} />
}

// Collapsing is behaviour, not layout: the three regions leave the tree and come
// back. Asserting the width or the class would be the tying test the `testing`
// skill warns about — it breaks on every style change and catches no bug.
describe('Sidebar', () => {
  it('drops the three regions when collapsed and restores them', async () => {
    const user = userEvent.setup()
    render(
      <Controlled
        nav={<span>nav</span>}
        content={<span>lista</span>}
        footer={<span>versões</span>}
      />
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
      <Controlled
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
