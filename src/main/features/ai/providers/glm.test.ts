import { afterEach, vi } from 'vitest'
import type { ChatMessage } from '@shared/ipc'
import { UpstreamError } from '@core/ai/types'
import { makeGlmChat, makeGlmProbe } from './glm'

const messages: ChatMessage[] = [{ role: 'user', content: 'oi' }]

// Same discipline as ollama.test.ts's stubChatStream: pieces are enqueued
// verbatim, so splitting an SSE line across two proves the cross-chunk
// buffering, not just the happy path.
function stubStream(
  pieces: string[],
  init?: { ok?: boolean; status?: number; errorBody?: string }
): ReturnType<typeof vi.fn> {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece))
      controller.close()
    }
  })
  const fetchMock = vi.fn(async () => ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    body,
    text: async () => init?.errorBody ?? ''
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function requestHeaders(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
  const init = (fetchMock.mock.calls[0] as unknown[])[1] as { headers: Record<string, string> }
  return init.headers
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = (fetchMock.mock.calls[0] as unknown[])[1] as { body: string }
  return JSON.parse(init.body)
}

afterEach(() => vi.unstubAllGlobals())

describe('makeGlmProbe', () => {
  it('resolves without calling fetch when a key is stored', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(makeGlmProbe(() => true)({})).resolves.toBe('glm-4.7-flash')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws without calling fetch when no key is stored', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(makeGlmProbe(() => false)({})).rejects.toBeInstanceOf(UpstreamError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('makeGlmChat', () => {
  const chat = makeGlmChat(() => 'sk-test')

  it('throws without calling fetch when no key is stored', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const noKeyChat = makeGlmChat(() => null)

    await expect(noKeyChat(messages, { model: 'glm-4.7-flash' })).rejects.toBeInstanceOf(
      UpstreamError
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the bearer header and the model the caller passed, never a literal', async () => {
    const fetchMock = stubStream([
      'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
    ])

    await chat(messages, { model: 'glm-4.7-flash' })

    expect(requestHeaders(fetchMock).authorization).toBe('Bearer sk-test')
    expect(requestBody(fetchMock).model).toBe('glm-4.7-flash')
    expect(requestBody(fetchMock).thinking).toEqual({ type: 'disabled' })
  })

  it('sends thinking: enabled when onThinking is given', async () => {
    const fetchMock = stubStream([
      'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
    ])

    await chat(messages, { model: 'glm-4.7-flash', onThinking: () => {} })

    expect(requestBody(fetchMock).thinking).toEqual({ type: 'enabled' })
  })

  it('forwards delta.reasoning_content to onThinking, separately from onChunk', async () => {
    stubStream([
      'data: {"choices":[{"delta":{"reasoning_content":"Pensando"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Pronto"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n'
    ])
    const reasoning: string[] = []
    const content: string[] = []

    const result = await chat(messages, {
      model: 'glm-4.7-flash',
      onThinking: (t) => reasoning.push(t),
      onChunk: (t) => content.push(t)
    })

    expect(reasoning).toEqual(['Pensando'])
    expect(content).toEqual(['Pronto'])
    expect(result).toMatchObject({ content: 'Pronto', reasoning: 'Pensando' })
  })

  it('omits reasoning from the result when the model never sent reasoning_content', async () => {
    stubStream([
      'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
    ])

    const result = await chat(messages, { model: 'glm-4.7-flash', onThinking: () => {} })

    expect('reasoning' in result).toBe(false)
  })

  it('assembles content across SSE chunks and forwards each piece to onChunk', async () => {
    stubStream([
      'data: {"choices":[{"delta":{"content":"Olá"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{"content":", mundo"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n'
    ])
    const seen: string[] = []

    const result = await chat(messages, { model: 'glm-4.7-flash', onChunk: (t) => seen.push(t) })

    expect(result.content).toBe('Olá, mundo')
    expect(seen).toEqual(['Olá', ', mundo'])
  })

  it('handles an SSE line split across two socket reads', async () => {
    stubStream([
      'data: {"choices":[{"delta":{"content":"Ol',
      'á"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
    ])

    const result = await chat(messages, { model: 'glm-4.7-flash' })

    expect(result.content).toBe('Olá')
  })

  it('reads usage from the final chunk, alongside finish_reason', async () => {
    stubStream([
      'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"finish_reason":"stop","delta":{"role":"assistant","content":""}}],"usage":{"prompt_tokens":8,"completion_tokens":262,"total_tokens":270}}\n\n',
      'data: [DONE]\n\n'
    ])

    const result = await chat(messages, { model: 'glm-4.7-flash' })

    expect(result).toEqual({ content: 'ok', promptTokens: 8, evalTokens: 262 })
  })

  it('omits the counters rather than reporting zero when usage never arrives', async () => {
    stubStream([
      'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
    ])

    const result = await chat(messages, { model: 'glm-4.7-flash' })

    expect(result).toEqual({ content: 'ok' })
    expect('promptTokens' in result).toBe(false)
  })

  it('marks a reply that stopped because the window filled up (21-C-B)', async () => {
    stubStream([
      'data: {"choices":[{"delta":{"content":"parcial"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'
    ])

    const result = await chat(messages, { model: 'glm-4.7-flash' })

    expect(result).toEqual({ content: 'parcial', stopped: 'context-exhausted' })
  })

  it('does not mark a reply that finished on its own', async () => {
    stubStream([
      'data: {"choices":[{"delta":{"content":"pronto"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
    ])

    const result = await chat(messages, { model: 'glm-4.7-flash' })

    expect('stopped' in result).toBe(false)
  })

  it('throws UpstreamError on a non-2xx response', async () => {
    stubStream([], { ok: false, status: 401 })

    await expect(chat(messages, { model: 'glm-4.7-flash' })).rejects.toBeInstanceOf(UpstreamError)
  })

  it('logs the raw body to the console and throws a short classified message (N-1-B follow-up)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubStream([], {
      ok: false,
      status: 401,
      errorBody: '{"error":{"message":"invalid api key"}}'
    })

    await expect(chat(messages, { model: 'glm-4.7-flash' })).rejects.toMatchObject({
      status: 401,
      message: 'Chave de acesso ausente ou inválida (HTTP 401 Unauthorized).'
    })
    expect(consoleSpy).toHaveBeenCalledWith(
      '[glm] HTTP 401',
      '{"error":{"message":"invalid api key"}}'
    )

    consoleSpy.mockRestore()
  })
})
