import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { installApiMock, TEST_MODEL } from '@test/api-mock'
import type { AiAvailability, AiService } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import { useCapabilities } from './useCapabilities'

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
}

function availability(service: AiService): AiAvailability {
  return { service, version: '1.0' }
}

describe('useCapabilities', () => {
  it('calls nothing until refetch is invoked', () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockResolvedValue({ ok: true, value: availability('ollama') })

    renderHook(() => useCapabilities(), { wrapper })

    expect(api.ai.isAvailable).not.toHaveBeenCalled()
    expect(api.ai.models).not.toHaveBeenCalled()
    expect(api.ai.loaded).not.toHaveBeenCalled()
    expect(api.secrets.has).not.toHaveBeenCalled()
  })

  it('sondas every service after refetch, and one dead service does not hide the others', async () => {
    const api = installApiMock()
    vi.mocked(api.ai.isAvailable).mockImplementation(async (service) => {
      if (service === 'glm') throw new Error('daemon down')
      return { ok: true, value: availability(service) }
    })
    vi.mocked(api.ai.models).mockResolvedValue({ ok: true, value: [TEST_MODEL] })
    vi.mocked(api.secrets.has).mockResolvedValue(true)

    const { result } = renderHook(() => useCapabilities(), { wrapper })
    act(() => result.current.refetch())

    await waitFor(() => expect(result.current.data).toBeDefined())

    // Four since N-3-C: 'ollama-cloud' is an AI service of its own (DNC-8).
    expect(api.ai.isAvailable).toHaveBeenCalledTimes(4)
    expect(api.ai.models).toHaveBeenCalledTimes(4)
    expect(api.ai.loaded).toHaveBeenCalledTimes(1)
    // Four, not three: Context7 holds a credential without being an AI service
    // (D23B.4), and 'ollama-cloud' is the first value in BOTH sets at once.
    expect(api.secrets.has).toHaveBeenCalledTimes(4)

    expect(result.current.data?.services.ollama.availability.status).toBe('ready')
    expect(result.current.data?.services.gemini.availability.status).toBe('ready')
    expect(result.current.data?.services.glm.availability.status).toBe('error')
    expect(result.current.data?.services['ollama-cloud'].availability.status).toBe('ready')
  })
})
