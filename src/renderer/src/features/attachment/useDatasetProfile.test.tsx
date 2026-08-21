import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ColumnProfile } from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { createQueryClient } from '../../shared/queryClient'
import { useDatasetProfile } from './useDatasetProfile'

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
}

const PROFILE: ColumnProfile[] = [
  {
    column: 'idade',
    type: 'BIGINT',
    nullPercentage: 0,
    approxUnique: 40,
    min: '18',
    max: '65',
    avg: 34.2
  }
]

describe('useDatasetProfile', () => {
  it('stays idle and never calls the channel while disabled', () => {
    const api = installApiMock()

    const { result } = renderHook(() => useDatasetProfile('h1', false), { wrapper })

    expect(result.current.status).toBe('idle')
    expect(api.dataset.profile).not.toHaveBeenCalled()
  })

  it('starts loading once enabled, then resolves to ready', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.profile).mockResolvedValue({ ok: true, value: PROFILE })

    const { result } = renderHook(() => useDatasetProfile('h1', true), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(api.dataset.profile).toHaveBeenCalledWith('h1')
    expect(result.current.status === 'ready' && result.current.data).toEqual(PROFILE)
  })

  it('surfaces the engine error when the Result is not ok', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.profile).mockResolvedValue({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Out of Memory Error' }
    })

    const { result } = renderHook(() => useDatasetProfile('h1', true), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.status === 'error' && result.current.error.kind).toBe('invalidQuery')
  })
})
