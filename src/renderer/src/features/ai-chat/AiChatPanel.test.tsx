import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import type { ChatReply, Result } from '@shared/ipc'
import AiChatPanel from './AiChatPanel'

describe('AiChatPanel', () => {
  it('shows the hint and disables the input when Ollama is unavailable', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue({
      ok: false,
      error: { kind: 'unavailable', service: 'ollama', hint: 'Rode ollama serve na porta 11434.' }
    })

    render(<AiChatPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('ollama serve')
    expect(screen.getByPlaceholderText('Pergunte algo ao modelo…')).toBeDisabled()
  })

  it('sends the prompt and renders the assistant reply', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue({
      ok: true,
      value: { service: 'ollama', version: '0.5.1' }
    })
    vi.mocked(api.ai.chat).mockResolvedValue({ ok: true, value: { content: 'Olá!' } })
    const user = userEvent.setup()

    render(<AiChatPanel />)
    await screen.findByText('Ollama 0.5.1')
    await user.type(screen.getByPlaceholderText('Pergunte algo ao modelo…'), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText('Olá!')).toBeInTheDocument()
    expect(screen.getByText('oi')).toBeInTheDocument()
    expect(api.ai.chat).toHaveBeenCalledWith(
      {
        service: 'ollama',
        model: 'gemma3:4b',
        messages: [{ role: 'user', content: 'oi' }],
        numThread: 4
      },
      expect.any(String)
    )
  })

  it('cancels the in-flight job with the jobId used for the chat', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue({
      ok: true,
      value: { service: 'ollama', version: '0.5.1' }
    })
    vi.mocked(api.ai.chat).mockReturnValue(new Promise<Result<ChatReply>>(() => {}))
    const user = userEvent.setup()

    render(<AiChatPanel />)
    await screen.findByText('Ollama 0.5.1')
    await user.type(screen.getByPlaceholderText('Pergunte algo ao modelo…'), 'oi')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))

    const usedJobId = vi.mocked(api.ai.chat).mock.calls[0]?.[1]
    expect(api.job.cancel).toHaveBeenCalledWith(usedJobId)
  })
})
