import { useEffect, useRef } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import type { DraftKind } from '@shared/ipc'
import { resolveLanguage } from '@core/draft/languages'
import {
  codeGutters,
  codeHighlighting,
  editorTheme,
  markdownHighlighting,
  proseTheme
} from './editorTheme'
import { grammarFor } from './codeHighlight'

// Composed by hand, never `basicSetup`: line numbers, gutters, folding, search
// and autocompletion belong to a code editor, and this is a field of prose
// (DE1C.3). `Tab` is absent on purpose — CodeMirror leaves it alone to pass the
// WCAG no-keyboard-trap criterion, and that is the behaviour we want (DE1C.5).
// One dialect per editor, never both: markdown's rules over code read four
// leading spaces as a code block and tint a whole indented body (DE2A.9), and
// syntaxHighlighting takes the UNION of every registered highlighter, so the
// two styles cannot simply coexist.
function extensionsFor(kind: DraftKind, language: string | null): Extension[] {
  const base = [history(), keymap.of([...defaultKeymap, ...historyKeymap])]
  if (kind !== 'code') {
    // Prose wraps; 353 kB of the bundle, measured, since lang-markdown pulls
    // lang-html.
    return [
      ...base,
      EditorView.lineWrapping,
      markdown(),
      markdownHighlighting,
      editorTheme,
      proseTheme
    ]
  }
  // Code wraps at a COLUMN, not at the window (DE2B.6): the gutter is sticky
  // against the scroller, so horizontal scrolling is what drags content across
  // it. `codeGutters` comes after `editorTheme` because it overrides the
  // transparent active line in it.
  const grammar = grammarFor(resolveLanguage(language)?.id)
  const code = [...base, EditorView.lineWrapping, editorTheme, codeGutters]
  // An unknown or absent fence stays plain text — a guess is the defect the
  // E-2-A had to undo (DE2B.4).
  return grammar === null ? code : [...code, grammar, codeHighlighting]
}

type DraftEditorProps = {
  /** Which draft is loaded — a change swaps the document and its history. */
  draftId: string
  /** Which dialect the document is, so the wrong grammar is not applied to it. */
  kind: DraftKind
  /** The fence's language, which picks the grammar when `kind` is code. */
  language: string | null
  initialText: string
  /** Called on blur with the current document (DE1C.6). */
  onSave: (text: string) => void
  /** Reads the live document, for the preview tab and for saving on the way out. */
  onReady: (read: () => string) => void
}

function DraftEditor({
  draftId,
  kind,
  language,
  initialText,
  onSave,
  onReady
}: DraftEditorProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  // Held in a ref so the view is created once: rebuilding it on every render
  // would throw away the undo history, which is the whole point of the plan.
  const save = useRef(onSave)
  useEffect(() => {
    save.current = onSave
  })

  useEffect(() => {
    if (host.current === null) return
    const editor = new EditorView({
      state: EditorState.create({ doc: initialText, extensions: extensionsFor(kind, language) }),
      parent: host.current
    })
    view.current = editor
    onReady(() => editor.state.doc.toString())
    return () => {
      editor.destroy()
      view.current = null
    }
    // Created once, deliberately: a second view would discard the history, and
    // `draftId` handles the document swap below.
  }, [])

  // A different draft is a different document, so `setState` and not a change
  // transaction: undo must not reach across from the draft before it (DE1C.6).
  useEffect(() => {
    const editor = view.current
    if (editor === null || editor.state.doc.toString() === initialText) return
    editor.setState(
      EditorState.create({ doc: initialText, extensions: extensionsFor(kind, language) })
    )
  }, [draftId, initialText, kind, language])

  return (
    <div
      ref={host}
      className="min-h-[0px] flex-1 overflow-hidden"
      onBlur={() => {
        const editor = view.current
        if (editor !== null) save.current(editor.state.doc.toString())
      }}
    />
  )
}

export default DraftEditor
