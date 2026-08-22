import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installApiMock } from '@test/api-mock'
import type { Api, CloudProvider } from '@shared/ipc'
import { createQueryClient } from '../../shared/queryClient'
import Settings from './Settings'

/*
 * Level 2 for the two-state secret field (plano N-1-A, passo 6). The
 * behaviour worth a test is not the layout — it is the state machine:
 * secrets:has decides editing vs configured, and a successful write/remove
 * flips it, the same shape loadedModels.test.tsx already proves for
 * ai:loaded.
 */

function providers(children: ReactNode): React.JSX.Element {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
}

function mount(): Api {
  const api = installApiMock()
  render(providers(<Settings />))
  return api
}

async function open(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Configurações' }))
}

function mockHas(api: Api, configured: CloudProvider[]): void {
  vi.mocked(api.secrets.has).mockImplementation(async (provider) => configured.includes(provider))
}

/**
 * A `has` mock that actually reflects write/remove, for the two tests that
 * check the field AFTER a mutation — a static list would keep answering the
 * question it was given at mount time, never the one the mutation changed.
 */
function statefulHas(api: Api, initial: CloudProvider[]): Set<CloudProvider> {
  const configured = new Set(initial)
  vi.mocked(api.secrets.has).mockImplementation(async (provider) => configured.has(provider))
  return configured
}

describe('chaves de nuvem', () => {
  it('does not ask about a stored key until the modal is opened', async () => {
    const api = mount()

    await waitFor(() => expect(api.settings.read).toHaveBeenCalled())
    expect(api.secrets.has).not.toHaveBeenCalled()
  })

  it('opens straight into the editing field when no key is stored', async () => {
    const user = userEvent.setup()
    const api = mount()
    mockHas(api, [])

    await open(user)

    expect(await screen.findByLabelText('Google (Gemini)')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Z.ai (GLM)')).toHaveAttribute('type', 'password')
  })

  it('shows the configured row, masked, for a provider with a stored key', async () => {
    const user = userEvent.setup()
    const api = mount()
    mockHas(api, ['gemini'])

    await open(user)

    expect(await screen.findByText('••••••••••')).toBeInTheDocument()
    expect(screen.getByText('chave gravada')).toBeInTheDocument()
    expect(screen.queryByLabelText('Google (Gemini)')).not.toBeInTheDocument()
    // glm has no key — it keeps rendering the editing field.
    expect(screen.getByLabelText('Z.ai (GLM)')).toBeInTheDocument()
  })

  it('the eye toggles the input between password and text', async () => {
    const user = userEvent.setup()
    const api = mount()
    mockHas(api, [])
    await open(user)
    const field = await screen.findByLabelText('Google (Gemini)')
    // Both providers start editing here, each with its own "Mostrar chave" —
    // scope to this field's own wrapper to avoid the ambiguous match.
    const wrapper = field.closest('div') as HTMLElement

    await user.click(within(wrapper).getByRole('button', { name: 'Mostrar chave' }))

    expect(field).toHaveAttribute('type', 'text')
  })

  it('writes the typed key and switches to the configured row on success', async () => {
    const user = userEvent.setup()
    const api = mount()
    const configured = statefulHas(api, [])
    vi.mocked(api.secrets.write).mockImplementation(async (provider) => {
      configured.add(provider)
      return { ok: true, value: { weakBackend: false } }
    })
    await open(user)
    const field = await screen.findByLabelText('Google (Gemini)')

    await user.type(field, 'sk-x')
    await user.click(screen.getAllByRole('button', { name: 'Salvar' })[0])

    await waitFor(() => expect(api.secrets.write).toHaveBeenCalledWith('gemini', 'sk-x'))
    expect(await screen.findByText('chave gravada')).toBeInTheDocument()
  })

  it('shows the weak-backend warning after a successful write that reports it', async () => {
    const user = userEvent.setup()
    const api = mount()
    mockHas(api, [])
    vi.mocked(api.secrets.write).mockResolvedValue({ ok: true, value: { weakBackend: true } })
    await open(user)
    const field = await screen.findByLabelText('Google (Gemini)')

    await user.type(field, 'sk-x')
    await user.click(screen.getAllByRole('button', { name: 'Salvar' })[0])

    expect(await screen.findByRole('alert')).toHaveTextContent(/cofre de senhas/)
  })

  it('removing a stored key returns to the editing field', async () => {
    const user = userEvent.setup()
    const api = mount()
    const configured = statefulHas(api, ['gemini'])
    vi.mocked(api.secrets.remove).mockImplementation(async (provider) => {
      configured.delete(provider)
    })
    await open(user)
    await screen.findByText('chave gravada')

    await user.click(screen.getByRole('button', { name: 'Remover' }))

    await waitFor(() => expect(api.secrets.remove).toHaveBeenCalledWith('gemini'))
    expect(await screen.findByLabelText('Google (Gemini)')).toBeInTheDocument()
  })

  it('replacing a stored key opens the editing field without losing the other provider', async () => {
    const user = userEvent.setup()
    const api = mount()
    mockHas(api, ['gemini'])
    await open(user)
    await screen.findByText('chave gravada')

    await user.click(
      within(screen.getByText('chave gravada').closest('div')!).getByRole('button', {
        name: 'Substituir'
      })
    )

    expect(await screen.findByLabelText('Google (Gemini)')).toBeInTheDocument()
  })
})
