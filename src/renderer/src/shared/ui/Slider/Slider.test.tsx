import { fireEvent, render, screen } from '@testing-library/react'
import Slider from './Slider'

// jsdom does not implement a range input's native keyboard/drag stepping (the
// browser's own default action, like Popover's light-dismiss). This level
// checks the two DOM events a real drag produces, fired directly:
// `input` (every step, what React's onChange maps to) and `change` (once on
// release, what the component's own native listener commits on). Level 4
// covers the real drag.
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

  it('calls onChangeCommitted on the native change event, not on every drag step', () => {
    const onChange = vi.fn()
    const onChangeCommitted = vi.fn()
    render(
      <Slider
        min={1024}
        max={32768}
        step={1024}
        value={4096}
        onChange={onChange}
        onChangeCommitted={onChangeCommitted}
        ticks={TICKS}
      />
    )
    const input = screen.getByRole('slider')

    // A real drag fires the DOM `input` event on every step and `change`
    // once on release — the same distinction the component now relies on
    // (a raw addEventListener('change'), not React's onChange, which maps
    // to `input`). fireEvent.input is what reaches React's onChange here;
    // fireEvent.change is the commit.
    fireEvent.input(input, { target: { value: '8192' } })
    expect(onChange).toHaveBeenCalledWith(8192)
    expect(onChangeCommitted).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '8192' } })
    expect(onChangeCommitted).toHaveBeenCalledWith(8192)
  })

  it('sets aria-valuetext to the matching tick label, and leaves it unset off-tick', () => {
    const { rerender } = render(
      <Slider min={1024} max={32768} step={1024} value={4096} onChange={() => {}} ticks={TICKS} />
    )
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '4k')

    rerender(
      <Slider min={1024} max={32768} step={1024} value={5120} onChange={() => {}} ticks={TICKS} />
    )
    expect(screen.getByRole('slider')).not.toHaveAttribute('aria-valuetext')
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
