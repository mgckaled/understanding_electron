import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {
  Api,
  DocCodeBlock,
  DocNote,
  DocRules,
  DocSnippet,
  DocsResult,
  LibraryCandidate
} from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { providers } from '@test/renderer-providers'
import { useConversations } from '../conversation/conversationsContext'
import { useDocs } from './docsContext'

const CANDIDATE: LibraryCandidate = {
  key: '/tanstack/query#89.5',
  id: '/tanstack/query',
  title: 'TanStack Query',
  description: '',
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

const TWIN: LibraryCandidate = { ...CANDIDATE, key: '/tanstack/query#87.7', benchmarkScore: 87.66 }

function snippet(key: string, title: string, tokens: number): DocSnippet {
  return { key, title, description: '', tokens, blocks: [], pageTitle: null, sourceUrl: null }
}

function note(key: string, content: string, tokens: number): DocNote {
  return { key, breadcrumb: null, content, tokens, sourceUrl: null }
}

const NO_RULES: DocRules = { global: [], libraryOwn: [], libraryTeam: [] }

const ANSWER: DocsResult = {
  snippets: [
    snippet('a#0', 'invalidateQueries após mutação', 182),
    snippet('b#1', 'onSuccess', 96)
  ],
  notes: [note('n#0', 'O cache é por chave.', 22)],
  rules: null
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

/**
 * Drives the panel to the third screen. Every `mockResolvedValue` lives here,
 * AFTER `installApiMock`, which `mount` would otherwise discard in silence.
 */
async function showAnswer(docs: DocsResult): Promise<void> {
  api = installApiMock()
  await api.conversation.create({ id: 'c1', title: 'Primeira', createdAt: 1000 })
  render(providers(<Probe />))
  await screen.findByRole('button', { name: 'ir para Primeira' })
  await userEvent.click(screen.getByRole('button', { name: 'ir para Primeira' }))
  await userEvent.click(screen.getByRole('button', { name: 'consultar documentação' }))
  await userEvent.type(screen.getByLabelText('Biblioteca'), 'tanstack query')
  await userEvent.type(screen.getByLabelText('Pergunta'), 'invalidar cache')

  vi.mocked(api.docs.search).mockResolvedValue({
    ok: true,
    value: { status: 'found', candidates: [CANDIDATE, TWIN] }
  })
  await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
  await screen.findByRole('radio', { checked: true })

  vi.mocked(api.docs.fetch).mockResolvedValue({ ok: true, value: { status: 'ready', docs } })
  await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
  await screen.findByRole('tablist')
}

describe('a terceira tela', () => {
  // Both sides asserted: a derivation that read the search state instead of the
  // fetch state would leave the candidate list under the tabs, and a test that
  // only looked for the tablist would pass against it.
  it('replaces the candidate list with the tabs', async () => {
    await showAnswer(ANSWER)

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('names the library and the pinned version in the header', async () => {
    await showAnswer(ANSWER)

    expect(screen.getByText('/tanstack/query')).toBeInTheDocument()
  })

  // The assertion is the marked radio, never the absence of the answer:
  // resetting the search too would land on the form, and both drop the tabs.
  it('goes back to the candidates, not to the form', async () => {
    await showAnswer(ANSWER)

    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))

    expect(screen.getByRole('radio', { checked: true })).toBeInTheDocument()
  })

  // 182 + 96 + 22: leaving the notes out is the plausible defect, and it moves
  // the number rather than removing it.
  it('adds snippets and notes into the exact total', async () => {
    await showAnswer(ANSWER)

    expect(screen.getByText('3 de 3 · ~300 tok')).toBeInTheDocument()
  })
})

describe('a seleção', () => {
  it('starts with everything checked', async () => {
    await showAnswer(ANSWER)

    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeChecked()
  })

  // The count AND the sum, because a footer that only recounted would pass
  // against a total that ignored the selection entirely.
  it('drops the unchecked snippet from the count and the sum', async () => {
    await showAnswer(ANSWER)

    await userEvent.click(screen.getByRole('checkbox', { name: 'onSuccess' }))

    expect(screen.getByText('2 de 3 · ~204 tok')).toBeInTheDocument()
  })

  // A note has no title of its own, so it is addressed by its trail (D23G.4) —
  // and it lands in the same sum as the snippets, not a second one.
  it('counts a note in the same sum', async () => {
    await showAnswer(ANSWER)

    await userEvent.click(screen.getByRole('tab', { name: 'Notas (1)' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'sem trilha' }))

    expect(screen.getByText('2 de 3 · ~278 tok')).toBeInTheDocument()
  })

  it('says there is nothing to attach once everything is unchecked', async () => {
    await showAnswer(ANSWER)

    for (const box of screen.getAllByRole('checkbox')) await userEvent.click(box)
    await userEvent.click(screen.getByRole('tab', { name: 'Notas (1)' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'sem trilha' }))

    expect(screen.getByText('0 de 3 · nada a anexar')).toBeInTheDocument()
  })

  // Rules are shown and never sent (DM-17), so counting them would inflate the
  // one number in the app that is exact — the defect is invisible without this.
  it('leaves rules out of the total', async () => {
    await showAnswer({ ...ANSWER, rules: { ...NO_RULES, libraryOwn: ['Use o hook oficial.'] } })

    expect(screen.getByText('3 de 3 · ~300 tok')).toBeInTheDocument()
  })
})

describe('a aba Regras', () => {
  it.each([
    ['absent field', null, false],
    ['three empty lists', NO_RULES, false],
    ['one rule', { ...NO_RULES, libraryOwn: ['Use Upstash Redis'] }, true]
  ])('shows the tab for %s: %s', async (_name, rules, expected) => {
    await showAnswer({ ...ANSWER, rules })

    expect(screen.queryByRole('tab', { name: /Regras/ }) !== null).toBe(expected)
  })

  // The three lists do not share a provenance (D23F.8): `libraryOwn` is the
  // third party DM-17 names, the other two came in under the reader's own key.
  it('says where each list came from', async () => {
    await showAnswer({
      ...ANSWER,
      rules: {
        global: ['Responda em português'],
        libraryOwn: ['Use Upstash Redis'],
        libraryTeam: []
      }
    })

    await userEvent.click(screen.getByRole('tab', { name: /Regras/ }))

    expect(screen.getByText('escritas por quem publica a biblioteca')).toBeInTheDocument()
    expect(
      screen.getByText('escritas no painel do Context7, valem para toda consulta')
    ).toBeInTheDocument()
    expect(screen.queryByText('Do seu time')).not.toBeInTheDocument()
  })
})

describe('o trecho retrátil', () => {
  function withBlocks(blocks: DocCodeBlock[], sourceUrl: string | null = null): DocsResult {
    return { ...ANSWER, snippets: [{ ...snippet('a#0', 'primeiro', 182), blocks, sourceUrl }] }
  }

  // Both states asserted: a disclosure that opened every snippet would pass a
  // test that only looked at the first.
  it('opens the first and leaves the second closed', async () => {
    await showAnswer(ANSWER)

    expect(screen.getByRole('button', { name: /onSuccess/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.getByRole('button', { name: /invalidateQueries/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })

  it('draws one block when the two variants are the same code', async () => {
    await showAnswer(
      withBlocks([
        { language: 'typescript', code: 'const a = 1' },
        { language: 'javascript', code: 'const a = 1' }
      ])
    )

    expect(document.querySelectorAll('pre')).toHaveLength(1)
  })

  it('draws both blocks when the variants differ', async () => {
    await showAnswer(
      withBlocks([
        { language: 'typescript', code: 'const a: number = 1' },
        { language: 'javascript', code: 'const a = 1' }
      ])
    )

    expect(document.querySelectorAll('pre')).toHaveLength(2)
  })

  // The class is assigned under jsdom even though the colour is not — the
  // verdict "only live" has been half wrong here once before.
  it('colours the code with the draft highlighter', async () => {
    await showAnswer(withBlocks([{ language: 'TypeScript', code: 'const a = 1' }]))

    expect(document.querySelector('.tok-keyword')).not.toBeNull()
  })

  // The API writes inline code with backticks, and rendering the string raw
  // showed them as literal characters. The element is the assertion: the text
  // reads the same either way, so asserting the sentence would be vacuous.
  it('renders the markdown the API wrote into the description', async () => {
    const described = { ...snippet('a#0', 'primeiro', 182), description: 'Use `clear()` agora' }
    await showAnswer({ ...ANSWER, snippets: [described] })

    expect(document.querySelector('code')?.textContent).toBe('clear()')
  })

  it('has no source button when the codeId was not a URL', async () => {
    await showAnswer(withBlocks([]))

    expect(screen.queryByRole('button', { name: /Abrir a fonte/ })).not.toBeInTheDocument()
  })

  it('opens the source outside the app', async () => {
    await showAnswer(withBlocks([], 'https://github.com/tanstack/query/blob/main/docs/x.md'))

    await userEvent.click(screen.getByRole('button', { name: /Abrir a fonte/ }))

    expect(api.shell.openExternal).toHaveBeenCalledWith(
      'https://github.com/tanstack/query/blob/main/docs/x.md'
    )
  })
})

describe('os dois estados vazios', () => {
  // `empty` only covers both lists being empty (client.ts:80), so a ready
  // answer with no code at all is a real screen, not an impossible one.
  it('has its own text when nothing but notes came back', async () => {
    await showAnswer({ ...ANSWER, snippets: [] })

    expect(screen.getByText('Nenhum trecho de código para esta pergunta.')).toBeInTheDocument()
  })

  it('has its own text when no note came back', async () => {
    await showAnswer({ ...ANSWER, notes: [] })

    await userEvent.click(screen.getByRole('tab', { name: 'Notas (0)' }))

    expect(screen.getByText('Esta resposta não trouxe nota — só código.')).toBeInTheDocument()
  })
})
