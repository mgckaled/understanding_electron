import type { ChatFn } from '@core/ai/types'
import { measureChatTiming } from './chatTiming'

const request = { messages: [{ role: 'user' as const, content: 'oi' }], model: 'gemma3:4b' }

describe('measureChatTiming', () => {
  it('reports timing when a chunk streams and evalTokens comes back', async () => {
    const chatFn: ChatFn = async (_messages, { onChunk }) => {
      onChunk?.('olá')
      return { content: 'olá', evalTokens: 5 }
    }

    const { result, timing } = await measureChatTiming(chatFn, request)

    expect(result).toEqual({ ok: true, value: { content: 'olá', evalTokens: 5 } })
    expect(timing).not.toBeNull()
    expect(timing?.evalTokens).toBe(5)
    expect(timing?.ttftMs).toBeGreaterThanOrEqual(0)
    expect(timing?.decodeMs).toBeGreaterThanOrEqual(0)
  })

  it('carries the Ollama-only native fields through when the reply has them', async () => {
    const chatFn: ChatFn = async (_messages, { onChunk }) => {
      onChunk?.('oi')
      return {
        content: 'oi',
        evalTokens: 10,
        loadDurationMs: 48_000,
        promptEvalDurationMs: 80,
        nativeEvalDurationMs: 900
      }
    }

    const { timing } = await measureChatTiming(chatFn, request)

    expect(timing).toMatchObject({
      loadDurationMs: 48_000,
      promptEvalDurationMs: 80,
      nativeEvalDurationMs: 900
    })
  })

  it('is null when no chunk ever streams — a format-constrained call never calls onChunk', async () => {
    const chatFn: ChatFn = async () => ({ content: '{"ok":true}', evalTokens: 5 })

    const { timing } = await measureChatTiming(chatFn, request)

    expect(timing).toBeNull()
  })

  it('is null when evalTokens never arrives — cancelled, timed out or failed mid-stream', async () => {
    const chatFn: ChatFn = async (_messages, { onChunk }) => {
      onChunk?.('parte')
      return { content: 'parte' }
    }

    const { timing } = await measureChatTiming(chatFn, request)

    expect(timing).toBeNull()
  })

  it('is null when the call resolves to a cancelled Result', async () => {
    const chatFn: ChatFn = async (_messages, { signal }) => {
      if (signal?.aborted) throw new Error('aborted')
      return { content: 'x', evalTokens: 1 }
    }
    const controller = new AbortController()
    controller.abort()

    const { result, timing } = await measureChatTiming(chatFn, request, {
      signal: controller.signal
    })

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
    expect(timing).toBeNull()
  })
})
