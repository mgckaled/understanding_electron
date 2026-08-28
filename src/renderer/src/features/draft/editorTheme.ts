import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers
} from '@codemirror/view'
import { classHighlighter, tags } from '@lezer/highlight'
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
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.5' },
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

// The DE1C.3 ruling that kept gutters out is not overridden — its premise was
// "this is a field of prose", and a code draft is not one. Prose keeps it.
/**
 * Where a code line wraps, in characters.
 *
 * CodeMirror has no column wrap: `lineWrapping` breaks at the viewport, and a
 * `max-width` in `ch` is what turns that into a column (checked — the CM6 docs
 * offer nothing else). 90 rather than 80 because the panel is narrow and the
 * reflow is what the reader sees, not a diff someone has to review.
 */
const WRAP_COLUMN = 90

const codeTheme = EditorView.theme({
  // Only the HORIZONTAL padding leaves the scroller, and that is load-bearing:
  // the gutter is `position: sticky` against the scroller's left edge, so a
  // padding-left there is a strip the gutter does not cover and the content
  // scrolls through it. Vertical padding does not touch that, and keeping it
  // here leaves CodeMirror's own line/gutter alignment alone.
  '.cm-scroller': { padding: 'var(--space-7) 0px' },
  '.cm-gutters': {
    color: 'var(--color-text-faint)',
    backgroundColor: 'var(--color-surface)',
    border: 'none',
    paddingLeft: 'var(--space-7)',
    paddingRight: 'var(--space-4)'
  },
  '.cm-content': { maxWidth: `${WRAP_COLUMN}ch`, paddingRight: 'var(--space-7)' },
  '.cm-activeLineGutter': {
    color: 'var(--color-text-muted)',
    backgroundColor: 'var(--color-surface-raised)'
  },
  // Wins over the transparent rule in `theme`, which is why this extension is
  // registered after it.
  '.cm-activeLine': { backgroundColor: 'var(--color-surface-raised)' }
})

export const editorTheme: Extension = theme

/** Prose highlighting: inline colours, markdown's own tags. */
export const markdownHighlighting: Extension = syntaxHighlighting(markdownHighlight)

/** The padding the base theme no longer decides, since the two dialects differ. */
export const proseTheme: Extension = EditorView.theme({
  '.cm-scroller': { padding: 'var(--space-7)' }
})

/**
 * Code highlighting — the SAME `Highlighter` the panel's preview renders with
 * (DE2B.1), so the two can never drift apart in colour. It emits `.tok-*`
 * classes and carries no styles of its own; the rules live in `base.css`.
 *
 * Kept apart from {@link markdownHighlighting} because syntaxHighlighting takes
 * the UNION of every registered highlighter — one editor gets one of the two,
 * never both.
 */
export const codeHighlighting: Extension = syntaxHighlighting(classHighlighter)

/**
 * The gutter and the caret's line — what a code editor has and a prose field
 * does not (DE2B.6).
 *
 * `codeTheme` overrides the transparent active line in {@link editorTheme}, so
 * this must be registered AFTER it.
 */
export const codeGutters: Extension = [
  lineNumbers(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  codeTheme
]
