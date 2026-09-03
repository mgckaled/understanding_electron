import { useId, useMemo, useState } from 'react'
import { ChevronDown, Lightbulb } from 'lucide-react'
import type { AiService } from '@shared/ipc'
import { flattenReasoning } from '@core/ai/reasoningText'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { SERVICE_LABEL } from '../../shared/serviceLabel'
import { cx } from '../../shared/ui/cx'

type ReasoningDisclosureProps = {
  text: string
  provider: AiService
  /** Whether reasoning is the only thing arriving so far — absent means historical, always closed by default. */
  thinking?: boolean
}

function ReasoningDisclosure({
  text,
  provider,
  thinking
}: ReasoningDisclosureProps): React.JSX.Element | null {
  const bodyId = useId()
  const flat = useMemo(() => flattenReasoning(text), [text])
  const [open, setOpen] = useState(thinking === true)
  const [overridden, setOverridden] = useState(false)
  const [animate, setAnimate] = useState(false)
  const [prevThinking, setPrevThinking] = useState(thinking)

  if (thinking !== prevThinking) {
    setPrevThinking(thinking)
    if (!overridden && thinking !== undefined) {
      setOpen(thinking)
      setAnimate(true)
    }
  }

  // flattenReasoning can return '' on a whitespace-only first chunk while
  // streaming, so this guard has to run after every hook above — an earlier
  // return would change how many hooks run between one render and the next.
  if (flat === '') return null

  function toggle(): void {
    setOverridden(true)
    setAnimate(true)
    setOpen((value) => !value)
  }

  return (
    <div className="mb-1 max-w-[80%] rounded-lg border border-border bg-surface-raised px-5 py-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
        className="flex items-center gap-2 font-ui text-sm text-text-muted"
      >
        <Lightbulb
          size={ICON_SIZE.sm}
          strokeWidth={ICON_STROKE}
          className={cx(
            thinking === true ? 'animate-pulse-warn text-warn-text' : 'text-text-faint'
          )}
          aria-hidden="true"
        />
        <span>{SERVICE_LABEL[provider]}</span>
        <ChevronDown
          size={ICON_SIZE.sm}
          strokeWidth={ICON_STROKE}
          className={cx(
            'transition-transform duration-(--duration-fast) ease-initial',
            open && 'rotate-180'
          )}
        />
      </button>
      <div
        id={bodyId}
        aria-hidden={!open}
        className={cx(
          'overflow-hidden',
          animate && 'transition-[height] duration-(--duration-base) ease-initial',
          // h-0 emits no CSS at all — --spacing-* is only defined for 1-9
          // (tailwind.css), same trap Sidebar.tsx documents for min-h-0.
          open ? '[height:calc-size(auto,size)]' : 'h-[0px]'
        )}
      >
        <p className="mt-3 text-reading leading-normal text-text-muted italic select-text">
          {flat}
        </p>
      </div>
    </div>
  )
}

export default ReasoningDisclosure
