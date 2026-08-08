import type { ChatMessage, ChatReply, Result } from '@shared/ipc'
import { ok, err } from '../result'
import type { ChatFn } from './types'

// Pure orchestration around the injected network seam. Owns only the cancelled
// short-circuit — domain logic, not infrastructure. HTTP and network failures
// thrown by ChatFn propagate to the main handler, which alone can classify them
// (upstream vs unavailable vs timeout), mirroring how scanDelimited leaves fs
// errors for scanDataset to map.
export async function runChat(
  chat: ChatFn,
  request: { messages: ChatMessage[]; model: string; numThread?: number },
  opts: { signal?: AbortSignal; onChunk?: (text: string) => void } = {}
): Promise<Result<ChatReply>> {
  if (opts.signal?.aborted) return err({ kind: 'cancelled' })

  const content = await chat(request.messages, {
    model: request.model,
    numThread: request.numThread,
    signal: opts.signal,
    onChunk: opts.onChunk
  })

  if (opts.signal?.aborted) return err({ kind: 'cancelled' })
  return ok({ content })
}
