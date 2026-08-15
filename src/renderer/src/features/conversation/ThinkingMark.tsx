import { DOTS, MARK_SCALE, useThinkingLoop, type Dot, type Variance } from './useThinkingLoop'

// F-1: the crivo monogram as the "model is working" signal, always visible
// between the thread and the composer.

type DotStyle = React.CSSProperties & Record<`--thinking-${string}`, string | number>

function dotStyle(dot: Dot, variance: Variance | undefined): DotStyle {
  const style: DotStyle = {
    '--thinking-r': dot.r,
    '--thinking-rest-x': `${dot.cx * MARK_SCALE}px`,
    '--thinking-rest-y': `${dot.cy * MARK_SCALE}px`,
    '--thinking-rest-opacity': dot.opacity
  }
  if (variance !== undefined) {
    style['--thinking-dx'] = `${variance.dx * MARK_SCALE}px`
    style['--thinking-dy'] = `${variance.dy * MARK_SCALE}px`
    style['--thinking-pulse-scale'] = variance.pulseScale
    style['--thinking-dot-delay'] = `${variance.delayMs}ms`
  }
  return style
}

type ThinkingMarkProps = {
  /** True only while this conversation's own reply is in flight. */
  isStreaming: boolean
}

/**
 * The crivo monogram, always on screen between the thread and the composer.
 * At rest it holds the "C" shape; while streaming, its 14 dots pulse out of
 * sync, disperse, and converge back, in a loop that only ever stops on rest.
 */
function ThinkingMark({ isStreaming }: ThinkingMarkProps): React.JSX.Element {
  const { activeIds, variance, onDotIteration } = useThinkingLoop(isStreaming)

  return (
    <div
      className="flex-none bg-bg px-7 py-4"
      role={isStreaming ? 'status' : undefined}
      aria-hidden={isStreaming ? undefined : true}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-[35px] w-[44px]">
          {DOTS.map((dot) => {
            const isActive = activeIds.has(dot.id)
            return (
              <div
                key={dot.id}
                className={isActive ? 'thinking-dot animate-thinking-dot' : 'thinking-dot'}
                style={dotStyle(dot, variance.get(dot.id))}
                onAnimationIteration={isActive ? () => onDotIteration(dot.id) : undefined}
              />
            )
          })}
        </div>
        {isStreaming && <span className="text-sm text-text-muted italic">respondendo…</span>}
      </div>
    </div>
  )
}

export default ThinkingMark
