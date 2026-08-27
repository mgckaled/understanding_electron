import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DatasetPager from './DatasetPager'

function mount(overrides: Partial<React.ComponentProps<typeof DatasetPager>> = {}): {
  onPageSize: ReturnType<typeof vi.fn>
} {
  const onPageSize = vi.fn()
  render(
    <DatasetPager
      first={1}
      shown={50}
      total={8412}
      pageSize={50}
      onPageSize={onPageSize}
      {...overrides}
    />
  )
  return { onPageSize }
}

describe('DatasetPager', () => {
  it('says which rows are on screen, out of how many', () => {
    mount()

    expect(screen.getByText('1–50 de 8.412')).toBeVisible()
  })

  it('says so plainly when there is no row at all', () => {
    mount({ shown: 0, total: 0 })

    expect(screen.getByText('Nenhuma linha')).toBeVisible()
  })

  // DF3D.4: greyed out because OFFSET is scheduled, not because it is refused.
  it('keeps the arrows in place and disabled while there is no paging', () => {
    mount()

    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
  })

  it('enables an arrow the moment it is given something to do', () => {
    mount({ onNext: vi.fn() })

    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
  })

  it('marks the page size in use and reports a new one', async () => {
    const { onPageSize } = mount()

    expect(screen.getByRole('button', { name: '50' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: '200' }))

    expect(onPageSize).toHaveBeenCalledWith(200)
  })
})
