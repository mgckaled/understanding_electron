import { act, renderHook } from '@testing-library/react'
import { THREE_REGIONS_MIN_WIDTH, useSidebarSpace } from './sidebarSpace'

function viewport(width: number): void {
  window.innerWidth = width
}

describe('useSidebarSpace', () => {
  it('collapses the sidebar when the three regions do not fit', () => {
    viewport(THREE_REGIONS_MIN_WIDTH - 1)
    const { result } = renderHook(() => useSidebarSpace())

    act(() => result.current.makeRoom())

    expect(result.current.collapsed).toBe(true)
  })

  it('leaves the sidebar alone when they fit', () => {
    viewport(THREE_REGIONS_MIN_WIDTH)
    const { result } = renderHook(() => useSidebarSpace())

    act(() => result.current.makeRoom())

    expect(result.current.collapsed).toBe(false)
  })

  it('stops deciding once the user expands the sidebar by hand', () => {
    viewport(THREE_REGIONS_MIN_WIDTH - 1)
    const { result } = renderHook(() => useSidebarSpace())

    act(() => result.current.makeRoom())
    act(() => result.current.setCollapsed(false))
    act(() => result.current.makeRoom())

    expect(result.current.collapsed).toBe(false)
  })
})
