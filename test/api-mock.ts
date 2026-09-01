import { vi } from 'vitest'
import type { AiModel, Api } from '@shared/ipc'
import { columnsToArrowBytes } from '@core/duckdb/arrow'
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
      // ai.models do below: the observatory's Runtime panel reads it on mount
      // (O-1), and a bare vi.fn() resolving `undefined` would break tests that
      // have nothing to do with build versions.
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
      memory: vi.fn().mockResolvedValue({ freeBytes: 6 * 1024 ** 3, totalBytes: 16 * 1024 ** 3 }),
      // Empty, not a bare vi.fn(): the observatory's Processos panel reads this
      // on mount, and `undefined` would throw where the list merely renders.
      processes: vi.fn().mockResolvedValue([]),
      // Same reasoning: the observatory's Em andamento panel (O-2) reads this
      // on mount.
      ipcStats: vi.fn().mockResolvedValue([])
    },
    shell: { openExternal: vi.fn() },
    dataset: {
      pick: vi.fn(),
      attach: vi.fn(),
      // Resolves empty-but-valid Arrow bytes by default, for the same reason
      // ai.models resolves a real catalog above: DatasetCard's preview (18-C)
      // fires this on mount, so a bare vi.fn() resolving undefined would turn
      // every dataset-attachment test into an error card, not just the ones
      // actually about querying.
      query: vi.fn().mockResolvedValue({ ok: true, value: columnsToArrowBytes({}) }),
      // Unlike query, nothing fires this on mount — the profile section only
      // queries when its own disclosure opens (D18D.6) — so a bare vi.fn()
      // is safe here, same as pick/attach above.
      profile: vi.fn(),
      // Same reasoning as profile — nothing fires this on mount, it only runs
      // when a proposal is applied (plano 19).
      transform: vi.fn(),
      // Same reasoning as processes above: the Em andamento panel (O-2) reads
      // this on mount.
      queueDepth: vi.fn().mockResolvedValue(0),
      // Same reasoning: the Motor DuckDB panel (O-3) reads this on mount.
      engineInfo: vi.fn().mockResolvedValue({
        ok: true,
        value: { memoryLimit: '2.0GiB', extensions: [], memoryByTag: [] }
      })
    },
    document: { pick: vi.fn(), attach: vi.fn() },
    image: { pick: vi.fn(), attach: vi.fn(), bytes: vi.fn() },
    // onEvent defaults to a no-op unsubscribe: a component whose useEffect
    // cleanup calls the returned function would otherwise call undefined()
    // and throw, breaking every test that mounts it — not just the ones
    // about unsubscribing.
    job: {
      cancel: vi.fn(),
      // Empty, same reasoning as app.processes: the Em andamento panel (O-2)
      // reads this on mount.
      list: vi.fn().mockResolvedValue([]),
      onEvent: vi.fn().mockReturnValue(vi.fn())
    },
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
      chat: vi.fn(),
      propose: vi.fn()
    },
    // Not bare vi.fn()s: these two are the surfaces the renderer READS BACK
    // after writing, so a mock that forgets everything would make every test
    // about switching, renaming, history or a persisted setting vacuous.
    // Resolves a cancelled dialog by default, for the same reason ai.models
    // resolves a real catalog: a bare vi.fn() gives `undefined`, and reading
    // `.ok` off it would throw in every test that merely mounts the footer.
    export: { save: vi.fn().mockResolvedValue({ ok: true, value: null }) },
    ...createStoreApi(),
    secrets: {
      write: vi.fn(),
      // false, not a bare vi.fn(): undefined is neither of the field's two
      // states, the same trap ai.models' own comment above describes.
      has: vi.fn().mockResolvedValue(false),
      remove: vi.fn()
    },
    // Empty, not a bare vi.fn(): the Banco de dados panel (O-3) reads this
    // on mount, same reasoning as app.processes above.
    database: {
      info: vi.fn().mockResolvedValue({
        migrationVersion: 0,
        sizeBytes: 0,
        freelistCount: 0,
        tables: []
      })
    },
    session: {
      cacheSize: vi.fn().mockResolvedValue(0),
      clearCache: vi.fn()
    },
    disk: {
      usage: vi.fn().mockResolvedValue({
        ok: true,
        value: { crivo: [], runtimeBytes: 0, runtimePartial: false, totalBytes: 0 }
      })
    },
    events: {
      list: vi.fn().mockResolvedValue([])
    },
    performance: {
      list: vi.fn().mockResolvedValue([])
    },
    privacy: {
      list: vi.fn().mockResolvedValue({ rows: [], totalCalls: 0, callsWithAttachment: 0 })
    }
  } satisfies Api
}

export function installApiMock(): Api {
  const api = createApiMock()
  window.api = api
  return api
}
