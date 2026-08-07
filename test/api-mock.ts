import { vi } from 'vitest'
import type { Api } from '@shared/ipc'

export function createApiMock(): Api {
  return {
    app: { info: vi.fn() },
    shell: { openExternal: vi.fn() },
    dataset: { pick: vi.fn(), scan: vi.fn() },
    // onEvent defaults to a no-op unsubscribe: a component whose useEffect
    // cleanup calls the returned function would otherwise call undefined()
    // and throw, breaking every test that mounts it — not just the ones
    // about unsubscribing.
    job: { cancel: vi.fn(), onEvent: vi.fn().mockReturnValue(vi.fn()) }
  } satisfies Api
}

export function installApiMock(): Api {
  const api = createApiMock()
  window.api = api
  return api
}
