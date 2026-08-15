import { Check, Copy, RotateCcw, Share2 } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useCopyToClipboard } from '../../shared/hooks/useCopyToClipboard'

// Three icons under each assistant turn (DS5, item 5). Only copy is wired —
// share and regenerate ship `disabled`, not a silent no-op (DS5.7): a
// clickable button with no effect is a worse signal than one that visibly
// isn't ready yet. `RotateCcw`, not the `RefreshCw` the model-reload button
// already uses (ModelSelector.tsx), so the two do not read as the same action.

type TurnActionsProps = {
  /** The plain-text answer — what `copy` sends. */
  text: string
}

function TurnActions({ text }: TurnActionsProps): React.JSX.Element {
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={() => void copy(text)}
        title={copied ? 'Copiado' : 'Copiar resposta'}
        aria-label={copied ? 'Copiado' : 'Copiar resposta'}
      >
        {copied ? (
          <Check size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        ) : (
          <Copy size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        disabled
        title="Compartilhar (em breve)"
        aria-label="Compartilhar (em breve)"
      >
        <Share2 size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        disabled
        title="Gerar novamente (em breve)"
        aria-label="Gerar novamente (em breve)"
      >
        <RotateCcw size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
      </Button>
    </div>
  )
}

export default TurnActions
