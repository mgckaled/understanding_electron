import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import Popover from './Popover'
import { toAnchorName } from './anchorName'

// jsdom drives this through the shim in test/setup-renderer.ts, not the real
// platform — light-dismiss, Esc and anchor positioning are level 4 only (see the
// shim's own comment). What this level checks: the component mounts, `open`
// drives visibility, and a browser-initiated close (the `toggle` event) reaches
// `onClose` — the one path back to React state this component owns.

function Harness(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const anchorName = toAnchorName('test')

  return (
    <div>
      <button style={{ anchorName }} onClick={() => setOpen((current) => !current)}>
        Trigger
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorName={anchorName}>
        Panel content
      </Popover>
    </div>
  )
}

describe('Popover', () => {
  it('does not show the panel until open', () => {
    render(
      <Popover open={false} onClose={() => {}} anchorName="--x">
        Content
      </Popover>
    )
    expect(screen.getByText('Content')).not.toHaveAttribute('data-popover-open-shim')
  })

  it('shows the panel once open becomes true', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))
    expect(screen.getByText('Panel content').closest('[popover]')).toHaveAttribute(
      'data-popover-open-shim'
    )
  })

  it('calls onClose when the platform closes the popover (light-dismiss, Esc)', () => {
    const onClose = vi.fn()
    render(
      <Popover open onClose={onClose} anchorName="--x">
        Content
      </Popover>
    )
    const panel = screen.getByText('Content').closest('[popover]')
    expect(panel).not.toBeNull()

    // Simulates the browser closing it on its own — the exact event Popover
    // listens for to mirror the close back into React state.
    panel?.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('toAnchorName strips characters invalid in a CSS dashed-ident', () => {
    expect(toAnchorName(':r0:')).toBe('--popover-r0')
  })
})
