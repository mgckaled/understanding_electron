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

  it('falls back to a generic message for a kind this build does not know', () => {
    const error = { kind: 'future-kind' } as unknown as AppError

    expect(errorMessage(error)).toBe('Ocorreu um erro inesperado.')
  })
})
