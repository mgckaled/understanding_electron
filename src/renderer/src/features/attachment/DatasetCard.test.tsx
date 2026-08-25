import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DatasetPart } from '@shared/ipc'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
import { installApiMock } from '@test/api-mock'
import { createQueryClient } from '../../shared/queryClient'
import ConversationsProvider from '../conversation/ConversationsProvider'
import DatasetCard from './DatasetCard'

const PART: DatasetPart = {
  kind: 'dataset',
  hash: 'h1',
  fileName: 'clientes.csv',
  format: 'delimited',
  delimiter: ',',
  columns: ['id', 'nome'],
  rowCount: 10
}

function mount(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ConversationsProvider>
        <DatasetCard part={PART} />
      </ConversationsProvider>
    </QueryClientProvider>
  )
}

describe('DatasetCard', () => {
  it('renders the preview automatically, with no click', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({ id: [1n], nome: ['Ana'] })
    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: bytes })

    mount()

    expect(await screen.findByText('Ana')).toBeVisible()
    expect(api.dataset.query).toHaveBeenCalledWith('h1', 'SELECT * FROM dataset LIMIT 50')
  })

  it('shows the preview or the query panel, never both at once', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.query).mockResolvedValue({
      ok: true,
      value: columnsToArrowBytes({ id: [1n] })
    })
    const user = userEvent.setup()

    mount()
    await screen.findByText('1')
    expect(screen.queryByLabelText('Consulta SQL')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Consultar' }))

    expect(screen.getByLabelText('Consulta SQL')).toBeInTheDocument()
    expect(screen.queryByText('1')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ver amostra' }))

    expect(await screen.findByText('1')).toBeVisible()
    expect(screen.queryByLabelText('Consulta SQL')).not.toBeInTheDocument()
  })

  describe('Propor passos (plano 19)', () => {
    it('shows a guidance error when the conversation has no model chosen', async () => {
      installApiMock()
      const user = userEvent.setup()

      mount()
      await user.click(screen.getByRole('button', { name: 'Propor passos' }))
      await user.type(screen.getByLabelText('Pedido em português'), 'filtre idade maior que 18')
      await user.click(screen.getByRole('button', { name: 'Enviar pedido' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Escolha um modelo')
    })

    it('requests a proposal and appends it as a new assistant message', async () => {
      const api = installApiMock()
      const conversationId = 'c1'
      await api.conversation.create({ id: conversationId, title: 'Vendas', createdAt: 1 })
      await api.conversation.updateSettings(conversationId, { model: 'gemma3:4b' })
      vi.mocked(api.ai.propose).mockResolvedValue({
        ok: true,
        value: {
          kind: 'steps',
          steps: [{ kind: 'filter', column: 'idade', operator: 'gt', value: 18 }]
        }
      })
      const user = userEvent.setup()

      mount()
      await user.click(screen.getByRole('button', { name: 'Propor passos' }))
      await user.type(screen.getByLabelText('Pedido em português'), 'filtre idade maior que 18')
      await user.click(screen.getByRole('button', { name: 'Enviar pedido' }))

      expect(api.ai.propose).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'ollama',
          model: 'gemma3:4b',
          hash: 'h1',
          request: 'filtre idade maior que 18'
        }),
        expect.any(String)
      )
      const messages = await api.conversation.messages(conversationId)
      const appended = messages.find((message) => message.role === 'assistant')
      expect(appended?.parts).toEqual([
        {
          kind: 'stepProposal',
          hash: 'h1',
          proposalKind: 'steps',
          steps: [{ kind: 'filter', column: 'idade', operator: 'gt', value: 18 }]
        }
      ])
    })
  })
})
