import type { AppError } from '@shared/ipc'

/** Maps a Node fs error code to the AppError kind the UI reacts to; anything else is 'unknown'. */
export function mapFsError(error: unknown, path: string): AppError {
  const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined

  if (code === 'ENOENT') return { kind: 'not-found', path }
  if (code === 'EACCES' || code === 'EPERM') return { kind: 'permission', path }
  return { kind: 'unknown', message: error instanceof Error ? error.message : String(error) }
}
