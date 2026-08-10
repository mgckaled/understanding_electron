import type { ChatMessage } from '@shared/ipc'
import { runChat } from './chat'
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
