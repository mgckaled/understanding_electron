import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Api, DocsPart, Message } from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { providers } from '@test/renderer-providers'
import { useConversations } from '../conversation/conversationsContext'
import { useDocs } from './docsContext'
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

const PANEL = { name: 'Consulta de documentação' }

/** A way to leave the conversation the message belongs to, and to come back. */
function Switcher(): React.JSX.Element {
  const { conversations, select } = useConversations()
  const { toggle } = useDocs()
  return (
    <>
      <button type="button" onClick={(event) => toggle(event.currentTarget)}>
        consultar documentação
      </button>
      {conversations.map((conversation) => (
        <button key={conversation.id} type="button" onClick={() => select(conversation.id)}>
          ir para {conversation.title}
        </button>
      ))}
    </>
  )
}

/**
 * The transcript alone, over a conversation that really holds the message —
 * `setDocsEnabled` runs against the real handler on `:memory:` (store-api), so
 * what the toggle wrote is read back instead of asserted on a spy.
 */
async function mount(part: DocsPart = PART): Promise<void> {
  api = installApiMock()
  await api.conversation.create({ id: 'c1', title: 'Primeira', createdAt: 1000 })
  await api.conversation.create({ id: 'c2', title: 'Segunda', createdAt: 2000 })
  const message: Message = { ...MESSAGE, parts: [part, { kind: 'text', text: 'como invalido?' }] }
  await api.conversation.append('c1', message)
  render(
    providers(
      <>
        <Switcher />
        <MessageList messages={[message]} service="ollama" />
      </>
    )
  )
  await screen.findByRole('button', { name: 'ir para Primeira' })
  // The list comes back ORDER BY updated_at DESC, so the newest is active by
  // default — the message below belongs to the other one.
  await userEvent.click(screen.getByRole('button', { name: 'ir para Primeira' }))
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

describe('a releitura no painel', () => {
  async function reopen(): Promise<void> {
    const user = userEvent.setup()
    await mount()
    await user.click(screen.getByRole('button', { name: /Abrir a consulta/ }))
    await waitFor(() => expect(screen.getByRole('complementary', PANEL)).toBeInTheDocument())
  }

  it('abre a consulta anexada sem nenhuma composição existir', async () => {
    await reopen()

    const panel = within(screen.getByRole('complementary', PANEL))
    expect(panel.getByText('/tanstack/query · v5.90.3')).toBeInTheDocument()
    expect(panel.getByRole('tab', { name: 'Trechos (1)' })).toBeInTheDocument()
  })

  it('separa o que ficou de fora do que foi enviado', async () => {
    await reopen()

    const panel = within(screen.getByRole('complementary', PANEL))
    // The omitted never join the sent list: the part kept their title and cost
    // and threw the code away (D23C.3).
    expect(
      within(panel.getByRole('group', { name: 'Trechos a enviar' })).queryByText(
        'setQueryData otimista'
      )
    ).not.toBeInTheDocument()
    expect(panel.getByRole('tab', { name: 'Não enviados (1)' })).toBeInTheDocument()
  })

  // Asserted by REOPENING, never by absence: the panel gives the region up on
  // navigation either way (DE1B.1), so a test that only checks it vanished
  // passes against an unstamped `viewing` too.
  it('não leva a consulta de uma conversa para outra', async () => {
    const user = userEvent.setup()
    await reopen()

    await user.click(screen.getByRole('button', { name: 'ir para Segunda' }))
    await user.click(screen.getByRole('button', { name: 'consultar documentação' }))

    const panel = within(await screen.findByRole('complementary', PANEL))
    expect(panel.getByLabelText('Biblioteca')).toHaveValue('')
    expect(panel.queryByRole('tab', { name: 'Trechos (1)' })).not.toBeInTheDocument()
  })
})
