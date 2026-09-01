import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { installApiMock } from '@test/api-mock'
import type { DatabaseInfo } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import DatabasePanel from './DatabasePanel'

const INFO: DatabaseInfo = {
  migrationVersion: 5,
  sizeBytes: 3 * 1024 * 1024,
  freelistCount: 2,
  tables: [
    { name: 'conversations', rowCount: 12 },
    { name: 'messages', rowCount: 340 }
  ]
}

function renderPanel(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DatabasePanel />
    </QueryClientProvider>
  )
}

describe('DatabasePanel', () => {
  it('shows the migration version and table row counts', async () => {
    const api = installApiMock()
    vi.mocked(api.database.info).mockResolvedValue(INFO)

    renderPanel()

    expect(await screen.findByText('5')).toBeInTheDocument()
    const row = screen.getByText('messages').closest('tr')
    expect(row).toHaveTextContent('340')
  })

  it('shows an error instead of a blank panel on failure', async () => {
    const api = installApiMock()
    vi.mocked(api.database.info).mockRejectedValue(new Error('boom'))

    renderPanel()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
