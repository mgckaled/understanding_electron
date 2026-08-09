/*
 * Closes the markdown markers left open by a mid-stream chunk, so a partial reply
 * renders as formatted markdown instead of one runaway code block (D11.4).
 *
 * Deliberately conservative: it closes an open fenced block (``` or ~~~), an odd
 * single backtick and an odd `**`, and nothing else — not single `*` (italic),
 * not `***`, not `_`. A wrong guess here costs a flicker of odd formatting; the
 * opposite error (leaving a fence open) swallows the rest of the answer in code.
 *
 * The fence scan is the whole algorithm: inline markers are counted only on lines
 * OUTSIDE a fence, and if the text ends inside a fence the fence is closed and we
 * stop — everything after an open fence is code, so its `**` must not be balanced.
 */

const FENCE = /^\s*([`~]{3,})/

export function completePartial(text: string): string {
  const lines = text.split('\n')
  const prose: string[] = []
  let fence: string | null = null

  for (const line of lines) {
    const marker = FENCE.exec(line)?.[1]
    if (fence === null) {
      if (marker !== undefined) fence = marker
      else prose.push(line)
    } else if (marker !== undefined && marker[0] === fence[0] && marker.length >= fence.length) {
      fence = null
    }
    // Lines inside a fence are code — never prose, never counted.
  }

  if (fence !== null) {
    return text + (text.endsWith('\n') ? '' : '\n') + fence
  }

  const proseText = prose.join('\n')
  let suffix = ''
  if (proseText.split('`').length % 2 === 0) suffix += '`'
  if ((proseText.match(/\*\*/g)?.length ?? 0) % 2 === 1) suffix += '**'
  return text + suffix
}
