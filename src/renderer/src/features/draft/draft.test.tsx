import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Api } from '@shared/ipc'
import { installApiMock } from '@test/api-mock'
import { providers } from '@test/renderer-providers'
import { EditorView } from '@codemirror/view'
import ConversationView from '../conversation/ConversationView'
import { useDraft } from './draftContext'

const ANSWER = '## Vendas do trimestre\n\nSubiram 12%.'

const READY = { ok: true, value: { service: 'ollama', version: '0.5.1' } } as const

let api: Api

async function withAnswer(extra: string[] = []): Promise<void> {
  api = installApiMock()
  vi.mocked(api.ai.isAvailable).mockResolvedValue(READY)
  await api.conversation.create({ id: 'c1', title: 'Vendas', createdAt: 1000 })
  // Every message goes in BEFORE the render: appending afterwards writes to the
  // database without invalidating the query, so the transcript never refetches.
  for (const [index, text] of [ANSWER, ...extra].entries()) {
    await api.conversation.append('c1', {
      id: `m${index + 1}`,
      role: 'assistant',
      parts: [{ kind: 'text', text }],
      createdAt: 2000 + index
    })
  }
  render(
    providers(
      <>
        <ConversationView />
        <Probe />
      </>
    )
  )
  // By count, not `findByRole`, which throws on more than one match. Longer
  // than the 1s default on purpose: this waits out a three-query chain (list,
  // then messages, then the turns), and it went red only under the full suite,
  // where every jsdom environment competes for the same cores.
  await waitFor(
    () =>
      expect(screen.getAllByRole('button', { name: 'Enviar para rascunho' })).toHaveLength(
        1 + extra.length
      ),
    { timeout: 5000 }
  )
}

describe('enviar para rascunho', () => {
  it('creates a draft carrying the answer and a title read from it', async () => {
    await withAnswer()

    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))

    await waitFor(async () =>
      expect(await api.draft.list('c1')).toEqual([
        expect.objectContaining({
          conversationId: 'c1',
          sourceMessageId: 'm1',
          title: 'Vendas do trimestre',
          content: ANSWER
        })
      ])
    )
  })

  // DE1A.3: the button reads the list, so it needs no flag on the message — and
  // deleting the draft has nothing to unset for it to come back.
  it('stops offering to draft an answer it already drafted', async () => {
    await withAnswer()

    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))

    expect(await screen.findByRole('button', { name: 'Rascunho criado' })).toBeDisabled()
  })

  // DE2A.3: a code block sends a draft carrying the SAME sourceMessageId, so an
  // unfiltered hasDraftOf would report the whole answer as already drafted.
  it('keeps offering to draft the answer after a code block from it was sent', async () => {
    await withAnswer()

    await userEvent.click(screen.getByRole('button', { name: 'enviar código de m1' }))
    await waitFor(async () => expect(await api.draft.list('c1')).toHaveLength(1))

    expect(screen.getByRole('button', { name: 'Enviar para rascunho' })).toBeEnabled()
  })

  it('offers to draft again once the draft is deleted', async () => {
    await withAnswer()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))
    const [created] = await waitFor(async () => {
      const drafts = await api.draft.list('c1')
      expect(drafts).toHaveLength(1)
      return drafts
    })

    await api.draft.remove(created.id)

    // The list is the only source, so it is what the button re-reads.
    await waitFor(async () => expect(await api.draft.list('c1')).toEqual([]))
  })

  it('drafts each answer on its own', async () => {
    await withAnswer(['Outra resposta.'])

    await userEvent.click(screen.getAllByRole('button', { name: 'Enviar para rascunho' })[0])

    await waitFor(async () => {
      const drafts = await api.draft.list('c1')
      expect(drafts).toHaveLength(1)
      expect(drafts[0].sourceMessageId).toBe('m1')
    })
  })
})

describe('DraftCount', () => {
  it('stays out of the header while the conversation has no draft', async () => {
    await withAnswer()

    expect(screen.queryByRole('button', { name: /rascunhos da conversa/ })).toBeNull()
  })

  it('counts drafts on its own, without touching the attachment clip', async () => {
    await withAnswer()

    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))

    expect(
      await screen.findByRole('button', { name: 'Abrir rascunhos da conversa (1)' })
    ).toBeVisible()
    // The clip is absent, not showing 1: an answer is not an attachment.
    expect(screen.queryByRole('button', { name: /anexos da conversa/ })).toBeNull()
  })
})

// The counter only becomes a button in step 4, so the panel is driven through
// the context here — the same probe shape artifact.test.tsx uses.
describe('enviar código para rascunho', () => {
  const CODE_ANSWER = ['Use isto:', '', '```python', 'import pandas as pd', '```'].join('\n')
  const BARE_ANSWER = ['Ou isto:', '', '```', 'algo cru', '```'].join('\n')
  // TWO fences in ONE answer — the case that forces matching on content, since
  // both blocks share a sourceMessageId.
  const TWO_BLOCKS = [
    'Primeiro:',
    '',
    '```python',
    'import pandas as pd',
    '```',
    '',
    'Segundo:',
    '',
    '```sql',
    'select 1',
    '```'
  ].join('\n')

  it('creates a code draft carrying the fence language', async () => {
    await withAnswer([CODE_ANSWER])

    await userEvent.click(screen.getByRole('button', { name: 'Enviar código para rascunho' }))

    await waitFor(async () =>
      expect(await api.draft.list('c1')).toEqual([
        expect.objectContaining({
          sourceMessageId: 'm2',
          kind: 'code',
          language: 'python',
          content: 'import pandas as pd',
          title: 'import pandas as pd'
        })
      ])
    )
  })

  // A fence with no info string is a normal fence (D11.5), not a defect — it
  // stores as code with no language, which is why the two are separate columns.
  it('creates a code draft with no language when the fence named none', async () => {
    await withAnswer([BARE_ANSWER])

    await userEvent.click(screen.getByRole('button', { name: 'Enviar código para rascunho' }))

    await waitFor(async () =>
      expect(await api.draft.list('c1')).toEqual([
        expect.objectContaining({ kind: 'code', language: null, content: 'algo cru' })
      ])
    )
  })

  // Found live: the block button had no state at all, so the same fence could be
  // drafted without limit. Derived from the list like the turn button (DE1A.3),
  // matched on content because a fence has no id (DE2A.8).
  it('stops offering a block it already drafted', async () => {
    await withAnswer([CODE_ANSWER])

    await userEvent.click(screen.getByRole('button', { name: 'Enviar código para rascunho' }))

    expect(await screen.findByRole('button', { name: 'Rascunho criado' })).toBeDisabled()
  })

  // Two fences in the SAME answer, one drafted: the other must stay offered.
  // They share a sourceMessageId, so this is what forces the content match —
  // provoked, and the first version of this test used two separate answers and
  // proved nothing, since the message id alone already told those apart.
  it('leaves the other block of the same answer still offered', async () => {
    await withAnswer([TWO_BLOCKS])

    await userEvent.click(screen.getAllByRole('button', { name: 'Enviar código para rascunho' })[0])

    await screen.findByRole('button', { name: 'Rascunho criado' })
    expect(screen.getByRole('button', { name: 'Enviar código para rascunho' })).toBeEnabled()
  })

  // Reported live. The preview ran the code through the markdown renderer, which
  // JOINS consecutive lines into one paragraph and reads four leading spaces as
  // a nested code block — the class body came back as prose plus a block, line
  // breaks gone. The two assertions are the two halves of that defect (DE2A.9).
  const CLASS_CODE = [
    'class Person {',
    '  name: string',
    '',
    '    greet() {',
    '        return 1',
    '    }',
    '}'
  ].join('\n')
  const CLASS_ANSWER = ['Veja:', '', '```typescript', CLASS_CODE, '```'].join('\n')

  async function openCodeDraft(answer: string): Promise<HTMLElement> {
    await withAnswer([answer])
    await userEvent.click(screen.getByRole('button', { name: 'Enviar código para rascunho' }))
    await userEvent.click(await screen.findByRole('button', { name: /rascunhos da conversa/ }))
    const panel = await screen.findByRole('complementary', { name: 'Rascunho aberto' })
    await userEvent.click(within(panel).getByRole('tab', { name: 'Prévia' }))
    return panel
  }

  it('previews code verbatim, keeping every line break and indent', async () => {
    const panel = await openCodeDraft(CLASS_ANSWER)

    expect(panel.querySelector('pre')?.textContent).toBe(CLASS_CODE)
  })

  // The pair the whole design rests on (DE2B.1): editor and preview run the SAME
  // classHighlighter, so they must emit the same classes over the same text. The
  // COLOURS are what jsdom cannot prove — the classes it can, and they are what
  // the one block of CSS in base.css keys on.
  function tokenClasses(root: Element, selector: string): Set<string> {
    return new Set(
      [...root.querySelectorAll(selector)].flatMap((node) =>
        [...node.classList].filter((name) => name.startsWith('tok-'))
      )
    )
  }

  it('colours the editor and the preview with the same classes', async () => {
    // openCodeDraft leaves the preview showing; the editor stays mounted behind
    // it (DE1C.4), so both are readable at once.
    const panel = await openCodeDraft(CLASS_ANSWER)

    const editor = tokenClasses(panel, '.cm-content [class*="tok-"]')
    const preview = tokenClasses(panel, 'pre [class*="tok-"]')

    expect(editor.size).toBeGreaterThan(0)
    expect([...preview].sort()).toEqual([...editor].sort())
  })

  it('leaves an unknown language uncoloured in both', async () => {
    // The body is deliberately code ANY grammar would colour — keywords and a
    // string. Content that highlights nowhere would let this pass even if an
    // unknown fence silently fell back to some grammar.
    const unknown = ['Veja:', '', '```zzzunknown', 'def f():', '    return "x"', '```'].join('\n')

    const panel = await openCodeDraft(unknown)

    expect(tokenClasses(panel, '.cm-content [class*="tok-"]').size).toBe(0)
    expect(tokenClasses(panel, 'pre [class*="tok-"]').size).toBe(0)
  })

  // DE2B.5: code has one outcome, so the picker is not a control — the same
  // rule the DraftPicker follows with a single draft.
  it('shows the extension as a label, not a format picker, for code', async () => {
    const panel = await openCodeDraft(CLASS_ANSWER)

    expect(within(panel).queryByRole('button', { name: /^Formato:/ })).toBeNull()
    expect(within(panel).getByText('.ts')).toBeVisible()
  })

  it('keeps the four-format picker for a prose draft', async () => {
    await withAnswer([CODE_ANSWER])
    await userEvent.click(screen.getAllByRole('button', { name: 'Enviar para rascunho' })[1])
    await userEvent.click(await screen.findByRole('button', { name: /rascunhos da conversa/ }))
    const panel = await screen.findByRole('complementary', { name: 'Rascunho aberto' })

    expect(within(panel).getByRole('button', { name: 'Formato: .md' })).toBeVisible()
  })

  it('exports a code draft with the language extension', async () => {
    const panel = await openCodeDraft(CLASS_ANSWER)

    await userEvent.click(within(panel).getByRole('button', { name: 'Exportar' }))

    await waitFor(() =>
      expect(vi.mocked(api.export.save)).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'source', suggestedName: 'class Person {.ts' })
      )
    )
  })

  // DE2B.6: the gutter is what DE1C.3 kept out of a PROSE field. Its premise,
  // not its ruling, is what changed — so prose must still have none.
  it('numbers the lines of a code draft', async () => {
    const panel = await openCodeDraft(CLASS_ANSWER)

    const numbers = [...panel.querySelectorAll('.cm-lineNumbers .cm-gutterElement')]
    expect(numbers.map((node) => node.textContent)).toEqual(expect.arrayContaining(['1', '2', '3']))
  })

  it('leaves a prose draft without a gutter', async () => {
    await withAnswer([CODE_ANSWER])
    await userEvent.click(screen.getAllByRole('button', { name: 'Enviar para rascunho' })[1])
    await userEvent.click(await screen.findByRole('button', { name: /rascunhos da conversa/ }))
    const panel = await screen.findByRole('complementary', { name: 'Rascunho aberto' })

    expect(panel.querySelector('.cm-lineNumbers')).toBeNull()
  })

  it('builds no nested code block in a code preview', async () => {
    const panel = await openCodeDraft(CLASS_ANSWER)

    // The CodeBlock header is what a markdown-rendered fence would produce.
    expect(within(panel).queryByRole('button', { name: 'Copiar código' })).toBeNull()
  })

  it('marks the code draft in the panel header with its language', async () => {
    await withAnswer([CODE_ANSWER])
    await userEvent.click(screen.getByRole('button', { name: 'Enviar código para rascunho' }))

    await userEvent.click(await screen.findByRole('button', { name: /rascunhos da conversa/ }))
    const panel = await screen.findByRole('complementary', { name: 'Rascunho aberto' })

    expect(within(panel).getByText('python')).toBeVisible()
  })

  // The chip is what tells the two dialects apart in a mixed list, so the case
  // with no language is exactly the one it must not skip (DE2A.5).
  it('marks a code draft whose fence named no language', async () => {
    await withAnswer([BARE_ANSWER])
    await userEvent.click(screen.getByRole('button', { name: 'Enviar código para rascunho' }))

    await userEvent.click(await screen.findByRole('button', { name: /rascunhos da conversa/ }))
    const panel = await screen.findByRole('complementary', { name: 'Rascunho aberto' })

    expect(within(panel).getByText('código')).toBeVisible()
  })

  it('leaves a prose draft unmarked', async () => {
    await withAnswer()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))

    await userEvent.click(await screen.findByRole('button', { name: /rascunhos da conversa/ }))
    const panel = await screen.findByRole('complementary', { name: 'Rascunho aberto' })

    expect(within(panel).queryByText('código')).toBeNull()
  })

  it('leaves the answer-level draft button alone', async () => {
    await withAnswer([CODE_ANSWER])

    await userEvent.click(screen.getByRole('button', { name: 'Enviar código para rascunho' }))
    await waitFor(async () => expect(await api.draft.list('c1')).toHaveLength(1))

    expect(screen.getAllByRole('button', { name: 'Enviar para rascunho' })[1]).toBeEnabled()
  })

  // DE2A.6: MarkdownMessage has four callers and only the transcript passes the
  // callback. The draft has to be the PROSE one for this to mean anything — a
  // code draft stores the block bare, so its preview renders no fence at all and
  // the assertion would hold with the button unconditional. Provoked: this fails
  // when the guard on onSend is removed.
  it('puts no send button inside the draft panel preview', async () => {
    await withAnswer([CODE_ANSWER])
    await userEvent.click(screen.getAllByRole('button', { name: 'Enviar para rascunho' })[1])
    await userEvent.click(await screen.findByRole('button', { name: /rascunhos da conversa/ }))
    const panel = await screen.findByRole('complementary', { name: 'Rascunho aberto' })

    await userEvent.click(within(panel).getByRole('tab', { name: 'Prévia' }))

    // Proof that the preview really built a CodeBlock: its OTHER button, the
    // sibling in the same header, is there. Matching the code text instead would
    // hit the editor CodeMirror keeps mounted behind the tab (DE1C.4).
    expect(within(panel).getByRole('button', { name: 'Copiar código' })).toBeVisible()
    expect(within(panel).queryByRole('button', { name: 'Enviar código para rascunho' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Enviar código para rascunho' })).toHaveLength(1)
  })
})

function Probe(): React.JSX.Element {
  const { drafts, togglePanel, createFrom } = useDraft()
  return (
    <>
      <button type="button" onClick={(event) => togglePanel(event.currentTarget)}>
        abrir rascunho ({drafts.length})
      </button>
      {/* Stands in for the button E-2-A puts on the code block's own header. */}
      <button
        type="button"
        onClick={() => createFrom('m1', 'import pandas as pd', { language: 'python' })}
      >
        enviar código de m1
      </button>
    </>
  )
}

/** What the CodeMirror document holds, read from the DOM it renders. */
function editorText(panel: HTMLElement): string {
  return panel.querySelector('.cm-content')?.textContent ?? ''
}

/**
 * Edits the document the way the editor itself does — a transaction — since
 * typing is not reproducible under jsdom (contenteditable + `beforeinput`).
 * `findFromDOM` is CodeMirror's own API for reaching a mounted view.
 */
function typeInto(panel: HTMLElement, text: string): void {
  const host = panel.querySelector('.cm-editor')
  const view = host instanceof HTMLElement ? EditorView.findFromDOM(host) : null
  if (view === null) throw new Error('no editor mounted in this panel')
  // Focus first, or there is no blur to leave later — and a real edit always
  // starts with the caret in the field.
  view.contentDOM.focus()
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
}

describe('o painel de rascunho', () => {
  async function withDraft(): Promise<void> {
    await withAnswer()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))
    await screen.findByRole('button', { name: 'abrir rascunho (1)' })
  }

  it('shows the draft, under the title read from its own first line', async () => {
    await withDraft()

    await userEvent.click(screen.getByRole('button', { name: /abrir rascunho/ }))

    const panel = await screen.findByRole('complementary', { name: 'Rascunho aberto' })
    expect(editorText(panel)).toContain('## Vendas do trimestre')
    expect(editorText(panel)).toContain('Subiram 12%.')
  })

  // DE1B.1: one region, two tenants — a second <aside> has to be unreachable.
  it('replaces the artifact panel instead of sitting beside it', async () => {
    await withDraft()
    await userEvent.click(screen.getByRole('button', { name: /abrir rascunho/ }))

    expect(screen.getAllByRole('complementary', { name: /aberto$/ })).toHaveLength(1)
    expect(screen.getByRole('complementary', { name: 'Rascunho aberto' })).toBeVisible()
  })

  it('closes when asked again', async () => {
    await withDraft()
    await userEvent.click(screen.getByRole('button', { name: /abrir rascunho/ }))

    await userEvent.click(screen.getByRole('button', { name: /abrir rascunho/ }))

    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Rascunho aberto' })).toBeNull()
    )
  })
})

describe('como se chega ao painel', () => {
  const COUNTER = /rascunhos da conversa/

  async function withTwoDrafts(): Promise<void> {
    await withAnswer(['# Custos\n\nCaíram 3%.'])
    await userEvent.click(screen.getAllByRole('button', { name: 'Enviar para rascunho' })[0])
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar para rascunho' }))
    await screen.findByRole('button', { name: 'abrir rascunho (2)' })
  }

  it('opens the newest draft from the counter, and closes on a second press', async () => {
    await withTwoDrafts()

    await userEvent.click(screen.getByRole('button', { name: COUNTER }))
    const panel = await screen.findByRole('complementary', { name: 'Rascunho aberto' })
    expect(editorText(panel)).toContain('# Custos')

    await userEvent.click(screen.getByRole('button', { name: COUNTER }))
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Rascunho aberto' })).toBeNull()
    )
  })

  // DF3B.5: picking the open item means "stay", never "close what I am reading".
  it('switches drafts from the picker without closing the panel', async () => {
    await withTwoDrafts()
    await userEvent.click(screen.getByRole('button', { name: COUNTER }))

    await userEvent.click(await screen.findByRole('button', { name: /^Custos/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Vendas do trimestre', hidden: true }))

    const panel = screen.getByRole('complementary', { name: 'Rascunho aberto' })
    expect(editorText(panel)).toContain('## Vendas do trimestre')
  })

  it('is a title and not a control while there is only one draft', async () => {
    await withAnswer()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))
    await userEvent.click(await screen.findByRole('button', { name: COUNTER }))

    expect(screen.queryByRole('button', { name: /^Vendas do trimestre/ })).toBeNull()
  })

  it('opens and closes on Ctrl+D, and never while the user is typing', async () => {
    await withTwoDrafts()

    await userEvent.keyboard('{Control>}d{/Control}')
    expect(await screen.findByRole('complementary', { name: 'Rascunho aberto' })).toBeVisible()

    await userEvent.click(screen.getByPlaceholderText(/Pergunte algo/))
    await userEvent.keyboard('{Control>}d{/Control}')
    expect(screen.getByRole('complementary', { name: 'Rascunho aberto' })).toBeVisible()
  })
})

describe('excluir um rascunho', () => {
  async function openTwo(): Promise<void> {
    await withAnswer(['# Custos\n\nCaíram 3%.'])
    await userEvent.click(screen.getAllByRole('button', { name: 'Enviar para rascunho' })[0])
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar para rascunho' }))
    await userEvent.click(await screen.findByRole('button', { name: /rascunhos da conversa/ }))
    await screen.findByRole('complementary', { name: 'Rascunho aberto' })
  }

  async function confirmDelete(): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: 'Apagar rascunho' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir', hidden: true }))
  }

  // DE1B.7: closing always would hide drafts that still exist; keeping the
  // deleted one would show what is gone.
  it('falls back to the newest that survived', async () => {
    await openTwo()

    await confirmDelete()

    const panel = await screen.findByRole('complementary', { name: 'Rascunho aberto' })
    await waitFor(() => expect(editorText(panel)).toContain('## Vendas do trimestre'))
  })

  it('closes the panel when the last one goes', async () => {
    await withAnswer()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))
    await userEvent.click(await screen.findByRole('button', { name: /rascunhos da conversa/ }))
    await screen.findByRole('complementary', { name: 'Rascunho aberto' })

    await confirmDelete()

    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Rascunho aberto' })).toBeNull()
    )
  })

  // Closes the loop E-1-A opened: `draft:remove` shipped there with no caller,
  // and this is the cycle that proves "já rascunhei?" is derived (DE1A.3).
  it('lets the turn offer to draft that answer again', async () => {
    await withAnswer()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))
    await userEvent.click(await screen.findByRole('button', { name: /rascunhos da conversa/ }))
    await screen.findByRole('complementary', { name: 'Rascunho aberto' })

    await confirmDelete()

    expect(await screen.findByRole('button', { name: 'Enviar para rascunho' })).toBeEnabled()
  })
})

describe('as duas abas', () => {
  async function openDraft(): Promise<HTMLElement> {
    await withAnswer()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))
    await userEvent.click(await screen.findByRole('button', { name: /rascunhos da conversa/ }))
    return screen.findByRole('complementary', { name: 'Rascunho aberto' })
  }

  it('opens on the editor, with the markdown as written', async () => {
    const panel = await openDraft()

    expect(within(panel).getByRole('tab', { name: 'Editar' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(editorText(panel)).toContain('## Vendas do trimestre')
  })

  it('renders the markdown on the preview tab', async () => {
    const panel = await openDraft()

    await userEvent.click(within(panel).getByRole('tab', { name: 'Prévia' }))

    expect(within(panel).getByRole('heading', { name: 'Vendas do trimestre' })).toBeVisible()
  })

  // DE1C.4: unmounting the editor to peek at the preview would throw the undo
  // history away, so the panel opts into keepMounted and this is what guards it.
  it('keeps the editor mounted while the preview is showing', async () => {
    const panel = await openDraft()

    await userEvent.click(within(panel).getByRole('tab', { name: 'Prévia' }))

    expect(panel.querySelector('.cm-content')).not.toBeNull()
  })

  it('writes nothing when the field is left untouched', async () => {
    const panel = await openDraft()

    await userEvent.click(within(panel).getByRole('tab', { name: 'Prévia' }))

    expect(api.draft.update).not.toHaveBeenCalled()
  })

  // DE1C.7: the title is re-derived, so changing the first line renames the
  // draft. ⚠️ Real keystrokes are NOT covered here — see `typeInto`.
  it('writes an edited document on the way out, and retitles it', async () => {
    const panel = await openDraft()

    typeInto(panel, '# Custos revisados\n\nCaíram 3%.')
    await userEvent.click(within(panel).getByRole('tab', { name: 'Prévia' }))

    expect(api.draft.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Custos revisados' })
    )
    await waitFor(async () =>
      expect((await api.draft.list('c1'))[0].content).toContain('Caíram 3%.')
    )
  })
})

describe('exportar', () => {
  async function openDraft(): Promise<HTMLElement> {
    await withAnswer()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para rascunho' }))
    await userEvent.click(await screen.findByRole('button', { name: /rascunhos da conversa/ }))
    return screen.findByRole('complementary', { name: 'Rascunho aberto' })
  }

  it('offers four formats and wires all four', async () => {
    const panel = await openDraft()

    await userEvent.click(within(panel).getByRole('button', { name: 'Formato: .md' }))

    expect(screen.getByRole('button', { name: /Markdown/, hidden: true })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Texto sem marcação/, hidden: true })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Word/, hidden: true })).toBeEnabled()
    expect(screen.getByRole('button', { name: /\.pdf/, hidden: true })).toBeEnabled()
  })

  it('sends the chosen format down the channel', async () => {
    const panel = await openDraft()

    await userEvent.click(within(panel).getByRole('button', { name: 'Formato: .md' }))
    await userEvent.click(screen.getByRole('button', { name: /Word/, hidden: true }))
    await userEvent.click(within(panel).getByRole('button', { name: /Exportar/ }))

    expect(api.export.save).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'docx', suggestedName: expect.stringMatching(/\.docx$/) })
    )
  })

  // DE1D.8: the footer reads the live document, so an edit that has not been
  // written yet still reaches the file.
  it('sends the editor document and a sanitised name', async () => {
    const panel = await openDraft()
    typeInto(panel, '# Receita: 2026/2027\n\nSubiu.')

    await userEvent.click(within(panel).getByRole('button', { name: /Exportar/ }))

    expect(api.export.save).toHaveBeenCalledWith({
      text: '# Receita: 2026/2027\n\nSubiu.',
      format: 'md',
      suggestedName: 'Receita 2026 2027.md'
    })
  })

  it('carries the chosen format into the call', async () => {
    const panel = await openDraft()
    await userEvent.click(within(panel).getByRole('button', { name: 'Formato: .md' }))
    await userEvent.click(screen.getByRole('button', { name: /Texto sem marcação/, hidden: true }))

    await userEvent.click(within(panel).getByRole('button', { name: /Exportar/ }))

    expect(api.export.save).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'txt', suggestedName: 'Vendas do trimestre.txt' })
    )
  })

  it('says where the file landed', async () => {
    const panel = await openDraft()
    vi.mocked(api.export.save).mockResolvedValue({
      ok: true,
      value: { path: 'C:\\Users\\eu\\Documentos\\Vendas.md' }
    })

    await userEvent.click(within(panel).getByRole('button', { name: /Exportar/ }))

    expect(await within(panel).findByText(/Documentos\\Vendas\.md/)).toBeVisible()
  })

  // DE1D.3: EPERM from a locked rename is not a permission problem, and the
  // message has to be the one the user can act on.
  it('explains a file held by another program', async () => {
    const panel = await openDraft()
    vi.mocked(api.export.save).mockResolvedValue({
      ok: false,
      error: { kind: 'file-in-use', path: 'C:\\Vendas.md' }
    })

    await userEvent.click(within(panel).getByRole('button', { name: /Exportar/ }))

    expect(await within(panel).findByText(/aberto em outro programa/)).toBeVisible()
  })

  it('stays quiet when the dialog is cancelled', async () => {
    const panel = await openDraft()

    await userEvent.click(within(panel).getByRole('button', { name: /Exportar/ }))

    const status = within(panel).getByRole('status')
    await waitFor(() => expect(api.export.save).toHaveBeenCalled())
    expect(status).toHaveTextContent('')
  })
})
