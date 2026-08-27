import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { editorTheme } from './editorTheme'

// Composed by hand, never `basicSetup`: line numbers, gutters, folding, search
// and autocompletion belong to a code editor, and this is a field of prose
// (DE1C.3). `Tab` is absent on purpose — CodeMirror leaves it alone to pass the
// WCAG no-keyboard-trap criterion, and that is the behaviour we want (DE1C.5).
const extensions = [
  history(),
  keymap.of([...defaultKeymap, ...historyKeymap]),
  EditorView.lineWrapping,
  // 353 kB of the bundle, measured — the whole cost of syntax highlighting,
  // since lang-markdown pulls lang-html for embedded blocks.
  markdown(),
  editorTheme
]

type DraftEditorProps = {
  /** Which draft is loaded — a change swaps the document and its history. */
  draftId: string
  initialText: string
  /** Called on blur with the current document (DE1C.6). */
  onSave: (text: string) => void
  /** Reads the live document, for the preview tab and for saving on the way out. */
  onReady: (read: () => string) => void
}

function DraftEditor({
  draftId,
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
      state: EditorState.create({ doc: initialText, extensions }),
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
    editor.setState(EditorState.create({ doc: initialText, extensions }))
  }, [draftId, initialText])

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
