import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Api, DocsPart, Message } from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { providers } from '@test/renderer-providers'
import MessageList from '../conversation/MessageList'

const PART: DocsPart = {
  kind: 'docs',
  id: 'd1',
  libraryId: '/tanstack/query',
  libraryTitle: 'TanStack Query',
  version: 'v5.90.3',
  query: 'invalidar cache depois de mutação',
  enabled: true,
  snippets: [
    {
      key: 's1',
      title: 'invalidateQueries após mutação',
      description: 'Chame `invalidateQueries` no `onSuccess`.',
      tokens: 182,
      blocks: [{ language: 'ts', code: 'queryClient.invalidateQueries({ queryKey: [] })' }],
      pageTitle: 'Mutations',
      sourceUrl: 'https://github.com/tanstack/query/blob/main/docs/guides/mutations.md'
    }
  ],
  notes: [
    {
      key: 'n1',
      breadcrumb: 'Reference > QueryClient',
      content: 'O cliente expõe `invalidateQueries`.',
      tokens: 96,
      sourceUrl: null
    }
  ],
  omitted: [{ key: 's2', kind: 'snippet', title: 'setQueryData otimista', tokens: 241 }],
  rules: null
}

const MESSAGE: Message = {
  id: 'm1',
  role: 'user',
  parts: [PART, { kind: 'text', text: 'como invalido o cache?' }],
  createdAt: 1000
}

let api: Api

/**
 * The transcript alone, over a conversation that really holds the message —
 * `setDocsEnabled` runs against the real handler on `:memory:` (store-api), so
 * what the toggle wrote is read back instead of asserted on a spy.
 */
async function mount(part: DocsPart = PART): Promise<void> {
  api = installApiMock()
  await api.conversation.create({ id: 'c1', title: 'Primeira', createdAt: 1000 })
  const message: Message = { ...MESSAGE, parts: [part, { kind: 'text', text: 'como invalido?' }] }
  await api.conversation.append('c1', message)
  render(providers(<MessageList messages={[message]} service="ollama" />))
  await waitFor(() => expect(screen.getByText(/Context7/)).toBeInTheDocument())
}

async function storedEnabled(): Promise<boolean> {
  const messages = await api.conversation.messages('c1')
  const found = messages[0].parts.find((one) => one.kind === 'docs')
  if (found?.kind !== 'docs') throw new Error('a parte de docs sumiu da transcrição')
  return found.enabled
}

describe('DocsLine', () => {
  it('resume a consulta sem abrir, e nomeia a procedência', async () => {
    await mount()

    expect(screen.getByText('Context7 · /tanstack/query')).toBeInTheDocument()
    expect(screen.getByText('1 trecho · 1 nota · ~278 tok')).toBeInTheDocument()
    // Closed by default: a historical turn does not open itself.
    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument()
  })

  it('abre listando títulos e custo, e nunca o código', async () => {
    const user = userEvent.setup()
    await mount()

    await user.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText('invalidateQueries após mutação')).toBeInTheDocument()
    expect(screen.getByText('Reference > QueryClient')).toBeInTheDocument()
    expect(screen.getByText('“invalidar cache depois de mutação”')).toBeInTheDocument()
    // The panel owns the code; this line answers what was sent and what it cost.
    expect(screen.queryByText(/invalidateQueries\(\{/)).not.toBeInTheDocument()
  })

  it('registra o que ficou de fora, com título e custo e sem código', async () => {
    const user = userEvent.setup()
    await mount()

    await user.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText('setQueryData otimista')).toBeInTheDocument()
    expect(screen.getByText('— não enviado')).toBeInTheDocument()
  })

  it('desliga a consulta do reenvio e grava a escolha', async () => {
    const user = userEvent.setup()
    await mount()
    expect(await storedEnabled()).toBe(true)

    await user.click(screen.getByRole('switch'))

    await waitFor(async () => expect(await storedEnabled()).toBe(false))
  })

  it('diz na transcrição que a consulta está fora do contexto', async () => {
    await mount({ ...PART, enabled: false })

    expect(screen.getByText('fora do contexto')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('não anuncia nada quando a consulta está no contexto', async () => {
    await mount()

    expect(screen.queryByText('fora do contexto')).not.toBeInTheDocument()
  })
})
