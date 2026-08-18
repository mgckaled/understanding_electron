import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Switch from './Switch'

describe('Switch', () => {
  it('reflects checked via aria-checked', () => {
    render(<Switch checked onChange={() => {}} aria-label="Web search" />)
    expect(screen.getByRole('switch', { name: 'Web search' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  it('calls onChange with the flipped value on click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Switch checked={false} onChange={onChange} aria-label="Thinking mode" />)

    await user.click(screen.getByRole('switch', { name: 'Thinking mode' }))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('calls onChange on keyboard activation (Space)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Switch checked={false} onChange={onChange} aria-label="MCP Context7" />)

    await user.tab()
    await user.keyboard(' ')

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('does not call onChange when disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Switch checked={false} onChange={onChange} disabled aria-label="Web search" />)

    await user.click(screen.getByRole('switch', { name: 'Web search' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
