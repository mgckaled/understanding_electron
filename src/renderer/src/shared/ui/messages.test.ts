import type { AppError } from '@shared/ipc'
import { errorMessage } from './messages'

const SAMPLE_ERRORS: AppError[] = [
  { kind: 'not-found', path: '/x' },
  { kind: 'permission', path: '/x' },
  { kind: 'blocked', reason: 'motivo específico' },
  { kind: 'cancelled' },
  { kind: 'timeout', afterMs: 1000 },
  { kind: 'unavailable', service: 'ollama', hint: 'dica' },
  { kind: 'upstream', service: 'ollama', status: 500, message: 'falha' },
  { kind: 'invalidQuery', message: 'x' },
  { kind: 'unknown', message: 'x' }
]

describe('errorMessage', () => {
  it.each(SAMPLE_ERRORS)('has a non-empty message for kind "$kind"', (error) => {
    expect(errorMessage(error).length).toBeGreaterThan(0)
  })

  it('returns the reason verbatim for a blocked error, not the generic fallback (D17.8)', () => {
    const error: AppError = { kind: 'blocked', reason: 'PDF sem texto selecionável' }

    expect(errorMessage(error)).toBe('PDF sem texto selecionável')
  })

  it('returns the message verbatim for an invalidQuery error — the engine’s own text (D18B.6)', () => {
    const error: AppError = { kind: 'invalidQuery', message: 'Binder Error: column "x" not found' }

    expect(errorMessage(error)).toBe('Binder Error: column "x" not found')
  })

  it('returns the message verbatim for an upstream error — already classified main-side by describeUpstreamError', () => {
    const error: AppError = {
      kind: 'upstream',
      service: 'glm',
      status: 429,
      message:
        'Limite de uso do serviço atingido (HTTP 429 Too Many Requests) — tente novamente em instantes.'
    }

    expect(errorMessage(error)).toBe(
      'Limite de uso do serviço atingido (HTTP 429 Too Many Requests) — tente novamente em instantes.'
    )
  })

  it('falls back to a generic message for a kind this build does not know', () => {
    const error = { kind: 'future-kind' } as unknown as AppError

    expect(errorMessage(error)).toBe('Ocorreu um erro inesperado.')
  })
})
