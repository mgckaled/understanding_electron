import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PanelResizer from './PanelResizer'
import { DEFAULT_WIDTH, MIN_WIDTH, maxWidth } from './panelWidth'

// The drag itself is level 4: jsdom has no layout, so a pointer gesture here
// would measure a rect of zeros. What IS testable is the pattern's other half —
// the keyboard and the ARIA the APG specifies.
function mount(width = DEFAULT_WIDTH): {
  commit: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
} {
  const commit = vi.fn()
  const close = vi.fn()
  render(
    <PanelResizer
      panelId="panel-1"
      width={width}
      apply={vi.fn()}
      commit={commit}
      close={close}
    />
  )
  return { commit, close }
}

describe('PanelResizer', () => {
  it('is a window splitter, pointing at the panel it sizes', () => {
    mount()
    const handle = screen.getByRole('separator')

    expect(handle).toHaveAttribute('aria-controls', 'panel-1')
    expect(handle).toHaveAttribute('aria-orientation', 'vertical')
    expect(handle).toHaveAttribute('aria-valuemin', String(MIN_WIDTH))
    expect(handle).toHaveAttribute('aria-valuenow', String(DEFAULT_WIDTH))
  })

  it('grows to the left and shrinks to the right, the panel being anchored right', async () => {
    const { commit } = mount(500)
    screen.getByRole('separator').focus()

    await userEvent.keyboard('{ArrowLeft}')
    expect(commit).toHaveBeenLastCalledWith(516)

    await userEvent.keyboard('{ArrowRight}')
    expect(commit).toHaveBeenLastCalledWith(484)
  })

  it('jumps to the floor and to the ceiling', async () => {
    const { commit } = mount(500)
    screen.getByRole('separator').focus()

    await userEvent.keyboard('{Home}')
    expect(commit).toHaveBeenLastCalledWith(MIN_WIDTH)

    await userEvent.keyboard('{End}')
    expect(commit).toHaveBeenLastCalledWith(maxWidth())
  })

  it('closes the panel on Enter, which the pattern calls collapsing', async () => {
    const { close } = mount()
    screen.getByRole('separator').focus()

    await userEvent.keyboard('{Enter}')

    expect(close).toHaveBeenCalledOnce()
  })

  it('goes back to the default width on a double click', async () => {
    const { commit } = mount(700)

    await userEvent.dblClick(screen.getByRole('separator'))

    expect(commit).toHaveBeenCalledWith(DEFAULT_WIDTH)
  })
})
