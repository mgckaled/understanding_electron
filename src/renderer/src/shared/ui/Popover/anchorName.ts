/**
 * A CSS anchor-positioning name is a dashed-ident — `useId()` output has colons,
 * which are not valid there. Consumers call this once and reuse the result both
 * on their trigger's `anchorName` style and on `Popover`'s `anchorName` prop.
 *
 * @param id - Typically `useId()`'s output.
 * @returns A valid `--dashed-ident` derived from `id`.
 */
export function toAnchorName(id: string): string {
  return `--popover-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`
}
