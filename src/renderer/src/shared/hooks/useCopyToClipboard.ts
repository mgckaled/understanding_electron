import { useCallback, useState } from 'react'

/**
 * Copies to the clipboard via the Chromium `navigator.clipboard` API — no
 * IPC, no channel: the renderer already runs inside a browser context that
 * has this. `copied` reverts to `false` after 2s, for a button's transient
 * "copiado" state (DS5, items 4-5).
 */
export function useCopyToClipboard(): { copied: boolean; copy: (text: string) => Promise<void> } {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async (text: string): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  return { copied, copy }
}
