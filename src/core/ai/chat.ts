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
  opts: { signal?: AbortSignal; onChunk?: (text: string) => void } = {}
): Promise<Result<ChatReply>> {
  if (opts.signal?.aborted) return err({ kind: 'cancelled' })

  const reply = await chat(request.messages, {
    model: request.model,
    numThread: request.numThread,
    numCtx: request.numCtx,
    signal: opts.signal,
    onChunk: opts.onChunk
  })

  if (opts.signal?.aborted) return err({ kind: 'cancelled' })
  return ok(reply)
}
