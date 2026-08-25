// Third consumer (StepProposalCard, D19.6) is the régua dos três's
// extraction trigger — DatasetQueryPanel and DatasetPreview each carried
// their own copy until now. A plain .ts module, not folded into
// DatasetTable.tsx: react-refresh/only-export-components rejects a .tsx
// exporting anything besides a component.
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '∅'
  if (typeof value === 'bigint') return value.toString()
  return String(value)
}
