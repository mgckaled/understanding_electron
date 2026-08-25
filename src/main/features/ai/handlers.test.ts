import { vi } from 'vitest'
import type { AiModel, ChatMessage, JobEvent, Message } from '@shared/ipc'
import type { ChatFn, LoadedFn, ModelsFn, ProbeFn, UnloadFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import * as jobs from '../../jobs'
import { chat, isAvailable, loaded, models, unload } from './handlers'

// The app's own shape (D17.5) — chat() materializes this into ChatMessage[]
// via toChatMessagesWithImages before it ever reaches chatFn.
const messages: Message[] = [
  { id: 'm1', role: 'user', parts: [{ kind: 'text', text: 'oi' }], createdAt: 1 }
]

// None of the fixtures above carry an image part, so this should never be
// called — throwing turns an accidental call into a loud test failure
// instead of a silent wrong buffer.
const resolveImageBytes = async (): Promise<Buffer> => {
  throw new Error('unexpected image resolve in a fixture with no image part')
}

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

  it('carries the host through when the caller passes one', async () => {
    const probe: ProbeFn = async () => '0.5.1'

    const result = await isAvailable({ service: 'ollama' }, probe, '127.0.0.1:11434')

    expect(result).toEqual({
      ok: true,
      value: { service: 'ollama', version: '0.5.1', host: '127.0.0.1:11434' }
    })
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
      (e) => events.push(e),
      resolveImageBytes
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

    await chat(
      { service: 'ollama', model: 'llama3.2', messages, jobId: 'j2' },
      chatFn,
      () => {},
      resolveImageBytes
    )

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
      () => {},
      resolveImageBytes
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
      () => {},
      resolveImageBytes
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
      () => {},
      resolveImageBytes
    )

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
  })

  it('materializes Message[] into ChatMessage[] before calling chatFn (D17.5)', async () => {
    let received: ChatMessage[] | undefined
    const chatFn: ChatFn = async (sentMessages) => {
      received = sentMessages
      return { content: 'ok' }
    }
    const withAttachment: Message[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [
          {
            kind: 'dataset',
            hash: 'h',
            fileName: 'vendas.csv',
            format: 'delimited',
            delimiter: ',',
            columns: ['id', 'valor'],
            rowCount: 10
          },
          { kind: 'text', text: 'o que tem aqui?' }
        ],
        createdAt: 1
      }
    ]

    await chat(
      { service: 'ollama', model: 'llama3.2', messages: withAttachment, jobId: 'j7' },
      chatFn,
      () => {},
      resolveImageBytes
    )

    expect(received).toEqual([
      {
        role: 'user',
        content: expect.stringContaining('vendas.csv')
      }
    ])
    expect(received?.[0]?.content).toContain('o que tem aqui?')
  })

  it('resolves an image part into ChatMessage.images before calling chatFn (D17.5, D17.11)', async () => {
    let received: ChatMessage[] | undefined
    const chatFn: ChatFn = async (sentMessages) => {
      received = sentMessages
      return { content: 'ok' }
    }
    const withImage: Message[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [
          { kind: 'image', hash: 'h1', fileName: 'grafico.png', mimeType: 'image/png' },
          { kind: 'text', text: 'o que é isso?' }
        ],
        createdAt: 1
      }
    ]
    const resolveThisImage = async (hash: string): Promise<Buffer> => {
      expect(hash).toBe('h1')
      return Buffer.from('fake png bytes')
    }

    await chat(
      { service: 'ollama', model: 'gemma3:4b', messages: withImage, jobId: 'j8' },
      chatFn,
      () => {},
      resolveThisImage
    )

    expect(received).toEqual([
      {
        role: 'user',
        content: 'o que é isso?',
        images: [Buffer.from('fake png bytes').toString('base64')]
      }
    ])
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
      () => {},
      resolveImageBytes
    )
    await vi.advanceTimersByTimeAsync(1_000_000)
    const result = await promise

    expect(result).toEqual({ ok: false, error: { kind: 'timeout', afterMs: 1_000_000 } })
    vi.useRealTimers()
  })

  it('lets a text-only send through on a cloud service', async () => {
    const chatFn: ChatFn = async () => ({ content: 'ok' })

    const result = await chat(
      { service: 'glm', model: 'glm-4.7-flash', messages, jobId: 'j10' },
      chatFn,
      () => {},
      resolveImageBytes
    )

    expect(result).toEqual({ ok: true, value: { content: 'ok' } })
  })
})

/*
 * What the provider holds in memory (antecipado do plano 17). Same Result
 * shape and same two failure modes as the catalog, because it is the same
 * transport — which is the point of `mapProviderError` serving both.
 */
describe('loaded and unload', () => {
  const resident = { name: 'gemma3:4b', sizeBytes: 4_800_000_000, expiresAt: 1_754_000_000_000 }

  it('reports what is resident', async () => {
    const loadedFn: LoadedFn = async () => [resident]

    expect(await loaded({ service: 'ollama' }, loadedFn)).toEqual({ ok: true, value: [resident] })
  })

  it('reports an empty machine as an empty list, not as a failure', async () => {
    const loadedFn: LoadedFn = async () => []

    expect(await loaded({ service: 'ollama' }, loadedFn)).toEqual({ ok: true, value: [] })
  })

  it('asks the provider to drop the model it was given', async () => {
    const unloadFn = vi.fn<UnloadFn>().mockResolvedValue(undefined)

    const result = await unload({ service: 'ollama', model: 'gemma3:4b' }, unloadFn)

    expect(result.ok).toBe(true)
    expect(unloadFn).toHaveBeenCalledWith('gemma3:4b', expect.anything())
  })

  it('degrades to unavailable when the provider cannot be reached', async () => {
    const unloadFn: UnloadFn = async () => {
      throw new TypeError('fetch failed')
    }

    const result = await unload({ service: 'ollama', model: 'gemma3:4b' }, unloadFn)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('unavailable')
  })
})
