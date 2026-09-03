import { render, renderHook, act, screen } from '@testing-library/react'
import RespondingMark from './RespondingMark'
import { useRespondingLoop } from './useRespondingLoop'

// jsdom neither exposes `AnimationEvent` nor delivers a plain
// `animationiteration` Event to React's onAnimationIteration — confirmed by
// hand, not assumed. So the per-dot stop is exercised on the hook directly,
// calling `onDotIteration` the way a real animationiteration would; whether
// the browser actually fires it, and lands on rest, is only provable live
// (pnpm dev) — see docs/plan/implemented/F-1-marca-pensando.md § QA.

function dots(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('.responding-dot'))
}

describe('RespondingMark', () => {
  it('renders all 14 dots at rest when not streaming', () => {
    const { container } = render(<RespondingMark isStreaming={false} />)
    const rendered = dots(container)
    expect(rendered).toHaveLength(14)
    expect(rendered.every((dot) => !dot.classList.contains('animate-responding-dot'))).toBe(true)
  })

  it('animates every dot once streaming starts', () => {
    const { container } = render(<RespondingMark isStreaming={true} />)
    const rendered = dots(container)
    expect(rendered).toHaveLength(14)
    expect(rendered.every((dot) => dot.classList.contains('animate-responding-dot'))).toBe(true)
  })

  it('labels each phase: connecting, thinking, responding', () => {
    const { rerender } = render(<RespondingMark isStreaming={true} phase="connecting" />)
    expect(screen.getByText(/^Preparando/)).toBeInTheDocument()

    rerender(<RespondingMark isStreaming={true} phase="thinking" />)
    expect(screen.getByText(/^Pensando/)).toBeInTheDocument()

    rerender(<RespondingMark isStreaming={true} phase="responding" />)
    expect(screen.getByText(/^Respondendo/)).toBeInTheDocument()

    rerender(<RespondingMark isStreaming={true} />)
    expect(screen.getByText(/^Respondendo/)).toBeInTheDocument()
  })
})

describe('useRespondingLoop', () => {
  it('activates all 14 dots on start and stops only the dot whose own boundary fires', () => {
    const { result, rerender } = renderHook(({ isStreaming }) => useRespondingLoop(isStreaming), {
      initialProps: { isStreaming: true }
    })
    const [firstId, secondId] = [...result.current.activeIds]
    expect(result.current.activeIds.size).toBe(14)

    rerender({ isStreaming: false })
    // The request to stop lands on each dot's next boundary, not now.
    expect(result.current.activeIds.has(firstId)).toBe(true)

    act(() => result.current.onDotIteration(firstId))
    expect(result.current.activeIds.has(firstId)).toBe(false)
    expect(result.current.activeIds.has(secondId)).toBe(true)
  })

  it('restarts a dot that was mid-stop when streaming resumes', () => {
    const { result, rerender } = renderHook(({ isStreaming }) => useRespondingLoop(isStreaming), {
      initialProps: { isStreaming: true }
    })
    const [firstId] = [...result.current.activeIds]

    rerender({ isStreaming: false })
    act(() => result.current.onDotIteration(firstId))
    expect(result.current.activeIds.has(firstId)).toBe(false)

    rerender({ isStreaming: true })
    expect(result.current.activeIds.has(firstId)).toBe(true)
  })

  it('ignores an iteration that fires before any stop was requested', () => {
    const { result } = renderHook(({ isStreaming }) => useRespondingLoop(isStreaming), {
      initialProps: { isStreaming: true }
    })
    const [firstId] = [...result.current.activeIds]

    act(() => result.current.onDotIteration(firstId))
    expect(result.current.activeIds.has(firstId)).toBe(true)
  })
})
