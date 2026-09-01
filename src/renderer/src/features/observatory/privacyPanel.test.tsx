import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { installApiMock } from '@test/api-mock'
import type { PrivacyLedger } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import PrivacyPanel from './PrivacyPanel'

const LEDGER: PrivacyLedger = {
  rows: [
    {
      id: 1,
      service: 'gemini',
      model: 'gemini-2.0-flash',
      datasetCount: 1,
      documentCount: 0,
      imageCount: 2,
      createdAt: Date.now()
    },
    {
      id: 2,
      service: 'glm',
      model: 'glm-4.6',
      datasetCount: 0,
      documentCount: 0,
      imageCount: 0,
      createdAt: Date.now()
    }
  ],
  totalCalls: 42,
  callsWithAttachment: 7
}

function renderPanel(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <PrivacyPanel />
    </QueryClientProvider>
  )
}

describe('PrivacyPanel', () => {
  it('shows the retention-wide totals in the header, not just the visible rows', async () => {
    const api = installApiMock()
    vi.mocked(api.privacy.list).mockResolvedValue(LEDGER)

    renderPanel()

    expect(await screen.findByText(/42 chamadas de nuvem/)).toBeInTheDocument()
    expect(screen.getByText(/7 com anexo/)).toBeInTheDocument()
  })

  it('uses the singular for a single call, found live (0 chamadas seria igualmente estranho)', async () => {
    const api = installApiMock()
    vi.mocked(api.privacy.list).mockResolvedValue({
      ...LEDGER,
      rows: [LEDGER.rows[0]],
      totalCalls: 1,
      callsWithAttachment: 1
    })

    renderPanel()

    expect(await screen.findByText(/1 chamada de nuvem/)).toBeInTheDocument()
  })

  it('labels a call with attachments by kind, never as a cumulative total', async () => {
    const api = installApiMock()
    vi.mocked(api.privacy.list).mockResolvedValue(LEDGER)

    renderPanel()

    const cloudRow = (await screen.findByText(/gemini-2.0-flash/)).closest('tr')
    expect(cloudRow).toHaveTextContent('3 · dataset, imagem')
  })

  it('shows 0 for a text-only cloud call, not an empty cell', async () => {
    const api = installApiMock()
    vi.mocked(api.privacy.list).mockResolvedValue(LEDGER)

    renderPanel()

    const textOnlyRow = (await screen.findByText(/glm-4.6/)).closest('tr')
    // Scoped to the attachment cell, not the row: 'glm-4.6' itself contains
    // no '0', but a row-wide match would pass even if the cell were empty.
    const cells = within(textOnlyRow as HTMLElement).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent('0')
  })

  it('shows an error instead of a blank panel on failure', async () => {
    const api = installApiMock()
    vi.mocked(api.privacy.list).mockRejectedValue(new Error('boom'))

    renderPanel()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
