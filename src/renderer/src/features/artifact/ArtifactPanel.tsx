import { useEffect, useRef, useState } from 'react'
import { Check, Copy, FileText, Image, X } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import ArtifactBody from './ArtifactBody'
import { useArtifact } from './artifactContext'
import { copyArtifact } from './copyArtifact'

// The width is a value, not a class: it comes from state (DF3A.4), and
// Tailwind's static scan cannot see a runtime number — the framework's own docs
// send complex sizing to `style` for exactly this reason. The clamp is what
// keeps the conversation readable: 50vw is the ceiling asked for, but on a
// narrow window the second term of the `min` wins and the panel yields instead
// of squeezing the thread into a strip.
const WIDTH = 'clamp(22rem, var(--artifact-width), min(50vw, 100vw - 32rem))'
const DEFAULT_WIDTH = '34rem'

/** How long the copy button stays confirmed. Long enough to be seen, short
 *  enough that it is gone before the next glance. */
const COPIED_MS = 1200

function ArtifactPanel(): React.JSX.Element | null {
  const { current, close } = useArtifact()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => (timer.current === null ? undefined : clearTimeout(timer.current)), [])

  if (current === null) return null

  async function handleCopy(): Promise<void> {
    if (current === null || !(await copyArtifact(current))) return
    setCopied(true)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  const Icon = current.kind === 'image' ? Image : FileText

  return (
    <aside
      className="flex h-full flex-col overflow-hidden border-l border-border bg-surface"
      style={{ '--artifact-width': DEFAULT_WIDTH, width: WIDTH } as React.CSSProperties}
      aria-label="Anexo aberto"
    >
      {/* Chrome density (D13.6), and the same icon and name the card shows — the
          eye connects the two without having to think about it. */}
      <header className="flex flex-none items-center gap-3 border-b border-border px-5 py-4">
        <Icon size={ICON_SIZE.md} strokeWidth={ICON_STROKE} className="flex-none text-text-muted" />
        <span className="min-w-[0px] flex-1 overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap text-text">
          {current.part.fileName}
        </span>
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
      </header>

      {/* Reading density, and the panel's own scrolling surface — the header
          stays put and the page still never scrolls (D13.5). */}
      <div className="min-h-[0px] flex-1 overflow-y-auto p-7 select-text">
        <ArtifactBody artifact={current} />
      </div>
    </aside>
  )
}

export default ArtifactPanel
