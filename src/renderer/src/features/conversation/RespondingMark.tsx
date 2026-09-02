import { useEffect, useState } from 'react'
import { DOTS, MARK_SCALE, useRespondingLoop, type Dot, type Variance } from './useRespondingLoop'

// F-1: the crivo monogram as the "model is working" signal, always visible
// between the thread and the composer.

const DOT_FRAMES = ['.', '..', '...']
const DOT_FRAME_MS = 450

// A JS interval, not a CSS animation (F-1 fixup, item 1): the browser cannot
// animate the discrete `content` of a pseudo-element through three text
// values without a flicker-prone steps() trick, and the interval's lifetime
// already matches the span's mount/unmount (isStreaming), so nothing extra
// to clean up beyond the usual effect teardown.
function useCyclingDots(active: boolean): string {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const id = setInterval(
      () => setFrame((current) => (current + 1) % DOT_FRAMES.length),
      DOT_FRAME_MS
    )
    return () => clearInterval(id)
  }, [active])
  return DOT_FRAMES[frame]
}

type DotStyle = React.CSSProperties & Record<`--responding-${string}`, string | number>

function dotStyle(dot: Dot, variance: Variance | undefined): DotStyle {
  const style: DotStyle = {
    '--responding-r': dot.r,
    '--responding-rest-x': `${dot.cx * MARK_SCALE}px`,
    '--responding-rest-y': `${dot.cy * MARK_SCALE}px`,
    '--responding-rest-opacity': dot.opacity
  }
  if (variance !== undefined) {
    style['--responding-dx'] = `${variance.dx * MARK_SCALE}px`
    style['--responding-dy'] = `${variance.dy * MARK_SCALE}px`
    style['--responding-pulse-scale'] = variance.pulseScale
    style['--responding-dot-delay'] = `${variance.delayMs}ms`
  }
  return style
}

type RespondingMarkProps = {
  /** True only while this conversation's own reply is in flight. */
  isStreaming: boolean
}

/**
 * The crivo monogram, always on screen between the thread and the composer.
 * At rest it holds the "C" shape; while streaming, its 14 dots pulse out of
 * sync, disperse, and converge back, in a loop that only ever stops on rest.
 */
function RespondingMark({ isStreaming }: RespondingMarkProps): React.JSX.Element {
  const { activeIds, variance, onDotIteration } = useRespondingLoop(isStreaming)
  const dots = useCyclingDots(isStreaming)

  return (
    <div
      className="flex-none bg-bg px-7 py-5"
      role={isStreaming ? 'status' : undefined}
      // A stable name for assistive tech (F-1 fixup, item 1): the visible
      // "respondendo…" span below re-renders every 450ms, and without this,
      // a status region would announce every one of those dot changes.
      aria-label={isStreaming ? 'Gerando resposta' : undefined}
      aria-hidden={isStreaming ? undefined : true}
    >
      <div className="flex items-center gap-5">
        <div className="relative h-[46px] w-[57px]">
          {DOTS.map((dot) => {
            const isActive = activeIds.has(dot.id)
            return (
              <div
                key={dot.id}
                className={isActive ? 'responding-dot animate-responding-dot' : 'responding-dot'}
                style={dotStyle(dot, variance.get(dot.id))}
                onAnimationIteration={isActive ? () => onDotIteration(dot.id) : undefined}
              />
            )
          })}
        </div>
        {isStreaming && (
          <span className="text-lg text-text-muted italic" aria-hidden="true">
            respondendo{dots}
          </span>
        )}
      </div>
    </div>
  )
}

export default RespondingMark
