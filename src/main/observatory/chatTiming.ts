import type { ChatMessage, ChatReply, Result } from '@shared/ipc'
import type { ChatFn } from '@core/ai/types'
import { runChat } from '@core/ai/chat'
import type { PerformanceEvent } from '@core/observatory/performance'

export type ChatTiming = Pick<
  PerformanceEvent,
  | 'promptTokens'
  | 'evalTokens'
  | 'ttftMs'
  | 'decodeMs'
  | 'loadDurationMs'
  | 'promptEvalDurationMs'
  | 'nativeEvalDurationMs'
>

/**
 * Wraps `runChat` with three wall-clock marks (O-7, § 9.2): before the call,
 * at the first streamed chunk, and at resolution. `timing` is `null` whenever
 * no chunk arrived (a `format`-constrained call never streams) or the reply
 * carries no `evalTokens` (cancelled, timed out, failed) — never a
 * fabricated zero duration.
 */
export async function measureChatTiming(
  chatFn: ChatFn,
  request: { messages: ChatMessage[]; model: string; numThread?: number; numCtx?: number },
  opts: {
    signal?: AbortSignal
    onChunk?: (text: string) => void
    onThinking?: (text: string) => void
  } = {}
): Promise<{ result: Result<ChatReply>; timing: ChatTiming | null }> {
  const t0 = performance.now()
  // TTFT marks the first CONTENT chunk only, never a reasoning one (arco 21):
  // with the toggle on, the whole reasoning phase counts as part of TTFT —
  // decided, not accidental. Splitting the two is O-9's question, not this
  // function's.
  let t1: number | null = null

  const result = await runChat(chatFn, request, {
    signal: opts.signal,
    onChunk: (text) => {
      if (t1 === null) t1 = performance.now()
      opts.onChunk?.(text)
    },
    onThinking: opts.onThinking
  })

  if (t1 === null || !result.ok || result.value.evalTokens === undefined) {
    return { result, timing: null }
  }

  const t2 = performance.now()
  const { promptTokens, evalTokens, loadDurationMs, promptEvalDurationMs, nativeEvalDurationMs } =
    result.value
  return {
    result,
    timing: {
      evalTokens,
      ttftMs: t1 - t0,
      decodeMs: t2 - t1,
      ...(promptTokens === undefined ? {} : { promptTokens }),
      ...(loadDurationMs === undefined ? {} : { loadDurationMs }),
      ...(promptEvalDurationMs === undefined ? {} : { promptEvalDurationMs }),
      ...(nativeEvalDurationMs === undefined ? {} : { nativeEvalDurationMs })
    }
  }
}
