import type { AppError, Result } from '@shared/ipc'

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error }
}
