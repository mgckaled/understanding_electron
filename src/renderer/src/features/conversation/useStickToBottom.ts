import { useLayoutEffect, useRef, type RefObject } from 'react'

// The list sticks to the bottom while the model writes, UNLESS the user scrolled
// up (D13.5). There is deliberately NO scroll listener: the obvious `pinned` flag
// loses a race a live stream hits, because the DOM dispatches 'scroll'
// ASYNCHRONOUSLY — set scrollTop, let a token land, and the effect re-pins before
// the event arrives, silently undoing the user's scroll (measured on a real
// Ollama stream; jsdom cannot show it). Instead, synchronously compare scrollTop
// against WHERE WE LEFT IT: appended content does not move it, so an unchanged
// value means the user did not scroll. useLayoutEffect, or the list visibly jumps.

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
