import { afterEach, vi } from 'vitest'
import type { ChatMessage } from '@shared/ipc'
import { UpstreamError } from '@core/ai/types'
import { ollamaChat, ollamaProbe } from './ollama'

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

describe('ollamaChat', () => {
  it('assembles content across chunks and forwards each piece to onChunk', async () => {
    stubChatStream([
      '{"message":{"content":"Olá"},"done":false}\n',
      '{"message":{"content":", mundo"},"done":true}\n'
    ])
    const seen: string[] = []

    const result = await ollamaChat(messages, { model: 'gemma3:4b', onChunk: (t) => seen.push(t) })

    expect(result).toBe('Olá, mundo')
    expect(seen).toEqual(['Olá', ', mundo'])
  })

  it('handles a JSON line split across two socket reads', async () => {
    stubChatStream(['{"message":{"content":"Ol', 'á"},"done":true}\n'])

    const result = await ollamaChat(messages, { model: 'gemma3:4b' })

    expect(result).toBe('Olá')
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
