import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Tabs from './Tabs'

function Harness(): React.JSX.Element {
  const [active, setActive] = useState('a')
  return (
    <Tabs
      label="Vistas"
      active={active}
      onChange={setActive}
      tabs={[
        { id: 'a', label: 'Alfa', render: () => <p>corpo alfa</p> },
        { id: 'b', label: 'Beta', render: () => <p>corpo beta</p> },
        { id: 'c', label: 'Gama', render: () => <p>corpo gama</p> }
      ]}
    />
  )
}

async function focusStrip(): Promise<void> {
  await userEvent.tab()
}

describe('Tabs', () => {
  it('has one tab stop for the whole strip, on the selected tab', () => {
    render(<Harness />)

    expect(screen.getByRole('tab', { name: 'Alfa' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('tabindex', '-1')
  })

  it('shows only the selected panel, named by its own tab', () => {
    render(<Harness />)
    const panel = screen.getByRole('tabpanel')

    expect(panel).toHaveTextContent('corpo alfa')
    expect(screen.queryByText('corpo beta')).toBeNull()
    expect(panel).toHaveAttribute(
      'aria-labelledby',
      screen.getByRole('tab', { name: 'Alfa' }).getAttribute('id')
    )
  })

  it('activates on arrow, without a second keystroke', async () => {
    render(<Harness />)
    await focusStrip()

    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('corpo beta')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveFocus()
  })

  it('wraps around both ends', async () => {
    render(<Harness />)
    await focusStrip()

    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Gama' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Alfa' })).toHaveAttribute('aria-selected', 'true')
  })

  it('jumps to the first and the last tab', async () => {
    render(<Harness />)
    await focusStrip()

    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Gama' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Alfa' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches on click too', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('tab', { name: 'Gama' }))

    expect(screen.getByRole('tabpanel')).toHaveTextContent('corpo gama')
  })
})
