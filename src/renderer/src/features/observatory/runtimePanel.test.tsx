import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { installApiMock } from '@test/api-mock'
import type { AppInfo } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import RuntimePanel from './RuntimePanel'

const APP_INFO: AppInfo = {
  electron: '42.0.0',
  chrome: '148.0.0',
  node: '24.18.0',
  app: '1.0.0',
  platform: 'win32',
  isDev: true
}

function renderPanel(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RuntimePanel />
    </QueryClientProvider>
  )
}

describe('RuntimePanel', () => {
  it('renders neither versions nor an error while loading', () => {
    const api = installApiMock()
    vi.mocked(api.app.info).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.app.memory).mockReturnValue(new Promise(() => {}))

    renderPanel()

    expect(screen.queryByRole('definition')).not.toBeInTheDocument()
    expect(screen.queryByText('Não foi possível ler as versões.')).not.toBeInTheDocument()
  })

  it('renders the resolved versions', async () => {
    const api = installApiMock()
    vi.mocked(api.app.info).mockResolvedValue(APP_INFO)

    renderPanel()

    expect(await screen.findByText('v42.0.0')).toBeInTheDocument()
    expect(screen.getByText('v148.0.0')).toBeInTheDocument()
    expect(screen.getByText('v24.18.0')).toBeInTheDocument()
    expect(screen.getByText('win32')).toBeInTheDocument()
  })

  it('shows an error message when the channel rejects', async () => {
    const api = installApiMock()
    vi.mocked(api.app.info).mockRejectedValue(new Error('boom'))

    renderPanel()

    expect(await screen.findByText('Não foi possível ler as versões.')).toBeInTheDocument()
  })

  it('renders free and total memory in gigabytes', async () => {
    const api = installApiMock()
    vi.mocked(api.app.memory).mockResolvedValue({
      freeBytes: 6 * 1024 ** 3,
      totalBytes: 16 * 1024 ** 3
    })

    renderPanel()

    expect(await screen.findByText('6,0 GB')).toBeInTheDocument()
    expect(screen.getByText('16,0 GB')).toBeInTheDocument()
  })
})
