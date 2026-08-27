import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DatasetPart } from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { fakeArtifactApi } from '@test/artifact-api'
import { ArtifactContext } from '../artifact/artifactContext'
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
        <ArtifactContext value={fakeArtifactApi(null)}>
          <DatasetCard part={PART} />
        </ArtifactContext>
      </ConversationsProvider>
    </QueryClientProvider>
  )
}

// Opening the panel is proven in attachmentTrigger.test.tsx, with the two
// other cards. What is only here is the request aimed at the model.
describe('DatasetCard', () => {
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
