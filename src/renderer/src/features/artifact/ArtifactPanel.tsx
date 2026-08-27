import { useEffect, useId, useRef, useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import styles from './ArtifactPanel.module.css'
import ArtifactBody from './ArtifactBody'
import ArtifactPicker from './ArtifactPicker'
import ArtifactResizer from './ArtifactResizer'
import { useArtifact } from './artifactContext'
import { canCopy, copyArtifact } from './copyArtifact'
import { WIDTH_CSS } from './artifactWidth'

/** How long the copy button stays confirmed. Long enough to be seen, short
 *  enough that it is gone before the next glance. */
const COPIED_MS = 1200

function ArtifactPanel(): React.JSX.Element | null {
  const { current, closing, width, setWidth, close } = useArtifact()
  const panelId = useId()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const region = useRef<HTMLElement>(null)

  // Opening moves focus into the panel; `close` sends it back to the card
  // (DF3A.8). Without the pair, keyboard navigation opens the panel and lands
  // nowhere. Keyed on the id, so swapping artifacts re-focuses too.
  const openId = current?.id ?? null
  useEffect(() => {
    if (openId !== null) region.current?.focus()
  }, [openId])

  useEffect(() => () => (timer.current === null ? undefined : clearTimeout(timer.current)), [])

  if (current === null) return null

  async function handleCopy(): Promise<void> {
    if (current === null || !(await copyArtifact(current))) return
    setCopied(true)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    <aside
      id={panelId}
      ref={region}
      // Not a Dialog and not a focus trap: the panel is NOT modal — clicking
      // back into the conversation with it open has to keep working. So Esc
      // only closes while focus is inside it, which is the platform's own
      // behaviour for a non-modal region.
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close()
      }}
      className={`${styles.panel} relative flex h-full flex-col overflow-hidden border-l border-border bg-surface outline-none`}
      data-closing={closing ? 'true' : undefined}
      style={{ '--artifact-width': `${width}px`, width: WIDTH_CSS } as React.CSSProperties}
      aria-label="Anexo aberto"
    >
      <ArtifactResizer
        panelId={panelId}
        width={width}
        apply={(px) => region.current?.style.setProperty('--artifact-width', `${px}px`)}
        commit={setWidth}
        close={close}
      />
      {/* Chrome density (D13.6), and the same icon and name the card shows — the
          eye connects the two without having to think about it. */}
      <header className="flex flex-none items-center gap-3 border-b border-border px-5 py-4">
        <ArtifactPicker current={current} />
        <div className="ml-auto flex flex-none items-center gap-1">
          {/* Absent, not disabled, for an image: a greyed button promises a
            capability that is not coming back on its own (DF3A.7). */}
          {canCopy(current) && (
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="flex-none"
              onClick={() => void handleCopy()}
              aria-label={copied ? 'Copiado' : 'Copiar'}
            >
              {copied ? (
                <Check size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} className="text-ok-text" />
              ) : (
                <Copy size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            className="flex-none"
            onClick={close}
            aria-label="Fechar painel"
          >
            <X size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
          </Button>
        </div>
      </header>

      {/* The region below the header, not a scrolling surface: which part of a
          body scrolls depends on the body, and ArtifactBody decides it. */}
      <div className="flex min-h-[0px] flex-1 flex-col p-1">
        <ArtifactBody artifact={current} />
      </div>
    </aside>
  )
}

export default ArtifactPanel
