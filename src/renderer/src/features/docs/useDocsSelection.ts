import { useCallback, useState } from 'react'

/**
 * Which snippets and notes of one answer are left OUT of what gets attached
 * (D23G.3) — the set holds the unchecked keys, never the checked ones.
 *
 * Everything starts checked, so the empty set means "all of it goes", which is
 * the common case; the inverse would have to be seeded with every key on
 * arrival and re-seeded on every new answer.
 *
 * @returns `isOn` for one key, `toggle` to flip it, and the raw set the part
 *   builder needs to know what to record as omitted.
 */
export function useDocsSelection(): {
  isOn: (key: string) => boolean
  toggle: (key: string) => void
  offKeys: ReadonlySet<string>
} {
  const [offKeys, setOffKeys] = useState<ReadonlySet<string>>(() => new Set())

  const isOn = useCallback((key: string) => !offKeys.has(key), [offKeys])

  const toggle = useCallback((key: string) => {
    setOffKeys((previous) => {
      const next = new Set(previous)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }, [])

  return { isOn, toggle, offKeys }
}
