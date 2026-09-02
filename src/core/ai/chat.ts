import type { z } from 'zod'
import type { ChatMessage, ChatReply, Result } from '@shared/ipc'
import { ok, err } from '../result'
import type { ChatFn } from './types'

// Pure orchestration around the injected network seam: owns only the cancelled
// short-circuit. HTTP and network failures thrown by ChatFn propagate to the
// main handler, which alone can classify them (upstream vs unavailable vs
// timeout).
export async function runChat(
  chat: ChatFn,
  request: { messages: ChatMessage[]; model: string; numThread?: number; numCtx?: number },
  opts: {
    signal?: AbortSignal
    onChunk?: (text: string) => void
    onThinking?: (text: string) => void
  } = {}
): Promise<Result<ChatReply>> {
  if (opts.signal?.aborted) return err({ kind: 'cancelled' })

  const reply = await chat(request.messages, {
    model: request.model,
    numThread: request.numThread,
    numCtx: request.numCtx,
    signal: opts.signal,
    onChunk: opts.onChunk,
    onThinking: opts.onThinking
  })

  if (opts.signal?.aborted) return err({ kind: 'cancelled' })
  return ok(reply)
}

/**
 * Same shape as `runChat`, constrained to a schema-shaped reply (D19.3): no
 * `onChunk` (D19.5 — a schema-constrained reply is not usefully consumed a
 * token at a time), and the reply is JSON.parsed then `.parse()`d against
 * `schema` before it comes back — `jsonSchema` and `schema` must describe
 * the same shape, since one constrains generation and the other validates
 * it. A reply that fails either step returns `invalidProposal`, never
 * throws: a model producing malformed structured output is an expected
 * failure the caller reacts to, not a bug.
 */
export async function runStructuredChat<T>(
  chat: ChatFn,
  schema: z.ZodType<T>,
  jsonSchema: Record<string, unknown>,
  request: { messages: ChatMessage[]; model: string; numThread?: number; numCtx?: number },
  opts: { signal?: AbortSignal } = {}
): Promise<Result<T>> {
  if (opts.signal?.aborted) return err({ kind: 'cancelled' })

  const reply = await chat(request.messages, {
    model: request.model,
    numThread: request.numThread,
    numCtx: request.numCtx,
    signal: opts.signal,
    format: jsonSchema
  })

  if (opts.signal?.aborted) return err({ kind: 'cancelled' })

  let content: unknown
  try {
    content = JSON.parse(reply.content)
  } catch (error) {
    return err({
      kind: 'invalidProposal',
      message: `Resposta não é JSON válido: ${(error as Error).message}`
    })
  }

  const parsed = schema.safeParse(content)
  if (!parsed.success) {
    return err({
      kind: 'invalidProposal',
      message: `Resposta fora do schema: ${parsed.error.message}`
    })
  }
  return ok(parsed.data)
}
