import { vi } from 'vitest'
import type { Api } from '@shared/ipc'

export function createApiMock(): Api {
  return {
    app: { info: vi.fn() },
    shell: { openExternal: vi.fn() }
  } satisfies Api
}

export function installApiMock(): Api {
  const api = createApiMock()
  window.api = api
  return api
}
