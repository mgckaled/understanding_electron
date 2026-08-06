import type { AppError } from '@shared/ipc'
import { errorMessage } from './messages'

const ALL_KINDS: AppError['kind'][] = [
  'not-found',
  'permission',
  'blocked',
  'cancelled',
  'timeout',
  'unavailable',
  'upstream',
  'unknown'
]

describe('errorMessage', () => {
  it.each(ALL_KINDS)('has a non-empty message for kind "%s"', (kind) => {
    const error = { kind } as AppError

    expect(errorMessage(error).length).toBeGreaterThan(0)
  })

  it('falls back to a generic message for a kind this build does not know', () => {
    const error = { kind: 'future-kind' } as unknown as AppError

    expect(errorMessage(error)).toBe('Ocorreu um erro inesperado.')
  })
})
