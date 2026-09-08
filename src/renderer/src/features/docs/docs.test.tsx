import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Api, LibraryCandidate } from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { providers } from '@test/renderer-providers'
import { useConversations } from '../conversation/conversationsContext'
import { useDocs } from './docsContext'

const PANEL = { name: 'Consulta de documentação' }

const CANDIDATE: LibraryCandidate = {
  key: '/tanstack/query#89.5',
  id: '/tanstack/query',
  title: 'TanStack Query',
  description: 'Hooks for fetching, caching and updating asynchronous data',
  branch: 'main',
  state: 'finalized',
  lastUpdateDate: '2026-09-01',
  totalTokens: 824953,
  totalSnippets: 2526,
  stars: 45043,
  trustScore: 8,
  benchmarkScore: 89.5,
  versions: ['v5.90.3']
}

// Same `id` as CANDIDATE, as the real response returns it — the pair only
// differs by score and snippet count (D23A.5).
const TWIN: LibraryCandidate = {
  ...CANDIDATE,
  key: '/tanstack/query#87.7',
  totalSnippets: 3241,
  benchmarkScore: 87.66
}

// The /websites/* shape: -1 on the wire, and nothing left after __branch__*.
const WEBSITE: LibraryCandidate = {
  ...CANDIDATE,
  key: '/websites/tanstack_query#78.8',
  id: '/websites/tanstack_query',
  totalSnippets: 2246,
  benchmarkScore: 78.8,
  stars: null,
  versions: []
}

let api: Api

function Probe(): React.JSX.Element {
  const { toggle } = useDocs()
  const { conversations, select } = useConversations()
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

async function mount(): Promise<void> {
  api = installApiMock()
  await api.conversation.create({ id: 'c1', title: 'Primeira', createdAt: 1000 })
  await api.conversation.create({ id: 'c2', title: 'Segunda', createdAt: 2000 })
  render(providers(<Probe />))
  await screen.findByRole('button', { name: 'ir para Primeira' })
  await userEvent.click(screen.getByRole('button', { name: 'ir para Primeira' }))
}

describe('painel de documentação', () => {
  it('opens the side region as its own tenant', async () => {
    await mount()

    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    expect(screen.getByRole('complementary', PANEL)).toBeInTheDocument()
  })

  it('closes on the header button', async () => {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    await userEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))

    await waitFor(() => expect(screen.queryByRole('complementary', PANEL)).not.toBeInTheDocument())
  })

  // A consultation follows the next message of the conversation it was written
  // in (D23D.2), so the region cannot stay ours across navigation. Asserted by
  // reopening and by `data-closing`, never by absence: the panel unmounts on
  // navigation either way, and a region still marked as ours reads the next
  // click as a close — which paints the panel for one fade before dropping it
  // (DE1B.1, DF3C.1).
  it('gives the region up when the conversation changes', async () => {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))
    await userEvent.click(screen.getByRole('button', { name: 'ir para Segunda' }))

    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    expect(screen.getByRole('complementary', PANEL)).not.toHaveAttribute('data-closing')
  })
})

describe('o formulário da consulta', () => {
  async function compose(): Promise<void> {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))
    await userEvent.type(screen.getByLabelText('Biblioteca'), 'tanstack query')
    await userEvent.type(screen.getByLabelText('Pergunta'), 'invalidar cache')
  }

  // DM-22: the warning is permanent, never a first-time consent — it has to be
  // on screen in the turn the question leaves the machine.
  it('warns that the question leaves the machine', async () => {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    expect(
      screen.getByText('A pergunta é enviada ao Context7, mesmo em conversa local.')
    ).toBeInTheDocument()
  })

  // DM-12, situação 1: a blank field is a 400 the app must never spend. Each
  // field is left empty in its own turn — filling them in one fixed order
  // passes against a rule that reads only the second one.
  it.each([
    ['Biblioteca', 'Pergunta'],
    ['Pergunta', 'Biblioteca']
  ])('holds Consultar with only %s filled', async (filled, empty) => {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    await userEvent.type(screen.getByLabelText(filled), 'alguma coisa')

    expect(screen.getByRole('button', { name: 'Consultar' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(empty), 'e outra')
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeEnabled()
  })

  it('keeps what was typed when the panel is closed and reopened', async () => {
    await compose()

    await userEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    expect(screen.getByLabelText('Biblioteca')).toHaveValue('tanstack query')
  })

  it('drops it when the conversation changes', async () => {
    await compose()

    await userEvent.click(screen.getByRole('button', { name: 'ir para Segunda' }))
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    expect(screen.getByLabelText('Biblioteca')).toHaveValue('')
  })

  it('searches for the library that was typed', async () => {
    // After compose(), never before: mount() installs a fresh mock.
    await compose()
    vi.mocked(api.docs.search).mockResolvedValue({
      ok: true,
      value: { status: 'found', candidates: [CANDIDATE] }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))

    expect(api.docs.search).toHaveBeenCalledWith('tanstack query')
    expect(await screen.findByText(/\/tanstack\/query/)).toBeInTheDocument()
  })

  // The search is not stamped with a conversation the way the composition is
  // (D23D.2), so replacing one has to take its candidate list along — without
  // this the new composition opens on the previous one's list.
  it('drops the candidates when the conversation changes', async () => {
    await compose()
    vi.mocked(api.docs.search).mockResolvedValue({
      ok: true,
      value: { status: 'found', candidates: [CANDIDATE] }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    await screen.findByText(/\/tanstack\/query/)

    await userEvent.click(screen.getByRole('button', { name: 'ir para Segunda' }))
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))

    expect(screen.queryByText(/\/tanstack\/query/)).not.toBeInTheDocument()
  })

  // D23A.3: a miss is a screen state travelling inside the value, so it never
  // reaches StateView's error branch.
  it('draws a miss as text, not as a failure', async () => {
    await compose()
    vi.mocked(api.docs.search).mockResolvedValue({
      ok: true,
      value: { status: 'no-libraries', message: 'Nenhuma biblioteca com esse nome.' }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))

    expect(await screen.findByText('Nenhuma biblioteca com esse nome.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('a desambiguação', () => {
  async function searchWith(candidates: LibraryCandidate[]): Promise<void> {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))
    await userEvent.type(screen.getByLabelText('Biblioteca'), 'tanstack query')
    await userEvent.type(screen.getByLabelText('Pergunta'), 'invalidar cache')
    // After the typing, never before: mount() installs a fresh mock.
    vi.mocked(api.docs.search).mockResolvedValue({
      ok: true,
      value: { status: 'found', candidates }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    await screen.findByRole('radio', { checked: true })
  }

  // The first is the app's own best guess, since the order is already ours
  // (D23A.4) — and it is where Tab lands, by the platform's radio pattern.
  it('checks the first candidate', async () => {
    await searchWith([CANDIDATE, TWIN, WEBSITE])

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(radios[0]).toBeChecked()
  })

  // Two rows carrying the same `id` is the real response, not a contrivance:
  // addressing the selection by `id` would check both (D23E.4).
  it('tells two candidates of the same id apart', async () => {
    await searchWith([CANDIDATE, TWIN])

    await userEvent.click(screen.getAllByRole('radio')[1])

    expect(screen.getAllByRole('radio')[1]).toBeChecked()
    expect(screen.getAllByRole('radio')[0]).not.toBeChecked()
  })

  // -1 means "does not apply", never zero (D23A.6).
  it('leaves the star off a candidate without one', async () => {
    await searchWith([WEBSITE, CANDIDATE])

    expect(screen.getByText('45.043 ★')).toBeInTheDocument()
    expect(screen.queryByText(/-1 ★/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/★/)).toHaveLength(1)
  })

  it('offers the library default plus every indexed version', async () => {
    await searchWith([{ ...CANDIDATE, versions: ['v5.90.3', 'v5_84_1'] }])

    expect(screen.getByLabelText('Versão')).toHaveValue('')
    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual([
      'padrão da biblioteca',
      'v5.90.3',
      'v5_84_1'
    ])
    expect(screen.getByText('2 indexadas')).toBeInTheDocument()
  })

  // Absent, not disabled (DF3B.2) — the common case, not an edge one.
  it('hides the selector when nothing is indexed', async () => {
    await searchWith([WEBSITE])

    expect(screen.queryByLabelText('Versão')).not.toBeInTheDocument()
  })

  // Asserted on the select's FINAL value, not on the absence of a call: a
  // version belongs to the library it was picked under (D23E.8).
  it('clears the version when the candidate changes', async () => {
    await searchWith([{ ...CANDIDATE, versions: ['v5.90.3'] }, TWIN])
    await userEvent.selectOptions(screen.getByLabelText('Versão'), 'v5.90.3')
    expect(screen.getByLabelText('Versão')).toHaveValue('v5.90.3')

    await userEvent.click(screen.getAllByRole('radio')[1])
    await userEvent.click(screen.getAllByRole('radio')[0])

    expect(screen.getByLabelText('Versão')).toHaveValue('')
  })

  it('goes back to the form with what was typed still there', async () => {
    await searchWith([CANDIDATE])

    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))

    expect(screen.getByLabelText('Biblioteca')).toHaveValue('tanstack query')
    expect(screen.getByLabelText('Pergunta')).toHaveValue('invalidar cache')
  })
})

describe('a segunda chamada', () => {
  async function pick(versions: string[]): Promise<void> {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))
    await userEvent.type(screen.getByLabelText('Biblioteca'), 'tanstack query')
    await userEvent.type(screen.getByLabelText('Pergunta'), 'invalidar cache')
    vi.mocked(api.docs.search).mockResolvedValue({
      ok: true,
      value: { status: 'found', candidates: [{ ...CANDIDATE, versions }] }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    await screen.findByRole('radio', { checked: true })
  }

  it('sends the library and the question, with no version by default', async () => {
    await pick(['v5.90.3'])
    vi.mocked(api.docs.fetch).mockResolvedValue({ ok: true, value: { status: 'empty' } })

    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))

    // The key is absent, not empty: `min(1)` on the schema makes a blank
    // string a bug rather than a default (D23A.6).
    expect(api.docs.fetch).toHaveBeenCalledWith({
      libraryId: '/tanstack/query',
      query: 'invalidar cache'
    })
  })

  it('pins the version that was chosen', async () => {
    await pick(['v5.90.3'])
    vi.mocked(api.docs.fetch).mockResolvedValue({ ok: true, value: { status: 'empty' } })
    await userEvent.selectOptions(screen.getByLabelText('Versão'), 'v5.90.3')

    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))

    expect(api.docs.fetch).toHaveBeenCalledWith({
      libraryId: '/tanstack/query',
      query: 'invalidar cache',
      version: 'v5.90.3'
    })
  })

  // What the answer looks like is docsResult.test.tsx's, from 23-F on. What
  // stays here is the call itself and what it invalidates.

  // The result was fetched for one library; showing it under another's name is
  // the silent divergence this drops.
  it('drops the result when the candidate changes', async () => {
    await mount()
    await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))
    await userEvent.type(screen.getByLabelText('Biblioteca'), 'tanstack query')
    await userEvent.type(screen.getByLabelText('Pergunta'), 'invalidar cache')
    vi.mocked(api.docs.search).mockResolvedValue({
      ok: true,
      value: { status: 'found', candidates: [CANDIDATE, TWIN] }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    await screen.findByRole('radio', { checked: true })
    vi.mocked(api.docs.fetch).mockResolvedValue({ ok: true, value: { status: 'empty' } })
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    expect(await screen.findByText('empty')).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('radio')[1])

    expect(screen.queryByText('empty')).not.toBeInTheDocument()
  })
})
