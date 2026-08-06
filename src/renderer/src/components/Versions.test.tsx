import { render, screen } from '@testing-library/react'
import { installApiMock } from '@test/api-mock'
import type { AppInfo } from '@shared/ipc'
import Versions from './Versions'

const APP_INFO: AppInfo = {
  electron: '42.0.0',
  chrome: '148.0.0',
  node: '24.18.0',
  app: '1.0.0',
  platform: 'win32',
  isDev: true
}

describe('Versions', () => {
  it('renders neither versions nor an error while loading', () => {
    const api = installApiMock()
    vi.mocked(api.app.info).mockReturnValue(new Promise(() => {}))

    render(<Versions />)

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(screen.queryByText('Não foi possível carregar as versões.')).not.toBeInTheDocument()
  })

  it('renders the resolved versions', async () => {
    const api = installApiMock()
    vi.mocked(api.app.info).mockResolvedValue(APP_INFO)

    render(<Versions />)

    expect(await screen.findByText('Electron v42.0.0')).toBeInTheDocument()
    expect(screen.getByText('Chromium v148.0.0')).toBeInTheDocument()
    expect(screen.getByText('Node v24.18.0')).toBeInTheDocument()
  })

  it('shows an error message when the channel rejects', async () => {
    const api = installApiMock()
    vi.mocked(api.app.info).mockRejectedValue(new Error('boom'))

    render(<Versions />)

    expect(await screen.findByText('Não foi possível carregar as versões.')).toBeInTheDocument()
  })
})
