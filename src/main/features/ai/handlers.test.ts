import { vi } from 'vitest'
import type { AiModel, ChatMessage, JobEvent } from '@shared/ipc'
import type { ChatFn, ModelsFn, ProbeFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import * as jobs from '../../jobs'
import { chat, isAvailable, models } from './handlers'

const messages: ChatMessage[] = [{ role: 'user', content: 'oi' }]

const gemma: AiModel = {
  provider: 'ollama',
  name: 'gemma3:4b',
  parameterSize: '4.3B',
  sizeBytes: 3_338_801_804,
  capabilities: ['completion', 'vision'],
  contextLength: 131072,
  attention: { blockCount: 34, headCountKv: 4, headDim: 256, slidingWindow: 1024 },
  variantOf: null
}

describe('isAvailable', () => {
  it('reports the version when the probe resolves', async () => {
    const probe: ProbeFn = async () => '0.5.1'

    const result = await isAvailable({ service: 'ollama' }, probe)

    expect(result).toEqual({ ok: true, value: { service: 'ollama', version: '0.5.1' } })
  })

  it('degrades to unavailable with a hint when the probe throws', async () => {
    const probe: ProbeFn = async () => {
      throw new Error('ECONNREFUSED')
    }

    const result = await isAvailable({ service: 'ollama' }, probe)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('unavailable')
      if (result.error.kind === 'unavailable') {
        expect(result.error.service).toBe('ollama')
        expect(result.error.hint).toContain('Ollama')
      }
    }
  })
})

describe('models', () => {
  it('passes the catalog through when the provider answers', async () => {
    const modelsFn: ModelsFn = async () => [gemma]

    expect(await models({ service: 'ollama' }, modelsFn)).toEqual({ ok: true, value: [gemma] })
  })

  it('degrades to unavailable with a hint when the provider cannot be reached', async () => {
    // Same shape as the availability gate on purpose: the selector draws an
    // empty state with an actionable hint, which is a state, not a defect.
    const modelsFn: ModelsFn = async () => {
      throw new TypeError('fetch failed')
    }

    const result = await models({ service: 'ollama' }, modelsFn)

    expect(result.ok).toBe(false)
    if (!result.ok && result.error.kind === 'unavailable') {
      expect(result.error.hint).toContain('Ollama')
    } else {
      expect.unreachable('expected an unavailable error')
    }
  })

  it('reports upstream when the provider answers with a status', async () => {
    const modelsFn: ModelsFn = async () => {
      throw new UpstreamError(500, 'HTTP 500')
    }

    const result = await models({ service: 'ollama' }, modelsFn)

    expect(result.ok).toBe(false)
    if (!result.ok && result.error.kind === 'upstream') {
      expect(result.error.status).toBe(500)
    } else {
      expect.unreachable('expected an upstream error')
    }
  })

  it('passes an abort signal so a wedged catalog cannot hang forever', async () => {
    let seen: AbortSignal | undefined
    const modelsFn: ModelsFn = async ({ signal }) => {
      seen = signal
      return []
    }

    await models({ service: 'ollama' }, modelsFn)

    expect(seen).toBeInstanceOf(AbortSignal)
  })

  it('returns an empty list rather than an error when no model is installed', async () => {
    // A fresh Ollama with nothing pulled is not a failure — it is a legitimate
    // empty state, and the selector says so instead of showing a red card.
    const modelsFn: ModelsFn = async () => []

    expect(await models({ service: 'ollama' }, modelsFn)).toEqual({ ok: true, value: [] })
  })
})

describe('chat', () => {
  it('streams chunk events and resolves with the assembled reply', async () => {
    const chatFn: ChatFn = async (_messages, opts) => {
      opts.onChunk?.('Olá')
      opts.onChunk?.('!')
      return { content: 'Olá!' }
    }
    const events: JobEvent[] = []

    const result = await chat(
      { service: 'ollama', model: 'llama3.2', messages, jobId: 'j1' },
      chatFn,
      (e) => events.push(e)
    )

    expect(result).toEqual({ ok: true, value: { content: 'Olá!' } })
    expect(events).toEqual([
      { jobId: 'j1', type: 'chunk', text: 'Olá' },
      { jobId: 'j1', type: 'chunk', text: '!' }
    ])
  })

  it('finishes the job even on success (no leaked AbortController)', async () => {
    const finish = vi.spyOn(jobs, 'finish')
    const chatFn: ChatFn = async () => ({ content: 'ok' })

    await chat({ service: 'ollama', model: 'llama3.2', messages, jobId: 'j2' }, chatFn, () => {})

    expect(finish).toHaveBeenCalledWith('j2')
    finish.mockRestore()
  })

  it('maps an UpstreamError to an upstream AppError', async () => {
    const chatFn: ChatFn = async () => {
      throw new UpstreamError(404, 'model not found')
    }

    const result = await chat(
      { service: 'ollama', model: 'ghost', messages, jobId: 'j3' },
      chatFn,
      () => {}
    )

    expect(result).toEqual({
      ok: false,
      error: { kind: 'upstream', service: 'ollama', status: 404, message: 'model not found' }
    })
  })

  it('maps an unreachable service to unavailable', async () => {
    const chatFn: ChatFn = async () => {
      throw new TypeError('fetch failed')
    }

    const result = await chat(
      { service: 'ollama', model: 'llama3.2', messages, jobId: 'j4' },
      chatFn,
      () => {}
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('unavailable')
  })

  it('reports cancelled when the user cancels the job mid-flight', async () => {
    const chatFn: ChatFn = async () => {
      jobs.cancel('j5') // same controller the handler created for this jobId
      throw new DOMException('aborted', 'AbortError')
    }

    const result = await chat(
      { service: 'ollama', model: 'llama3.2', messages, jobId: 'j5' },
      chatFn,
      () => {}
    )

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
  })

  it('reports timeout when the deadline fires before the reply', async () => {
    vi.useFakeTimers()
    const chatFn: ChatFn = (_messages, opts) =>
      new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        )
      })

    const promise = chat(
      { service: 'ollama', model: 'llama3.2', messages, jobId: 'j6' },
      chatFn,
      () => {}
    )
    await vi.advanceTimersByTimeAsync(300_000)
    const result = await promise

    expect(result).toEqual({ ok: false, error: { kind: 'timeout', afterMs: 300_000 } })
    vi.useRealTimers()
  })
})
