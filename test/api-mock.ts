import { vi } from 'vitest'
import type { AiModel, Api } from '@shared/ipc'
import { createStoreApi } from './store-api'

/**
 * One real model, so a mounted ConversationView has something to select.
 *
 * Values are the ones measured on the development machine, and gemma3:4b is
 * first on purpose: it is what the app used to hardcode, so every test written
 * before the catalog existed keeps asserting the model it always asserted.
 */
export const TEST_MODEL: AiModel = {
  provider: 'ollama',
  name: 'gemma3:4b',
  parameterSize: '4.3B',
  sizeBytes: 3_338_801_804,
  capabilities: ['completion', 'vision'],
  contextLength: 131072,
  attention: { blockCount: 34, headCountKv: 4, headDim: 256, slidingWindow: 1024 },
  variantOf: null
}

export function createApiMock(): Api {
  return {
    app: {
      // Resolves a realistic AppInfo by default, for the same reason memory and
      // ai.models do below: Versions now renders inside the Settings modal, so
      // any test that opens Configurações mounts it, and a bare vi.fn() resolving
      // `undefined` would make `.info().then(...)` throw in tests that have
      // nothing to do with build versions.
      info: vi.fn().mockResolvedValue({
        electron: '42.8.0',
        chrome: '148.0.0',
        node: '24.18.0',
        app: '1.0.0',
        platform: 'win32',
        isDev: true
      }),
      // A realistic figure by default, for the same reason ai.models resolves a
      // real catalog: `undefined` here would make every context ceiling NaN,
      // breaking tests that have nothing to do with memory. ~6 GB free of 16 is
      // the development machine in its working environment.
      memory: vi.fn().mockResolvedValue({ freeBytes: 6 * 1024 ** 3, totalBytes: 16 * 1024 ** 3 })
    },
    shell: { openExternal: vi.fn() },
    dataset: { pick: vi.fn(), attach: vi.fn() },
    // onEvent defaults to a no-op unsubscribe: a component whose useEffect
    // cleanup calls the returned function would otherwise call undefined()
    // and throw, breaking every test that mounts it — not just the ones
    // about unsubscribing.
    job: { cancel: vi.fn(), onEvent: vi.fn().mockReturnValue(vi.fn()) },
    ai: {
      isAvailable: vi.fn(),
      // Resolves a real catalog by default, for exactly the reason job.onEvent
      // returns a no-op above: a bare vi.fn() resolves `undefined`, which the
      // selector reads as "the catalog failed" — and that would break every
      // test that merely mounts the view, not only the ones about models.
      models: vi.fn().mockResolvedValue({ ok: true, value: [TEST_MODEL] }),
      // Nothing resident by default: the common state, and the one that keeps
      // Configurações from claiming the machine is holding weights it is not.
      loaded: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      unload: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
      chat: vi.fn()
    },
    // Not bare vi.fn()s: these two are the surfaces the renderer READS BACK
    // after writing, so a mock that forgets everything would make every test
    // about switching, renaming, history or a persisted setting vacuous.
    ...createStoreApi()
  } satisfies Api
}

export function installApiMock(): Api {
  const api = createApiMock()
  window.api = api
  return api
}
