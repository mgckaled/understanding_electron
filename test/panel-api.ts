import { vi } from 'vitest'
import type { PanelApi, PanelKind } from '@renderer/features/panel/panelContext'
import { DEFAULT_WIDTH } from '@renderer/shared/ui/SidePanel/panelWidth'

/**
 * A hand-made `PanelApi` for level-2 tests that mount one panel without the
 * real provider — the region half of what `fakeArtifactApi` does for the
 * artifact half.
 *
 * @param showing - Which tenant holds the region; `null` closes it.
 */
export function fakePanelApi(showing: PanelKind | null = 'artifact'): PanelApi {
  return {
    showing,
    closing: false,
    width: DEFAULT_WIDTH,
    setWidth: vi.fn(),
    raise: vi.fn(),
    toggle: vi.fn(),
    close: vi.fn(),
    release: vi.fn(),
    onShortcut: vi.fn()
  }
}
