import { vi } from 'vitest'
import type { ArtifactApi, ArtifactRef } from '@renderer/features/artifact/artifactContext'
import { DEFAULT_WIDTH } from '@renderer/features/artifact/artifactWidth'

/**
 * A hand-made `ArtifactApi` for level-2 tests that mount one artifact component
 * without the real provider.
 *
 * Same reasoning as the `satisfies Api` mock of `window.api` (skill testing):
 * the return type is the contract, so a member added to `ArtifactApi` stops
 * every consumer from compiling in the same second — which is how the four
 * copies this replaced were found.
 *
 * @param current - What the panel is showing; `null` closes it.
 * @param artifacts - What the conversation offers. Defaults to `current` alone,
 *   the shape most tests want.
 */
export function fakeArtifactApi(
  current: ArtifactRef | null,
  artifacts: ArtifactRef[] = current === null ? [] : [current]
): ArtifactApi {
  return {
    current,
    closing: false,
    width: DEFAULT_WIDTH,
    setWidth: vi.fn(),
    artifacts,
    proposalId: null,
    toggle: vi.fn(),
    togglePanel: vi.fn(),
    close: vi.fn()
  }
}
