import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { installApiMock } from '@test/api-mock'
import type { AppProcess } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import ProcessesPanel from './ProcessesPanel'

const PROCESSES: AppProcess[] = [
  { pid: 10, type: 'Browser', cpuPercent: 2.5, memoryBytes: 220 * 1024 ** 2 },
  { pid: 20, type: 'Utility', name: 'DuckDB', cpuPercent: 0, memoryBytes: 90 * 1024 ** 2 },
  { pid: 30, type: 'GPU', cpuPercent: 1, memoryBytes: 60 * 1024 ** 2 }
]

function renderPanel(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ProcessesPanel />
    </QueryClientProvider>
  )
}

describe('ProcessesPanel', () => {
  // The payoff the panel exists for: the DuckDB worker shows up as its own row
  // with no instrumentation, and it is identifiable — which only holds because
  // the fork passes `serviceName` (passo 4).
  it('names the data worker in its own Utility row', async () => {
    const api = installApiMock()
    vi.mocked(api.app.processes).mockResolvedValue(PROCESSES)

    renderPanel()

    const row = (await screen.findByText('DuckDB', { exact: false })).closest('tr')
    expect(row).toHaveTextContent('Utilitário')
    expect(row).toHaveTextContent('20')
  })

  it('translates Electron process types out of browser vocabulary', async () => {
    const api = installApiMock()
    vi.mocked(api.app.processes).mockResolvedValue(PROCESSES)

    renderPanel()

    expect(await screen.findByText('Principal')).toBeInTheDocument()
    expect(screen.queryByText('Browser')).not.toBeInTheDocument()
  })

  it('renders memory in gigabytes and cpu as a percentage', async () => {
    const api = installApiMock()
    vi.mocked(api.app.processes).mockResolvedValue([PROCESSES[0]])

    renderPanel()

    expect(await screen.findByText('0,2 GB')).toBeInTheDocument()
    expect(screen.getByText('2,5 %')).toBeInTheDocument()
  })

  it('says so when the runtime reports nothing', async () => {
    const api = installApiMock()
    vi.mocked(api.app.processes).mockResolvedValue([])

    renderPanel()

    expect(await screen.findByText('Nenhum processo relatado.')).toBeInTheDocument()
  })
})
