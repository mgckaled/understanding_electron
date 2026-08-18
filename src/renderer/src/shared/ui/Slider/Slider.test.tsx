import { fireEvent, render, screen } from '@testing-library/react'
import Slider from './Slider'

// jsdom does not implement a range input's native keyboard/drag stepping (the
// browser's own default action, like Popover's light-dismiss) — this level
// checks the same thing every other jsdom form-control test here checks: a
// `change` event (what a completed drag or a keypress both produce) reaches
// `onChange` with the parsed value. Level 4 covers the real drag.
const TICKS = [
  { value: 1024, label: '1k' },
  { value: 4096, label: '4k' },
  { value: 32768, label: '32k' }
]

describe('Slider', () => {
  it('renders a tick label for each entry', () => {
    render(
      <Slider min={1024} max={32768} step={1024} value={4096} onChange={() => {}} ticks={TICKS} />
    )
    expect(screen.getByText('1k')).toBeInTheDocument()
    expect(screen.getByText('4k')).toBeInTheDocument()
    expect(screen.getByText('32k')).toBeInTheDocument()
  })

  it('calls onChange with the parsed numeric value', () => {
    const onChange = vi.fn()
    render(
      <Slider min={1024} max={32768} step={1024} value={4096} onChange={onChange} ticks={TICKS} />
    )

    fireEvent.change(screen.getByRole('slider'), { target: { value: '8192' } })

    expect(onChange).toHaveBeenCalledWith(8192)
  })

  it('disables the input', () => {
    render(
      <Slider
        min={1024}
        max={32768}
        step={1024}
        value={4096}
        onChange={() => {}}
        ticks={TICKS}
        disabled
      />
    )
    expect(screen.getByRole('slider')).toBeDisabled()
  })
})
