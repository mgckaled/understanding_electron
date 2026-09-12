// Structural prop, so the component never imports the type it renders: the
// footer beside it consumes `action` from the same object (D23I.1).
type DocsNoticeProps = { failure: { text: string } | null }

// ⚠️ Named apart from `docsFailure.ts` on purpose: two files differing only in
// case resolve to one another on Windows, and the import comes back undefined.

/**
 * The one place a failed consultation speaks. Replaces the generic `StateView`
 * error branch, which would render a typo as a system failure (D23I.2).
 *
 * @remarks Polite, never `role="status"`: every text here answers a button the
 *   user just pressed and is waiting on, and a miss is screen state (D23A.3).
 */
function DocsNotice({ failure }: DocsNoticeProps): React.JSX.Element | null {
  if (failure === null) return null

  return (
    <p className="text-xs text-danger-text selectable" role="status">
      {failure.text}
    </p>
  )
}

export default DocsNotice
