import { vi } from 'vitest'
import type { Api } from '@shared/ipc'
import { createConversationApi } from './conversation-store'

export function createApiMock(): Api {
  return {
    app: { info: vi.fn() },
    shell: { openExternal: vi.fn() },
    dataset: { pick: vi.fn(), scan: vi.fn() },
    // onEvent defaults to a no-op unsubscribe: a component whose useEffect
    // cleanup calls the returned function would otherwise call undefined()
    // and throw, breaking every test that mounts it — not just the ones
    // about unsubscribing.
    job: { cancel: vi.fn(), onEvent: vi.fn().mockReturnValue(vi.fn()) },
    ai: { isAvailable: vi.fn(), chat: vi.fn() },
    // Not bare vi.fn()s: conversations are the one surface the renderer READS
    // BACK after writing, so a mock that forgets everything would make every
    // test about switching, renaming or history vacuous. See conversation-store.
    conversation: createConversationApi()
  } satisfies Api
}

export function installApiMock(): Api {
  const api = createApiMock()
  window.api = api
  return api
}
