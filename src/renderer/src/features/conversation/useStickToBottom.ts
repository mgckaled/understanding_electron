import { useLayoutEffect, useRef, type RefObject } from 'react'

/*
 * The list sticks to the bottom while the model writes — UNLESS the user has
 * scrolled up (D13.5). Without the exception it is impossible to re-read the
 * start of an answer while the rest of it arrives.
 *
 * There is deliberately NO scroll listener here, and that is the whole design.
 * The obvious implementation subscribes to 'scroll' and flips a `pinned` flag,
 * and it loses a race that a live stream hits: the DOM dispatches 'scroll'
 * ASYNCHRONOUSLY, at the next rendering opportunity. Set scrollTop and let a
 * token land before the event fires, and the effect still reads pinned=true,
 * scrolls back to the bottom, and the event then arrives with the element
 * already at the bottom — re-pinning it. The user's scroll is undone and the
 * flag never even learns it happened. Measured against a real Ollama stream;
 * a mocked stream in jsdom has neither token cadence nor layout, so it cannot
 * show this.
 *
 * What replaces it is synchronous: compare scrollTop against WHERE WE LEFT IT.
 * Content appended below does not move scrollTop, so an unchanged value means
 * the user did not scroll. A changed value means they did, and the decision is
 * taken from the position itself, in the same frame the content changed.
 *
 * useLayoutEffect, not useEffect: the scroll must happen in the frame the new
 * content is painted, or the list visibly jumps.
 */

// How close to the bottom still counts as being at the bottom. Sub-pixel
// layout and a partially visible last line both land a few pixels short.
const BOTTOM_THRESHOLD = 32

// Fractional scroll offsets (zoom, high-DPI) make exact equality unreliable.
const MOVED_TOLERANCE = 1

export function useStickToBottom<T extends HTMLElement>(
  /** Changes whenever content is appended — the scroll follows if pinned. */
  contentSignal: unknown,
  /** Changes when the surface is replaced — the scroll jumps and re-pins. */
  resetSignal: unknown
): RefObject<T | null> {
  const ref = useRef<T | null>(null)
  const pinned = useRef(true)
  const leftAt = useRef(0)

  // A different conversation is a different surface: land at the bottom of it
  // and forget that the user had scrolled up in the previous one.
  useLayoutEffect(() => {
    const node = ref.current
    pinned.current = true
    if (node !== null) {
      node.scrollTop = node.scrollHeight
      leftAt.current = node.scrollTop
    }
  }, [resetSignal])

  useLayoutEffect(() => {
    const node = ref.current
    if (node === null) return

    if (Math.abs(node.scrollTop - leftAt.current) > MOVED_TOLERANCE) {
      pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight <= BOTTOM_THRESHOLD
    }
    if (pinned.current) node.scrollTop = node.scrollHeight
    leftAt.current = node.scrollTop
  }, [contentSignal])

  return ref
}
