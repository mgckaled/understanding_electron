import { afterEach, vi } from 'vitest'
import type { ChatMessage } from '@shared/ipc'
import { UpstreamError } from '@core/ai/types'
import { makeGeminiChat, makeGeminiProbe } from './gemini'

const messages: ChatMessage[] = [{ role: 'user', content: 'oi' }]

function sse(events: Record<string, unknown>[]): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
}

function modelOutput(index: number, text: string): Record<string, unknown> {
  return {
    event_type: 'step.start',
    index,
    step: { type: 'model_output', content: [{ type: 'text', text }] }
  }
}

// Same discipline as glm.test.ts's stubStream — pieces enqueued verbatim, so
// splitting a line across two proves the cross-chunk buffering.
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

describe('makeGeminiChat — request shape', () => {
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

  it('posts to the Interactions endpoint, not the legacy streamGenerateContent one', async () => {
    const fetchMock = stubStream([sse([modelOutput(0, 'ok')])])

    await chat(messages, { model: 'gemini-3.7-flash' })

    expect(requestUrl(fetchMock)).toBe(
      'https://generativelanguage.googleapis.com/v1beta/interactions'
    )
    expect(requestHeaders(fetchMock)['x-goog-api-key']).toBe('test-key')
    expect(requestHeaders(fetchMock).authorization).toBeUndefined()
  })

  it('sends model, store: false, and stream: true at the top level', async () => {
    const fetchMock = stubStream([sse([modelOutput(0, 'ok')])])

    await chat(messages, { model: 'gemini-3.7-flash' })

    const body = requestBody(fetchMock)
    expect(body.model).toBe('gemini-3.7-flash')
    expect(body.store).toBe(false)
    expect(body.stream).toBe(true)
  })

  it('sends thinking_summaries: none and keeps thinking_level low without onThinking (D21D.3.1)', async () => {
    const fetchMock = stubStream([sse([modelOutput(0, 'ok')])])

    await chat(messages, { model: 'gemini-3.7-flash' })

    expect(requestBody(fetchMock).generation_config).toEqual({
      thinking_level: 'low',
      thinking_summaries: 'none'
    })
  })

  it('switches thinking_summaries to auto, but keeps thinking_level low, when onThinking is given', async () => {
    const fetchMock = stubStream([sse([modelOutput(0, 'ok')])])

    await chat(messages, { model: 'gemini-3.7-flash', onThinking: () => {} })

    expect(requestBody(fetchMock).generation_config).toEqual({
      thinking_level: 'low',
      thinking_summaries: 'auto'
    })
  })

  it('maps user/assistant messages to user_input/model_output entries, dropping system into system_instruction', async () => {
    const fetchMock = stubStream([sse([modelOutput(0, 'ok')])])
    const history: ChatMessage[] = [
      { role: 'system', content: 'Seja breve.' },
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: 'olá' },
      { role: 'user', content: 'tudo bem?' }
    ]

    await chat(history, { model: 'gemini-3.7-flash' })

    const body = requestBody(fetchMock)
    expect(body.system_instruction).toBe('Seja breve.')
    expect(body.input).toEqual([
      { type: 'user_input', content: [{ type: 'text', text: 'oi' }] },
      { type: 'model_output', content: [{ type: 'text', text: 'olá' }] },
      { type: 'user_input', content: [{ type: 'text', text: 'tudo bem?' }] }
    ])
  })

  it('omits system_instruction when there is no system message', async () => {
    const fetchMock = stubStream([sse([modelOutput(0, 'ok')])])

    await chat(messages, { model: 'gemini-3.7-flash' })

    expect('system_instruction' in requestBody(fetchMock)).toBe(false)
  })

  it('sends an image entry as type: image, sniffing PNG from the base64 bytes', async () => {
    const fetchMock = stubStream([sse([modelOutput(0, 'ok')])])
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')
    const withImage: ChatMessage[] = [{ role: 'user', content: 'o que é isso?', images: [png] }]

    await chat(withImage, { model: 'gemini-3.7-flash' })

    expect(requestBody(fetchMock).input).toEqual([
      {
        type: 'user_input',
        content: [
          { type: 'image', mime_type: 'image/png', data: png },
          { type: 'text', text: 'o que é isso?' }
        ]
      }
    ])
  })

  it('sniffs JPEG from the base64 bytes too, not just PNG', async () => {
    const fetchMock = stubStream([sse([modelOutput(0, 'ok')])])
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64')
    const withImage: ChatMessage[] = [{ role: 'user', content: 'e essa?', images: [jpeg] }]

    await chat(withImage, { model: 'gemini-3.7-flash' })

    const input = requestBody(fetchMock).input as { content: { mime_type?: string }[] }[]
    expect(input[0]?.content[0]?.mime_type).toBe('image/jpeg')
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

describe('makeGeminiChat — step.start/step.delta parsing', () => {
  const chat = makeGeminiChat(() => 'test-key')

  it('assembles model_output content across step.delta chunks and forwards each piece to onChunk', async () => {
    stubStream([
      sse([
        {
          event_type: 'step.start',
          index: 0,
          step: { type: 'model_output', content: [{ type: 'text', text: 'Olá' }] }
        },
        { event_type: 'step.delta', index: 0, delta: { text: ', mundo' } }
      ])
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
    const whole = sse([modelOutput(0, 'Olá')])
    const cut = Math.floor(whole.length / 2)
    stubStream([whole.slice(0, cut), whole.slice(cut)])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result.content).toBe('Olá')
  })

  it('separates a thought step summary into onThinking, and a model_output step into onChunk', async () => {
    stubStream([
      sse([
        {
          event_type: 'step.start',
          index: 0,
          step: { type: 'thought', signature: '', summary: [{ text: 'Pensando' }] }
        },
        {
          event_type: 'step.delta',
          index: 0,
          delta: { type: 'thought_signature', signature: 'sig-abc' }
        },
        modelOutput(1, 'Pronto')
      ])
    ])
    const reasoning: string[] = []
    const content: string[] = []

    const result = await chat(messages, {
      model: 'gemini-3.7-flash',
      onThinking: (t) => reasoning.push(t),
      onChunk: (t) => content.push(t)
    })

    expect(reasoning).toEqual(['Pensando'])
    expect(content).toEqual(['Pronto'])
    expect(result).toMatchObject({ content: 'Pronto', reasoning: 'Pensando' })
  })

  it('assembles the thought summary across step.delta events too, not just at step.start', async () => {
    stubStream([
      sse([
        {
          event_type: 'step.start',
          index: 0,
          step: { type: 'thought', signature: '', summary: [] }
        },
        { event_type: 'step.delta', index: 0, delta: { type: 'thought_summary', text: 'Pen' } },
        { event_type: 'step.delta', index: 0, delta: { type: 'thought_summary', text: 'sando' } },
        {
          event_type: 'step.delta',
          index: 0,
          delta: { type: 'thought_signature', signature: 'sig-abc' }
        },
        modelOutput(1, 'Pronto')
      ])
    ])
    const reasoning: string[] = []

    const result = await chat(messages, {
      model: 'gemini-3.7-flash',
      onThinking: (t) => reasoning.push(t)
    })

    expect(reasoning).toEqual(['Pen', 'sando'])
    expect(result.reasoning).toBe('Pensando')
  })

  it('reads a thought_summary delta wrapped in content: {text, type} — the shape confirmed live, not a bare text field', async () => {
    stubStream([
      sse([
        { event_type: 'step.start', index: 0, step: { type: 'thought' } },
        {
          event_type: 'step.delta',
          index: 0,
          delta: { type: 'thought_summary', content: { text: 'Analisando a imagem', type: 'text' } }
        },
        modelOutput(1, 'Pronto')
      ])
    ])
    const reasoning: string[] = []

    const result = await chat(messages, {
      model: 'gemini-3.7-flash',
      onThinking: (t) => reasoning.push(t)
    })

    expect(reasoning).toEqual(['Analisando a imagem'])
    expect(result.reasoning).toBe('Analisando a imagem')
  })

  it('preserves the order of multiple thought steps interleaved with a model_output step (D21D.5.1)', async () => {
    stubStream([
      sse([
        {
          event_type: 'step.start',
          index: 0,
          step: { type: 'thought', signature: 'sig-1', summary: [{ text: 'Primeiro' }] }
        },
        {
          event_type: 'step.start',
          index: 1,
          step: { type: 'thought', signature: 'sig-2', summary: [{ text: 'Segundo' }] }
        },
        modelOutput(2, 'Pronto')
      ])
    ])
    const reasoning: string[] = []

    const result = await chat(messages, {
      model: 'gemini-3.7-flash',
      onThinking: (t) => reasoning.push(t)
    })

    expect(reasoning).toEqual(['Primeiro', 'Segundo'])
    expect(result.reasoning).toBe('PrimeiroSegundo')
    expect(result.content).toBe('Pronto')
  })

  it('omits reasoning from the result when no thought step ever appears', async () => {
    stubStream([sse([modelOutput(0, 'ok')])])

    const result = await chat(messages, { model: 'gemini-3.7-flash', onThinking: () => {} })

    expect('reasoning' in result).toBe(false)
  })

  it('reads usage from an interaction.completed event, nested and named differently than status_update (confirmed live, D21D.1)', async () => {
    stubStream([
      sse([
        modelOutput(0, 'ok'),
        {
          event_type: 'interaction.completed',
          interaction: {
            status: 'completed',
            usage: { total_input_tokens: 8, total_output_tokens: 3 }
          }
        }
      ])
    ])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result).toMatchObject({ content: 'ok', promptTokens: 8, evalTokens: 3 })
  })

  it('omits the counters rather than reporting zero when no usage_metadata ever arrives', async () => {
    stubStream([sse([modelOutput(0, 'ok')])])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result).toEqual({ content: 'ok' })
    expect('promptTokens' in result).toBe(false)
  })

  it('maps status: incomplete to context-exhausted (D21D.1)', async () => {
    stubStream([
      sse([
        modelOutput(0, 'parcial'),
        { event_type: 'interaction.status_update', status: 'incomplete' }
      ])
    ])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result).toMatchObject({ content: 'parcial', stopped: 'context-exhausted' })
  })

  it('does not mark a reply that finished with status: completed', async () => {
    stubStream([
      sse([
        modelOutput(0, 'pronto'),
        { event_type: 'interaction.status_update', status: 'completed' }
      ])
    ])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect('stopped' in result).toBe(false)
  })

  it('logs status: budget_exceeded but still returns content that already arrived, never collapsing it into context-exhausted (D21D.1)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubStream([
      sse([
        modelOutput(0, 'parcial'),
        { event_type: 'interaction.status_update', status: 'budget_exceeded' }
      ])
    ])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result.content).toBe('parcial')
    expect('stopped' in result).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith(
      '[gemini] budget_exceeded status seen — treating as upstream error, not context exhaustion'
    )

    consoleSpy.mockRestore()
  })
})

describe('makeGeminiChat — contract guard (D21D.3, D21D.5)', () => {
  const chat = makeGeminiChat(() => 'test-key')

  it('grau 1: an unknown step type is logged and ignored, the turn still completes', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubStream([
      sse([
        { event_type: 'step.start', index: 0, step: { type: 'code_execution_call' } },
        modelOutput(1, 'ok')
      ])
    ])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result.content).toBe('ok')
    expect(consoleSpy).toHaveBeenCalledWith(
      '[gemini] unknown step type: code_execution_call, ignoring'
    )

    consoleSpy.mockRestore()
  })

  it('recognizes step.stop as expected noise, no diagnostic log (confirmed live, closes a step explicitly)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubStream([
      sse([
        {
          event_type: 'step.start',
          index: 0,
          step: { type: 'model_output', content: [{ type: 'text', text: 'ok' }] }
        },
        { event_type: 'step.stop', index: 0 }
      ])
    ])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result.content).toBe('ok')
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('unrecognized event_type'))

    consoleSpy.mockRestore()
  })

  it('grau 1: a non-JSON data line (a [DONE] sentinel, a keep-alive) is logged and ignored, never crashes the turn', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubStream([sse([modelOutput(0, 'ok')]) + 'data: [DONE]\n\n'])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result.content).toBe('ok')
    expect(consoleSpy).toHaveBeenCalledWith('[gemini] non-JSON data line, ignoring: [DONE]')

    consoleSpy.mockRestore()
  })

  it('grau 1: a step.delta for an unknown step index never surfaces as content or reasoning', async () => {
    stubStream([
      sse([
        { event_type: 'step.start', index: 0, step: { type: 'file_search_call' } },
        { event_type: 'step.delta', index: 0, delta: { text: 'should not appear' } },
        modelOutput(1, 'ok')
      ])
    ])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result.content).toBe('ok')
  })

  it('grau 2: throws a named UpstreamError when the response carries no steps at all — proven red first', async () => {
    // Red: sabotage by feeding an event stream with zero step.start events —
    // exactly what a reshaped contract (steps renamed again) would produce.
    stubStream([sse([{ event_type: 'interaction.status_update', status: 'completed' }])])

    await expect(chat(messages, { model: 'gemini-3.7-flash' })).rejects.toMatchObject({
      message: 'Formato de resposta inesperado — o contrato da Interactions API pode ter mudado.'
    })
  })

  it('grau 2: throws when a completed turn never produced a model_output step', async () => {
    stubStream([
      sse([
        {
          event_type: 'step.start',
          index: 0,
          step: { type: 'thought', signature: 'sig', summary: [] }
        }
      ])
    ])

    await expect(chat(messages, { model: 'gemini-3.7-flash' })).rejects.toMatchObject({
      message: 'Formato de resposta inesperado — o contrato da Interactions API pode ter mudado.'
    })
  })

  it('grau 1: a thought step closed without a signature still shows its text — only the signature is skipped, not fatal (D21D.3, 21-D-B consumes it later)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubStream([
      sse([
        {
          event_type: 'step.start',
          index: 0,
          step: { type: 'thought', signature: '', summary: [{ text: 'Pensando' }] }
        },
        modelOutput(1, 'ok')
      ])
    ])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result.content).toBe('ok')
    expect(result.reasoning).toBe('Pensando')
    expect(consoleSpy).toHaveBeenCalledWith('[gemini] thought step closed without a signature')

    consoleSpy.mockRestore()
  })

  it('grau 2: throws when a completed turn produced a model_output step with no text at all', async () => {
    stubStream([
      sse([{ event_type: 'step.start', index: 0, step: { type: 'model_output', content: [] } }])
    ])

    await expect(chat(messages, { model: 'gemini-3.7-flash' })).rejects.toMatchObject({
      message: 'Formato de resposta inesperado — o contrato da Interactions API pode ter mudado.'
    })
  })

  it('treats a mid-stream error object (HTTP 200, error in body) as an upstream error, not a shape mismatch', async () => {
    stubStream([sse([{ error: { message: 'quota exceeded' } }])])

    await expect(chat(messages, { model: 'gemini-3.7-flash' })).rejects.toMatchObject({
      status: null,
      message: 'quota exceeded'
    })
  })

  it('budget_exceeded still throws when nothing usable arrived before it', async () => {
    stubStream([sse([{ event_type: 'interaction.status_update', status: 'budget_exceeded' }])])

    await expect(chat(messages, { model: 'gemini-3.7-flash' })).rejects.toMatchObject({
      message:
        'A Interactions API sinalizou budget_exceeded antes de qualquer resposta utilizável chegar.'
    })
  })

  it('does not throw when a thought step receives its signature at step.start already (no delta needed)', async () => {
    stubStream([
      sse([
        {
          event_type: 'step.start',
          index: 0,
          step: { type: 'thought', signature: 'sig-immediate', summary: [{ text: 'Pensando' }] }
        },
        modelOutput(1, 'ok')
      ])
    ])

    const result = await chat(messages, { model: 'gemini-3.7-flash' })

    expect(result).toMatchObject({ content: 'ok', reasoning: 'Pensando' })
  })
})

describe('ai:propose against Gemini (D21D.4.1) — format is still ignored, no regression', () => {
  const chat = makeGeminiChat(() => 'test-key')

  it('returns loose model_output text even when the caller passes format and no onThinking', async () => {
    stubStream([sse([modelOutput(0, '{"steps":[]}')])])

    const result = await chat(messages, {
      model: 'gemini-3.7-flash',
      format: { type: 'object', properties: {} }
    })

    expect(result.content).toBe('{"steps":[]}')
    expect('reasoning' in result).toBe(false)
  })
})
