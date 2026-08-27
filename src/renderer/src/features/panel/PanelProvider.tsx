import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_WIDTH } from '../../shared/ui/SidePanel/panelWidth'
import { PanelContext, type PanelKind } from './panelContext'

// Mirrors --duration-base: the unmount is scheduled in JS, and CSS cannot
// delay it (DF3C.1).
const FADE_MS = 200

/** Which key raises which tenant. Ctrl+R is out — it reloads in Chromium. */
const SHORTCUT: Record<string, PanelKind> = { b: 'artifact', d: 'draft' }

function isTyping(element: HTMLElement): boolean {
  return element.isContentEditable || element.tagName === 'TEXTAREA' || element.tagName === 'INPUT'
}

type PanelProviderProps = {
  children: ReactNode
  /** Called when the region goes from closed to open, so the shell can free room (DF3C.3). */
  onOpen?: () => void
}

function PanelProvider({ children, onOpen }: PanelProviderProps): React.JSX.Element {
  const [showing, setShowing] = useState<PanelKind | null>(null)
  const [widths, setWidths] = useState<Record<PanelKind, number>>({
    artifact: DEFAULT_WIDTH,
    draft: DEFAULT_WIDTH
  })
  const [closing, setClosing] = useState(false)

  const fade = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The opener, kept out of state because focusing it renders nothing (DF3A.8).
  const trigger = useRef<HTMLElement | null>(null)
  const openers = useRef<Partial<Record<PanelKind, () => void>>>({})

  useEffect(() => () => (fade.current === null ? undefined : clearTimeout(fade.current)), [])

  const close = useCallback(() => {
    // Before the fade ends: 200ms of focus on a leaving element is a lost Tab.
    trigger.current?.focus()
    trigger.current = null
    setClosing(true)
    if (fade.current !== null) clearTimeout(fade.current)
    fade.current = setTimeout(() => {
      fade.current = null
      setClosing(false)
      setShowing(null)
    }, FADE_MS)
  }, [])

  const release = useCallback(() => {
    if (fade.current !== null) clearTimeout(fade.current)
    fade.current = null
    trigger.current = null
    setClosing(false)
    setShowing(null)
  }, [])

  const raise = useCallback(
    (kind: PanelKind, opener: HTMLElement | null) => {
      if (fade.current !== null) clearTimeout(fade.current)
      fade.current = null
      setClosing(false)
      trigger.current = opener
      setShowing((previous) => {
        if (previous === null) onOpen?.()
        return kind
      })
    },
    [onOpen]
  )

  const toggle = useCallback(
    (kind: PanelKind, opener: HTMLElement | null) => {
      // While closing, the same tenant reopens instead of toggling shut.
      if (showing === kind && !closing) close()
      else raise(kind, opener)
    },
    [showing, closing, close, raise]
  )

  const onShortcut = useCallback((kind: PanelKind, open: () => void) => {
    openers.current[kind] = open
  }, [])

  const setWidth = useCallback(
    (px: number) =>
      setWidths((previous) => (showing === null ? previous : { ...previous, [showing]: px })),
    [showing]
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (!event.ctrlKey || event.altKey || event.shiftKey) return
      const kind = SHORTCUT[event.key.toLowerCase()]
      if (kind === undefined) return
      const target = event.target
      // An accelerator that fires mid-sentence is worse than none.
      if (target instanceof HTMLElement && isTyping(target)) return
      event.preventDefault()
      openers.current[kind]?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const value = useMemo(
    () => ({
      showing,
      closing,
      width: widths[showing ?? 'artifact'],
      setWidth,
      raise,
      toggle,
      close,
      release,
      onShortcut
    }),
    [showing, closing, widths, setWidth, raise, toggle, close, release, onShortcut]
  )

  return <PanelContext value={value}>{children}</PanelContext>
}

export default PanelProvider
