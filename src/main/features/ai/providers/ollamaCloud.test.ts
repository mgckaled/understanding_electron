import { afterEach, vi } from 'vitest'
import { UpstreamError } from '@core/ai/types'
import { makeOllamaModels, type OllamaTarget } from './ollama'
import { makeOllamaCloudModels, makeOllamaCloudProbe } from './ollamaCloud'

// Fixtures shaped from what the sondagem measured against ollama.com on
// 13/09/2026 — the suite never reaches the real service, because probing it
// spends the same monthly quota as using it.
const TAGS = {
  models: [
    { name: 'gemma4:31b', size: 21_000_000_000, details: { parameter_size: '32.7B' } },
    { name: 'gpt-oss:120b', size: 65_000_000_000, details: { parameter_size: '116.8B' } },
    // Out by measurement, not oversight: HTTP 400 on every request with tools.
    { name: 'gpt-oss:20b', size: 13_700_000_000, details: { parameter_size: '20.9B' } },
    // Paid tier: present in the catalog, answers 402 on use. The fixed list is
    // the only thing that tells it apart — the API does not.
    { name: 'deepseek-v4-pro:0813', size: 892_000_000_000, details: { parameter_size: '671B' } }
  ]
}

const SHOW = {
  capabilities: ['completion', 'thinking', 'tools', 'vision'],
  model_info: {
    'gemma4.context_length': 262_144,
    // Not reported by the cloud today, and here on purpose: the normalizer must
    // force `attention: null` rather than inherit whatever arrives (DNC-6).
    'gemma4.block_count': 48,
    'gemma4.attention.head_count_kv': 8,
    'gemma4.attention.key_length': 128
  }
}

function stubCatalog(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => (url.endsWith('/api/tags') ? TAGS : SHOW)
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('the cloud catalog', () => {
  it('spends one /api/show per listed model and none on the rest', async () => {
    const fetchMock = stubCatalog()

    const models = await makeOllamaCloudModels(() => 'k')({})

    // 1 + 2, not 1 + 20: the list filters BEFORE the probe (DNC-5).
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(models.map((model) => model.name)).toEqual(['gemma4:31b', 'gpt-oss:120b'])
  })

  it('forces attention and sizeBytes, and inherits the ceiling and capabilities', async () => {
    stubCatalog()

    const [model] = await makeOllamaCloudModels(() => 'k')({})

    // Forced: the payload above HAS an attention block and a 21 GB size.
    expect(model?.attention).toBeNull()
    expect(model?.sizeBytes).toBe(0)
    // Inherited: this is the whole reason for probing instead of hand-writing.
    expect(model?.contextLength).toBe(262_144)
    expect(model?.capabilities).toContain('vision')
    expect(model?.provider).toBe('ollama-cloud')
  })

  it('sends the key as a bearer header on every catalog request', async () => {
    const fetchMock = stubCatalog()

    await makeOllamaCloudModels(() => 'sk-test')({})

    for (const call of fetchMock.mock.calls) {
      const init = (call as unknown[])[1] as { headers: Record<string, string> }
      expect(init.headers.authorization).toBe('Bearer sk-test')
    }
  })

  it('refuses to reach the network at all with no key stored', async () => {
    const fetchMock = stubCatalog()

    await expect(makeOllamaCloudModels(() => null)({})).rejects.toBeInstanceOf(UpstreamError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('the cloud probe', () => {
  // ⚠️ /api/version at ollama.com answers 200 with no credential, so a ping
  // would prove only that the internet is up (DNC-7). Neither branch touches
  // the network, and the absent fetch stub is what proves it.
  it('answers from the vault, never from the network', async () => {
    await expect(makeOllamaCloudProbe(() => true)({})).resolves.toBeTypeOf('string')
    await expect(makeOllamaCloudProbe(() => false)({})).rejects.toBeInstanceOf(UpstreamError)
  })
})

describe('the shared catalog loop', () => {
  it('has no cloud-routing filter of its own — the target decides (DN3C.3)', async () => {
    // A `:cloud` tag is exactly what the LOCAL target drops. Here the target
    // keeps everything, so if the loop still held that filter, this would
    // silently return an empty list — the second spelling DN3A.3 found.
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith('/api/tags') ? { models: [{ name: 'qwen3.5:cloud', size: 0 }] } : SHOW
    }))
    vi.stubGlobal('fetch', fetchMock)

    const target: OllamaTarget = {
      baseUrl: 'https://example.test',
      label: 'test',
      headers: () => ({}),
      keepTag: () => true,
      normalize: (tag) => ({
        provider: 'ollama',
        name: tag.name,
        parameterSize: '',
        sizeBytes: 0,
        capabilities: [],
        contextLength: null,
        attention: null,
        variantOf: null
      })
    }

    const models = await makeOllamaModels(target)({})

    expect(models.map((model) => model.name)).toEqual(['qwen3.5:cloud'])
  })
})
