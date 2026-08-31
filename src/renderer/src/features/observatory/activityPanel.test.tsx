import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { installApiMock } from '@test/api-mock'
import type { AppIpcStat, JobId } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import ActivityPanel from './ActivityPanel'

function renderPanel(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ActivityPanel />
    </QueryClientProvider>
  )
}

describe('ActivityPanel', () => {
  it('lists IPC channels with their call count', async () => {
    const api = installApiMock()
    const stats: AppIpcStat[] = [
      {
        channel: 'dataset:query',
        callCount: 3,
        errorCount: 0,
        lastDurationMs: 12.4,
        lastError: null
      }
    ]
    vi.mocked(api.app.ipcStats).mockResolvedValue(stats)

    renderPanel()

    const row = (await screen.findByText('dataset:query')).closest('tr')
    expect(row).toHaveTextContent('3')
  })

  it('reports the count of active jobs and their ids', async () => {
    const api = installApiMock()
    const ids: JobId[] = ['job-a', 'job-b']
    vi.mocked(api.job.list).mockResolvedValue(ids)

    renderPanel()

    expect(await screen.findByText('2 em andamento')).toBeInTheDocument()
    expect(screen.getByText('job-a')).toBeInTheDocument()
  })

  it('says zero jobs when none are active', async () => {
    const api = installApiMock()
    vi.mocked(api.job.list).mockResolvedValue([])

    renderPanel()

    expect(await screen.findByText('0 em andamento')).toBeInTheDocument()
  })

  it('reports the worker queue depth', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.queueDepth).mockResolvedValue(2)

    renderPanel()

    expect(await screen.findByText('2 requisições em voo')).toBeInTheDocument()
  })

  it('says so when no channel has been called yet', async () => {
    const api = installApiMock()
    vi.mocked(api.app.ipcStats).mockResolvedValue([])

    renderPanel()

    expect(await screen.findByText('Nenhum canal chamado ainda.')).toBeInTheDocument()
  })
})
