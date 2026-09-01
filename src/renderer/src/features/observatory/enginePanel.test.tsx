import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { installApiMock } from '@test/api-mock'
import type { DuckDbEngineInfo } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import EnginePanel from './EnginePanel'

const INFO: DuckDbEngineInfo = {
  memoryLimit: '2.0GiB',
  extensions: [{ name: 'excel', loaded: true, installed: true, version: 'v1.4.0' }],
  memoryByTag: [{ tag: 'BASE_TABLE', bytes: 512 * 1024 ** 2 }]
}

function renderPanel(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <EnginePanel />
    </QueryClientProvider>
  )
}

describe('EnginePanel', () => {
  it('shows the memory limit in effect, read from the engine, not a constant', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.engineInfo).mockResolvedValue({ ok: true, value: INFO })

    renderPanel()

    expect(await screen.findByText('2.0GiB')).toBeInTheDocument()
  })

  it('names the vendored excel extension with its version', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.engineInfo).mockResolvedValue({ ok: true, value: INFO })

    renderPanel()

    const row = (await screen.findByText('excel')).closest('tr')
    expect(row).toHaveTextContent('carregada')
    expect(row).toHaveTextContent('v1.4.0')
  })

  it('scales a sub-gigabyte memory tag instead of rounding it to 0,0 GB', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.engineInfo).mockResolvedValue({ ok: true, value: INFO })

    renderPanel()

    expect(await screen.findByText('512,0 MB')).toBeInTheDocument()
  })

  it('shows an error instead of a blank panel when the worker rejects', async () => {
    const api = installApiMock()
    vi.mocked(api.dataset.engineInfo).mockResolvedValue({
      ok: false,
      error: { kind: 'invalidQuery', message: 'DuckDB worker exited (code 137)' }
    })

    renderPanel()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
