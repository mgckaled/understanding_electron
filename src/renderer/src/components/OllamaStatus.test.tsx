import { fireEvent, render, screen } from '@testing-library/react'
import { installApiMock } from '@test/api-mock'
import OllamaStatus from './OllamaStatus'

const ready = {
  ok: true,
  value: { service: 'ollama', version: '0.5.1', host: '127.0.0.1:11434' }
} as const

describe('OllamaStatus', () => {
  it('shows the version once the service answers', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)

    render(<OllamaStatus />)

    expect(await screen.findByText('Ollama v0.5.1')).toBeInTheDocument()
  })

  it('opens a popover with the host once the version is clicked', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)

    render(<OllamaStatus />)
    fireEvent.click(await screen.findByText('Ollama v0.5.1'))

    // getByText, not getByRole — it does not filter by the visibility jsdom gets
    // wrong for popover content (see the shim in test/setup-renderer.ts).
    expect(screen.getByText('127.0.0.1:11434')).toBeInTheDocument()
    expect(screen.getByText('Conectado')).toBeInTheDocument()
  })

  it('says the service is unavailable when the probe fails', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue({
      ok: false,
      error: { kind: 'unavailable', service: 'ollama', hint: 'rode ollama serve' }
    })

    render(<OllamaStatus />)

    expect(await screen.findByText('Ollama indisponível')).toBeInTheDocument()
  })

  it('shows the checking state while the probe is pending', () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockReturnValue(new Promise(() => {}))

    render(<OllamaStatus />)

    expect(screen.getByText('Verificando o Ollama…')).toBeInTheDocument()
  })
})
