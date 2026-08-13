// Closes the markdown markers a mid-stream chunk left open, so a partial reply
// renders as markdown instead of one runaway code block (D11.4). Conservative:
// it closes an open fence (``` or ~~~), an odd backtick and an odd `**`, nothing
// else — a wrong guess costs a flicker, but leaving a fence open swallows the
// rest in code. Inline markers are counted only OUTSIDE a fence; text ending
// inside a fence closes the fence and stops, since everything after it is code.

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
