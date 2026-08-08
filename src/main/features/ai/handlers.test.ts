import { vi } from 'vitest'
import type { ChatMessage, JobEvent } from '@shared/ipc'
import type { ChatFn, ProbeFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import * as jobs from '../../jobs'
import { chat, isAvailable } from './handlers'

const messages: ChatMessage[] = [{ role: 'user', content: 'oi' }]

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

describe('chat', () => {
  it('streams chunk events and resolves with the assembled reply', async () => {
    const chatFn: ChatFn = async (_messages, opts) => {
      opts.onChunk?.('Olá')
      opts.onChunk?.('!')
      return 'Olá!'
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
    const chatFn: ChatFn = async () => 'ok'

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
