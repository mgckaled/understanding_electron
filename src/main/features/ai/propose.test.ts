import { vi } from 'vitest'
import type { ColumnProfile, DatasetPart } from '@shared/ipc'
import type { ChatFn } from '@core/ai/types'
import { UpstreamError } from '@core/ai/types'
import * as jobs from '../../jobs'
import { propose } from './propose'

const card: DatasetPart = {
  kind: 'dataset',
  hash: 'a'.repeat(64),
  fileName: 'vendas.csv',
  format: 'delimited',
  delimiter: ',',
  columns: ['idade', 'cidade'],
  rowCount: 100
}

const profile: ColumnProfile[] = [
  {
    column: 'idade',
    type: 'BIGINT',
    nullPercentage: 0,
    approxUnique: 40,
    min: '18',
    max: '65',
    avg: 34.2
  }
]

describe('propose', () => {
  it('resolves the parsed StepProposal from the chat fn', async () => {
    const chatFn: ChatFn = async () => ({
      content: JSON.stringify({
        kind: 'steps',
        steps: [{ kind: 'filter', column: 'idade', operator: 'gt', value: 18 }]
      })
    })
    const runProfile = vi.fn().mockResolvedValue(profile)

    const result = await propose(
      {
        service: 'ollama',
        model: 'gemma3:4b',
        hash: card.hash,
        card,
        request: 'filtre maiores de 18',
        jobId: 'p1'
      },
      chatFn,
      runProfile
    )

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'steps',
        steps: [{ kind: 'filter', column: 'idade', operator: 'gt', value: 18 }]
      }
    })
    expect(runProfile).toHaveBeenCalledWith(card.hash)
  })

  it('finishes the job even on success (no leaked AbortController)', async () => {
    const finish = vi.spyOn(jobs, 'finish')
    const chatFn: ChatFn = async () => ({
      content: JSON.stringify({ kind: 'steps', steps: [{ kind: 'limit', count: 1 }] })
    })
    const runProfile = vi.fn().mockResolvedValue([])

    await propose(
      { service: 'ollama', model: 'gemma3:4b', hash: card.hash, card, request: 'x', jobId: 'p2' },
      chatFn,
      runProfile
    )

    expect(finish).toHaveBeenCalledWith('p2')
    finish.mockRestore()
  })

  it('maps a runProfile failure to invalidQuery, without ever calling chatFn', async () => {
    const chatFn = vi.fn<ChatFn>()
    const runProfile = vi.fn().mockRejectedValue(new Error('Binder Error: column "x" not found'))

    const result = await propose(
      { service: 'ollama', model: 'gemma3:4b', hash: card.hash, card, request: 'x', jobId: 'p3' },
      chatFn,
      runProfile
    )

    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalidQuery', message: 'Binder Error: column "x" not found' }
    })
    expect(chatFn).not.toHaveBeenCalled()
  })

  it('maps an UpstreamError from the chat fn to an upstream AppError', async () => {
    const chatFn: ChatFn = async () => {
      throw new UpstreamError(404, 'model not found')
    }
    const runProfile = vi.fn().mockResolvedValue(profile)

    const result = await propose(
      { service: 'ollama', model: 'ghost', hash: card.hash, card, request: 'x', jobId: 'p4' },
      chatFn,
      runProfile
    )

    expect(result).toEqual({
      ok: false,
      error: { kind: 'upstream', service: 'ollama', status: 404, message: 'model not found' }
    })
  })

  it('reports cancelled when the user cancels the job mid-flight', async () => {
    const chatFn: ChatFn = async () => {
      jobs.cancel('p5')
      throw new DOMException('aborted', 'AbortError')
    }
    const runProfile = vi.fn().mockResolvedValue(profile)

    const result = await propose(
      { service: 'ollama', model: 'gemma3:4b', hash: card.hash, card, request: 'x', jobId: 'p5' },
      chatFn,
      runProfile
    )

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
  })
})
