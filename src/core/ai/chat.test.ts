import { z } from 'zod'
import type { ChatMessage } from '@shared/ipc'
import { runChat, runStructuredChat } from './chat'
import type { ChatFn } from './types'

const messages: ChatMessage[] = [{ role: 'user', content: 'oi' }]

describe('runChat', () => {
  it('streams chunks and resolves with the assembled reply', async () => {
    const seen: string[] = []
    const chat: ChatFn = async (_messages, opts) => {
      opts.onChunk?.('Olá')
      opts.onChunk?.(', mundo')
      return { content: 'Olá, mundo' }
    }

    const result = await runChat(
      chat,
      { messages, model: 'llama3.2' },
      { onChunk: (t) => seen.push(t) }
    )

    expect(result).toEqual({ ok: true, value: { content: 'Olá, mundo' } })
    expect(seen).toEqual(['Olá', ', mundo'])
  })

  it('forwards model, messages and numThread to the chat fn', async () => {
    const chat = vi.fn<ChatFn>(async () => ({ content: 'ok' }))

    await runChat(chat, { messages, model: 'qwen3', numThread: 4 })

    expect(chat).toHaveBeenCalledWith(
      messages,
      expect.objectContaining({ model: 'qwen3', numThread: 4 })
    )
  })

  it('short-circuits to cancelled when the signal is already aborted', async () => {
    const chat = vi.fn<ChatFn>(async () => ({ content: 'never' }))

    const result = await runChat(
      chat,
      { messages, model: 'llama3.2' },
      { signal: AbortSignal.abort() }
    )

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
    expect(chat).not.toHaveBeenCalled()
  })

  it('reports cancelled when the signal aborts during the call', async () => {
    const controller = new AbortController()
    const chat: ChatFn = async () => {
      controller.abort()
      return { content: 'partial' }
    }

    const result = await runChat(
      chat,
      { messages, model: 'llama3.2' },
      { signal: controller.signal }
    )

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
  })

  it('lets provider errors propagate for the handler to classify', async () => {
    const chat: ChatFn = async () => {
      throw new Error('ECONNREFUSED')
    }

    await expect(runChat(chat, { messages, model: 'llama3.2' })).rejects.toThrow('ECONNREFUSED')
  })
})

describe('runStructuredChat', () => {
  const schema = z.object({ kind: z.literal('ok'), value: z.number() })
  const jsonSchema = z.toJSONSchema(schema)

  it('passes the JSON schema as format and parses a valid reply', async () => {
    const chat = vi.fn<ChatFn>(async () => ({ content: '{"kind":"ok","value":42}' }))

    const result = await runStructuredChat(chat, schema, jsonSchema, {
      messages,
      model: 'gemma3:4b'
    })

    expect(result).toEqual({ ok: true, value: { kind: 'ok', value: 42 } })
    expect(chat).toHaveBeenCalledWith(messages, expect.objectContaining({ format: jsonSchema }))
    // D19.5: no onChunk for this call — the reply is not usefully streamed.
    expect(chat.mock.calls[0]?.[1].onChunk).toBeUndefined()
  })

  it('reports invalidProposal when the reply is not JSON', async () => {
    const chat: ChatFn = async () => ({ content: 'not json at all' })

    const result = await runStructuredChat(chat, schema, jsonSchema, {
      messages,
      model: 'gemma3:4b'
    })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('invalidProposal')
  })

  it('reports invalidProposal when the reply is JSON but fails the schema', async () => {
    const chat: ChatFn = async () => ({ content: '{"kind":"wrong"}' })

    const result = await runStructuredChat(chat, schema, jsonSchema, {
      messages,
      model: 'gemma3:4b'
    })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('invalidProposal')
  })

  it('short-circuits to cancelled when the signal is already aborted', async () => {
    const chat = vi.fn<ChatFn>(async () => ({ content: '{"kind":"ok","value":1}' }))

    const result = await runStructuredChat(
      chat,
      schema,
      jsonSchema,
      { messages, model: 'gemma3:4b' },
      { signal: AbortSignal.abort() }
    )

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
    expect(chat).not.toHaveBeenCalled()
  })
})
