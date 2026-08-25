import { afterEach, vi } from 'vitest'
import type { ChatMessage } from '@shared/ipc'
import { UpstreamError } from '@core/ai/types'
import { makeGeminiChat, makeGeminiProbe } from './gemini'

const messages: ChatMessage[] = [{ role: 'user', content: 'oi' }]

// Same discipline as glm.test.ts's stubStream — pieces enqueued verbatim, so
// splitting an SSE line across two proves the cross-chunk buffering.
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

function requestUrl(fetchMock: ReturnType<typeof vi.fn>): string {
  return (fetchMock.mock.calls[0] as unknown[])[0] as string
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

describe('makeGeminiProbe', () => {
  it('resolves without calling fetch when a key is stored', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(makeGeminiProbe(() => true)({})).resolves.toBe('gemini-3.7-flash')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws without calling fetch when no key is stored', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(makeGeminiProbe(() => false)({})).rejects.toBeInstanceOf(UpstreamError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('makeGeminiChat', () => {
  const chat = makeGeminiChat(() => 'test-key')

  it('throws without calling fetch when no key is stored', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const noKeyChat = makeGeminiChat(() => null)

    await expect(noKeyChat(messages, { model: 'gemini-3.7-flash' })).rejects.toBeInstanceOf(
      UpstreamError
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends x-goog-api-key, ?alt=sse, and the model the caller passed, never a literal', async () => {
    const fetchMock = stubStream([
      'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n'
    ])

    await chat(messages, { model: 'gemini-3.7-flash' })

    expect(requestUrl(fetchMock)).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:streamGenerateContent?alt=sse'
    )
    expect(requestHeaders(fetchMock)['x-goog-api-key']).toBe('test-key')
    expect(requestHeaders(fetchMock).authorization).toBeUndefined()
    expect(requestBody(fetchMock).generationConfig).toEqual({
      thinkingConfig: { thinkingLevel: 'low' }
    })
  })

  it('maps assistant to role "model" and drops system into systemInstruction', async () => {
    const fetchMock = stubStream([
      'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n'
    ])
    const history: ChatMessage[] = [
      { role: 'system', content: 'Seja breve.' },
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: 'olá' },
      { role: 'user', content: 'tudo bem?' }
    ]

    await chat(history, { model: 'gemini-3.7-flash' })

    const body = requestBody(fetchMock)
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'Seja breve.' }] })
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'oi' }] },
      { role: 'model', parts: [{ text: 'olá' }] },
      { role: 'user', parts: [{ text: 'tudo bem?' }] }
    ])
  })

  it('omits systemInstruction when there is no system message', async () => {
    const fetchMock = stubStream([
      'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n'
    ])

    await chat(messages, { model: 'gemini-3.7-flash' })

    expect('systemInstruction' in requestBody(fetchMock)).toBe(false)
  })

  it('assembles content across SSE chunks and forwards each piece to onChunk', async () => {
    stubStream([
      'data: {"candidates":[{"content":{"parts":[{"text":"Olá"}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":", mundo"}]}}]}\n\n'
    ])
    const seen: string[] = []

    const result = await chat(messages, {
      model: 'gemini-3.7-flash',
      onChunk: (t) => seen.push(t)
    })

    expect(result.content).toBe('Olá, mundo')
    expect(seen).toEqual(['Olá', ', mundo'])
  })

  it('handles an SSE line split across two socket reads', async () => {
    stubStream(['data: {"candidates":[{"content":{"parts":[{"text":"Ol', 'á"}]}}]}\n\n'])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result.content).toBe('Olá')
  })

  it('reads usageMetadata from whichever chunk carries it — no [DONE] sentinel in this shape', async () => {
    stubStream([
      'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}],"usageMetadata":{"promptTokenCount":8,"candidatesTokenCount":3}}\n\n'
    ])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result).toEqual({ content: 'ok', promptTokens: 8, evalTokens: 3 })
  })

  it('omits the counters rather than reporting zero when usageMetadata never arrives', async () => {
    stubStream(['data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n'])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result).toEqual({ content: 'ok' })
    expect('promptTokens' in result).toBe(false)
  })

  it('throws UpstreamError on a non-2xx response', async () => {
    stubStream([], { ok: false, status: 401 })

    await expect(chat(messages, { model: 'gemini-3.7-flash' })).rejects.toBeInstanceOf(
      UpstreamError
    )
  })

  it('logs the raw body to the console and throws a short classified message', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubStream([], {
      ok: false,
      status: 401,
      errorBody: '{"error":{"message":"API key not valid"}}'
    })

    await expect(chat(messages, { model: 'gemini-3.7-flash' })).rejects.toMatchObject({
      status: 401,
      message: 'Chave de acesso ausente ou inválida (HTTP 401 Unauthorized).'
    })
    expect(consoleSpy).toHaveBeenCalledWith(
      '[gemini] HTTP 401',
      '{"error":{"message":"API key not valid"}}'
    )

    consoleSpy.mockRestore()
  })
})
