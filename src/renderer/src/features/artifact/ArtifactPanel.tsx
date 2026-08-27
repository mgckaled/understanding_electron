import { useEffect, useRef, useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import SidePanel from '../../shared/ui/SidePanel/SidePanel'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import ArtifactBody from './ArtifactBody'
import ArtifactPicker from './ArtifactPicker'
import { useArtifact } from './artifactContext'
import { canCopy, copyArtifact } from './copyArtifact'

/** How long the copy button stays confirmed. Long enough to be seen, short
 *  enough that it is gone before the next glance. */
const COPIED_MS = 1200

function ArtifactPanel(): React.JSX.Element | null {
  const { current, closing, width, setWidth, close } = useArtifact()
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

  return (
    <SidePanel
      label="Anexo aberto"
      contentKey={current.id}
      closing={closing}
      width={width}
      setWidth={setWidth}
      onClose={close}
      header={
        <>
          {/* The same icon and name the card shows — the eye connects the two
              without having to think about it. */}
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
        </>
      }
    >
      <ArtifactBody artifact={current} />
    </SidePanel>
  )
}

export default ArtifactPanel
