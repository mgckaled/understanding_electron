import { useCallback, useState } from 'react'

// F-1: dot coordinates copied from the `<g id="mark">` in
// resources/logo-proposta-monograma-c.svg — a design proposal the renderer
// never imports, so the numbers live here instead.
export type Dot = { id: string; cx: number; cy: number; r: number; opacity: number }

export const DOTS: readonly Dot[] = [
  { id: 'd1', cx: 20.48, cy: 14.34, r: 2.2, opacity: 1 },
  { id: 'd2', cx: 11.99, cy: 21.94, r: 2.8, opacity: 1 },
  { id: 'd3', cx: 0.99, cy: 24.98, r: 3.3, opacity: 1 },
  { id: 'd4', cx: -10.21, cy: 22.83, r: 3.7, opacity: 1 },
  { id: 'd5', cx: -19.27, cy: 15.93, r: 3.8, opacity: 1 },
  { id: 'd6', cx: -24.34, cy: 5.7, r: 4.0, opacity: 1 },
  { id: 'd7', cx: -24.34, cy: -5.7, r: 4.0, opacity: 1 },
  { id: 'd8', cx: -19.28, cy: -15.93, r: 3.8, opacity: 1 },
  { id: 'd9', cx: -10.21, cy: -22.83, r: 3.7, opacity: 1 },
  { id: 'd10', cx: 0.99, cy: -24.98, r: 3.3, opacity: 1 },
  { id: 'd11', cx: 11.99, cy: -21.94, r: 2.8, opacity: 1 },
  { id: 'd12', cx: 20.48, cy: -14.34, r: 2.2, opacity: 1 },
  { id: 'd13', cx: 31.05, cy: 7.74, r: 2.0, opacity: 0.55 },
  { id: 'd14', cx: 38.45, cy: -11.02, r: 1.3, opacity: 0.3 }
]

// Local viewBox unit → px. The ring spans ~50 local units; 0.91 (1.3x the
// original 0.7 — F-1 fixup, item 1) puts it at ~46px.
export const MARK_SCALE = 0.91
// The ring's centre, not the full dot set's centroid — d13/d14 are loose
// sparks outside the ring on purpose, and averaging them in would pull every
// ring dot's outward vector off-radial.
const CENTER = { x: -3, y: 0 }
const DISPERSE_MIN = 8
const DISPERSE_RANGE = 18
const JITTER_RANGE = 12
const PULSE_SCALE_MIN = 1.4
const PULSE_SCALE_RANGE = 0.4
const STAGGER_MAX_MS = 500

const ALL_DOT_IDS: ReadonlySet<string> = new Set(DOTS.map((dot) => dot.id))
const EMPTY_IDS: ReadonlySet<string> = new Set()

export type Variance = { dx: number; dy: number; pulseScale: number; delayMs: number }

const EMPTY_VARIANCE: ReadonlyMap<string, Variance> = new Map()

// One draw per turn, not per cycle: a value read live by a dot mid-flight
// would jump it. Positions and radii already differ per dot, so a single
// fixed draw still reads as organic across a whole reply.
function generateVariance(): ReadonlyMap<string, Variance> {
  return new Map(
    DOTS.map((dot): [string, Variance] => {
      const vx = dot.cx - CENTER.x
      const vy = dot.cy - CENTER.y
      const len = Math.hypot(vx, vy) || 1
      const distance = DISPERSE_MIN + Math.random() * DISPERSE_RANGE
      const jitter = (Math.random() - 0.5) * JITTER_RANGE
      return [
        dot.id,
        {
          dx: (vx / len) * distance + jitter,
          dy: (vy / len) * distance + jitter,
          pulseScale: PULSE_SCALE_MIN + Math.random() * PULSE_SCALE_RANGE,
          delayMs: Math.round(Math.random() * STAGGER_MAX_MS)
        }
      ]
    })
  )
}

/**
 * Drives the loop's random draw and its clean stop.
 *
 * @param isStreaming - Whether this conversation's reply is in flight.
 * @returns Which dots are animating, their per-dot variance, and the
 *   `onAnimationIteration` handler each dot wires to its own element.
 */
export function useRespondingLoop(isStreaming: boolean): {
  activeIds: ReadonlySet<string>
  variance: ReadonlyMap<string, Variance>
  onDotIteration: (id: string) => void
} {
  // Lazy initializers seed the mounting-while-already-streaming case; the
  // branch below only has to handle a LATER change, never the first render.
  const [activeIds, setActiveIds] = useState<ReadonlySet<string>>(() =>
    isStreaming ? ALL_DOT_IDS : EMPTY_IDS
  )
  const [variance, setVariance] = useState<ReadonlyMap<string, Variance>>(() =>
    isStreaming ? generateVariance() : EMPTY_VARIANCE
  )

  // Derived during render, not an effect (react.dev "Adjusting state when a
  // prop changes"): a new turn's draw is itself the render's output, not a
  // sync with an external system, so committing it a frame late is the one
  // to avoid, not the one to prefer. Turning false needs no state change
  // here — onDotIteration below reads `isStreaming` itself.
  const [prevIsStreaming, setPrevIsStreaming] = useState(isStreaming)
  if (isStreaming !== prevIsStreaming) {
    setPrevIsStreaming(isStreaming)
    if (isStreaming) {
      setVariance(generateVariance())
      setActiveIds(ALL_DOT_IDS)
    }
  }

  // A stop applies at each dot's OWN next boundary, which
  // --responding-dot-delay staggers — so this reads the prop fresh on every
  // call rather than latching a flag when streaming first turns false.
  const onDotIteration = useCallback(
    (id: string) => {
      if (isStreaming) return
      setActiveIds((current) => {
        if (!current.has(id)) return current
        const next = new Set(current)
        next.delete(id)
        return next
      })
    },
    [isStreaming]
  )

  return { activeIds, variance, onDotIteration }
}
