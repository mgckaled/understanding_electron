import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
import { installApiMock } from '@test/api-mock'
import { createQueryClient } from '../../shared/queryClient'
import { useDatasetPreview } from './useDatasetPreview'

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
}

describe('useDatasetPreview', () => {
  it('starts loading, then resolves to ready with the decoded table', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({ id: [1n, 2n], name: ['Ana', 'Bruno'] })
    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: bytes })

    const { result } = renderHook(() => useDatasetPreview('h1'), { wrapper })

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(api.dataset.query).toHaveBeenCalledWith('h1', 'SELECT * FROM dataset LIMIT 50')
    expect(result.current.status === 'ready' && result.current.data.numRows).toBe(2)
  })

  it('surfaces the engine error when the Result is not ok', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.query).mockResolvedValue({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Binder Error: column "x" not found' }
    })

    const { result } = renderHook(() => useDatasetPreview('h1'), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.status === 'error' && result.current.error.kind).toBe('invalidQuery')
  })

  it('surfaces an error when the IPC call itself rejects', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.query).mockRejectedValue(new Error('worker crashed'))

    const { result } = renderHook(() => useDatasetPreview('h1'), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('reports empty for a file with no data rows', async () => {
    const api = installApiMock()
    const bytes = columnsToArrowBytes({ id: [] })
    vi.mocked(api.dataset.query).mockResolvedValue({ ok: true, value: bytes })

    const { result } = renderHook(() => useDatasetPreview('h1'), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('empty'))
  })
})
