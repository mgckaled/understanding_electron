import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import { createQueryClient } from '../../shared/queryClient'
import ChromiumCachePanel from './ChromiumCachePanel'

function renderPanel(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ChromiumCachePanel />
    </QueryClientProvider>
  )
}

describe('ChromiumCachePanel', () => {
  it('reads the cache size on mount, no button gating it', async () => {
    const api = installApiMock()
    vi.mocked(api.session.cacheSize).mockResolvedValue(127_452_694)

    renderPanel()

    expect(await screen.findByText('121,5 MB')).toBeInTheDocument()
    expect(api.session.cacheSize).toHaveBeenCalledTimes(1)
  })

  it('clears the cache and re-reads the size', async () => {
    const user = userEvent.setup()
    const api = installApiMock()
    vi.mocked(api.session.cacheSize).mockResolvedValueOnce(1_000_000).mockResolvedValue(0)
    vi.mocked(api.session.clearCache).mockResolvedValue(undefined)

    renderPanel()
    await screen.findByText('976,6 KB')
    await user.click(screen.getByRole('button', { name: 'Limpar cache' }))

    expect(api.session.clearCache).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('0 B')).toBeInTheDocument()
  })

  it('shows an error instead of a blank panel on failure', async () => {
    const api = installApiMock()
    vi.mocked(api.session.cacheSize).mockRejectedValue(new Error('boom'))

    renderPanel()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
