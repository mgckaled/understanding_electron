/** Longest base name we suggest; Windows allows more, but a path has a ceiling too. */
const MAX_BASE = 80

const FALLBACK = 'rascunho'

/** The nine characters Windows rejects in a name, plus the control range. */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[<>:"/\\|?*\x00-\x1f]/g

// Device names MS-DOS still reserves, matched with or without an extension:
// `CON.txt` is as invalid as `CON`.
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/**
 * Turns a draft title into a file name Windows will accept.
 *
 * @param title - Free text, since it was derived from a model's answer.
 * @param extension - Without the dot.
 */
export function exportFileName(title: string, extension: string): string {
  let base = title
    .replace(FORBIDDEN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_BASE)
    // Windows rejects a name ending in a dot or a space, and the slice above
    // can expose one that was not there before.
    .replace(/[. ]+$/, '')

  if (base === '') base = FALLBACK
  if (RESERVED.test(base)) base = `${base}_`

  return `${base}.${extension}`
}
