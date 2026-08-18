import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock, TEST_MODEL } from '@test/api-mock'
import type { Api } from '@shared/ipc'
import App from './App'

const ready = { ok: true, value: { service: 'ollama', version: '0.5.1' } } as const

function mount(): Api {
  const api = installApiMock()
  vi.mocked(api.ai.isAvailable).mockResolvedValue(ready)
  vi.mocked(api.ai.models).mockResolvedValue({ ok: true, value: [TEST_MODEL] })
  render(<App />)
  return api
}

// F2.4 — the collapsed sidebar rail. Sidebar.test.tsx already covers the
// generic `collapsedRail` mechanism (render-prop + expand callback); this
// level checks App.tsx wired the four buttons it promised: direct action
// where one exists ("+", Configurações), expand-only where the rail has no
// room to show anything (Busca, Conversas).
describe('App — collapsed sidebar rail', () => {
  it('creates a conversation directly from the "+" button, without expanding', async () => {
    const api = mount()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Recolher a barra lateral' }))
    await user.click(screen.getByRole('button', { name: 'Nova conversa' }))

    await waitFor(() => expect(api.conversation.create).toHaveBeenCalled())
    expect(screen.queryByPlaceholderText('Buscar conversas')).not.toBeInTheDocument()
  })

  it('expands the sidebar from Busca, showing the search field again', async () => {
    mount()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Recolher a barra lateral' }))
    await user.click(screen.getByRole('button', { name: 'Buscar conversas' }))

    expect(screen.getByRole('button', { name: 'Recolher a barra lateral' })).toBeInTheDocument()
  })

  it('expands the sidebar from Conversas', async () => {
    mount()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Recolher a barra lateral' }))
    await user.click(screen.getByRole('button', { name: 'Ver conversas' }))

    expect(screen.getByRole('button', { name: 'Recolher a barra lateral' })).toBeInTheDocument()
  })

  it('opens Configurações directly from the collapsed rail, without expanding', async () => {
    mount()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Recolher a barra lateral' }))
    await user.click(screen.getByRole('button', { name: 'Configurações' }))

    expect(await screen.findByRole('dialog', { name: 'Configurações' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Recolher a barra lateral' })
    ).not.toBeInTheDocument()
  })
})
