import { afterEach, vi } from 'vitest'
import type { ChatMessage } from '@shared/ipc'
import { UpstreamError } from '@core/ai/types'
import { ollamaChat, ollamaModels, ollamaProbe } from './ollama'

const messages: ChatMessage[] = [{ role: 'user', content: 'oi' }]

// Builds a fetch stub whose body streams the given raw string pieces — pieces
// are enqueued verbatim, so splitting a JSON line across two proves the
// cross-chunk buffering, not just the happy path. Returns the mock so a test
// can inspect the request body it was called with.
function stubChatStream(
  pieces: string[],
  init?: { ok?: boolean; status?: number }
): ReturnType<typeof vi.fn> {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece))
      controller.close()
    }
  })
  const fetchMock = vi.fn(async () => ({ ok: init?.ok ?? true, status: init?.status ?? 200, body }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = (fetchMock.mock.calls[0] as unknown[])[1] as { body: string }
  return JSON.parse(init.body)
}

afterEach(() => vi.unstubAllGlobals())

describe('ollamaModels', () => {
  // Routes by URL because the catalog is N+1 calls to two different endpoints —
  // a single-response stub would hide whether /api/show was consulted at all,
  // which is the entire point of the extra request.
  function stubCatalog(
    tags: unknown,
    showByModel: Record<string, unknown>
  ): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(async (url: string, init?: { body?: string }) => {
      if (url.endsWith('/api/tags')) {
        return { ok: true, status: 200, json: async () => tags }
      }
      const { model } = JSON.parse(init?.body ?? '{}') as { model: string }
      return { ok: true, status: 200, json: async () => showByModel[model] }
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('asks /api/show once per model and normalizes with what it returns', async () => {
    const fetchMock = stubCatalog(
      {
        models: [
          { name: 'gemma3:4b', size: 3_338_801_804, details: { parameter_size: '4.3B' } },
          { name: 'qwen2.5-coder:3b', size: 1_929_000_000, details: { parameter_size: '3.1B' } }
        ]
      },
      {
        // As measured: /api/tags reports gemma3:4b without `vision`, and only
        // /api/show admits it. The catalog must carry the /api/show answer.
        'gemma3:4b': {
          capabilities: ['completion', 'vision'],
          model_info: { 'gemma3.context_length': 131072 }
        },
        'qwen2.5-coder:3b': {
          capabilities: ['completion', 'tools', 'insert'],
          model_info: { 'qwen2.context_length': 32768 }
        }
      }
    )

    const models = await ollamaModels({})

    // 1 for /api/tags plus 1 per model — the N+1 the decision accepted.
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(models.map((m) => m.name)).toEqual(['gemma3:4b', 'qwen2.5-coder:3b'])
    expect(models[0].capabilities).toContain('vision')
    expect(models[0].contextLength).toBe(131072)
    expect(models[1].capabilities).toContain('insert')
  })

  it('returns an empty list when the daemon has no model pulled', async () => {
    stubCatalog({ models: [] }, {})

    expect(await ollamaModels({})).toEqual([])
  })

  it('survives a tags payload with no models field at all', async () => {
    stubCatalog({}, {})

    expect(await ollamaModels({})).toEqual([])
  })

  it('throws UpstreamError when the daemon answers non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 }))
    )

    await expect(ollamaModels({})).rejects.toBeInstanceOf(UpstreamError)
  })
})

describe('ollamaChat', () => {
  it('assembles content across chunks and forwards each piece to onChunk', async () => {
    stubChatStream([
      '{"message":{"content":"Olá"},"done":false}\n',
      '{"message":{"content":", mundo"},"done":true}\n'
    ])
    const seen: string[] = []

    const result = await ollamaChat(messages, { model: 'gemma3:4b', onChunk: (t) => seen.push(t) })

    expect(result.content).toBe('Olá, mundo')
    expect(seen).toEqual(['Olá', ', mundo'])
  })

  it('handles a JSON line split across two socket reads', async () => {
    stubChatStream(['{"message":{"content":"Ol', 'á"},"done":true}\n'])

    const result = await ollamaChat(messages, { model: 'gemma3:4b' })

    expect(result.content).toBe('Olá')
  })

  it('carries the token counters from the final line of the stream', async () => {
    // The line was already being read to detect `done`; its counters were being
    // dropped. prompt_eval_count is the only exact token count that exists —
    // there is no tokenizing before sending — so this is what calibrates the
    // meter and what makes silent truncation detectable at all.
    stubChatStream([
      '{"message":{"content":"ok"},"done":false}\n',
      '{"message":{"content":""},"done":true,"prompt_eval_count":1850,"eval_count":42}\n'
    ])

    const result = await ollamaChat(messages, { model: 'gemma3:4b' })

    expect(result).toEqual({ content: 'ok', promptTokens: 1850, evalTokens: 42 })
  })

  it('omits the counters rather than reporting zero when they are absent', async () => {
    // A cloud provider may not report them, and the contract says their absence
    // must not break anything. Zero would be a lie the meter would act on.
    stubChatStream(['{"message":{"content":"ok"},"done":true}\n'])

    const result = await ollamaChat(messages, { model: 'gemma3:4b' })

    expect(result).toEqual({ content: 'ok' })
    expect('promptTokens' in result).toBe(false)
  })

  it('sends num_ctx in options only when it is defined', async () => {
    // Same reason already recorded for num_thread: an options object carrying a
    // zero default would push that default onto the runner.
    const withCtx = stubChatStream(['{"message":{"content":"x"},"done":true}\n'])
    await ollamaChat(messages, { model: 'gemma3:4b', numCtx: 32768, numThread: 4 })
    expect(requestBody(withCtx).options).toEqual({ num_thread: 4, num_ctx: 32768 })

    vi.unstubAllGlobals()
    const without = stubChatStream(['{"message":{"content":"x"},"done":true}\n'])
    await ollamaChat(messages, { model: 'gemma3:4b' })
    expect(requestBody(without)).not.toHaveProperty('options')
  })

  it('sends options.num_thread only when numThread is provided', async () => {
    const withCap = stubChatStream(['{"message":{"content":"x"},"done":true}\n'])
    await ollamaChat(messages, { model: 'gemma3:4b', numThread: 4 })
    expect(requestBody(withCap).options).toEqual({ num_thread: 4 })

    vi.unstubAllGlobals()

    const withoutCap = stubChatStream(['{"message":{"content":"x"},"done":true}\n'])
    await ollamaChat(messages, { model: 'gemma3:4b' })
    expect(requestBody(withoutCap).options).toBeUndefined()
  })

  it('throws UpstreamError with a null status on a mid-stream error line', async () => {
    stubChatStream([
      '{"message":{"content":"x"},"done":false}\n',
      '{"error":"model runner crashed"}\n'
    ])

    await expect(ollamaChat(messages, { model: 'gemma3:4b' })).rejects.toMatchObject({
      name: 'UpstreamError',
      status: null,
      message: 'model runner crashed'
    })
  })

  it('throws UpstreamError with the HTTP status on a non-ok response', async () => {
    stubChatStream(['ignored'], { ok: false, status: 404 })

    await expect(ollamaChat(messages, { model: 'ghost' })).rejects.toBeInstanceOf(UpstreamError)
  })
})

describe('ollamaProbe', () => {
  it('resolves with the reported version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ version: '0.5.1' }) }))
    )

    await expect(ollamaProbe({})).resolves.toBe('0.5.1')
  })

  it('throws UpstreamError when the service answers non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    )

    await expect(ollamaProbe({})).rejects.toBeInstanceOf(UpstreamError)
  })
})
