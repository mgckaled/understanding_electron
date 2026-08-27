import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

// Every value is a semantic token, never a literal (DE1C.2). CodeMirror injects
// its own stylesheet, outside Tailwind and outside the CSS Modules the `guard`
// hook scans — a `#hex` here would be the first literal colour in the app to go
// unseen. Writing `var()` also makes light/dark follow the app for free.
const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--font-size-reading)',
    color: 'var(--color-text)',
    backgroundColor: 'var(--color-surface)'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.5',
    padding: 'var(--space-7)'
  },
  '.cm-content': { caretColor: 'var(--color-accent-text)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent-text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--color-surface-raised)'
  },
  '.cm-activeLine': { backgroundColor: 'transparent' }
})

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--color-accent-text)', fontWeight: '600' },
  { tag: tags.strong, color: 'var(--color-text)', fontWeight: '600' },
  { tag: tags.emphasis, color: 'var(--color-text)', fontStyle: 'italic' },
  { tag: tags.link, color: 'var(--color-accent-text)' },
  { tag: tags.url, color: 'var(--color-text-muted)' },
  { tag: tags.monospace, color: 'var(--color-ok-text)' },
  { tag: tags.quote, color: 'var(--color-text-muted)' },
  { tag: tags.list, color: 'var(--color-accent-text)' },
  { tag: tags.processingInstruction, color: 'var(--color-text-faint)' },
  { tag: tags.strikethrough, color: 'var(--color-text-faint)', textDecoration: 'line-through' }
])

export const editorTheme: Extension = [theme, syntaxHighlighting(markdownHighlight)]
