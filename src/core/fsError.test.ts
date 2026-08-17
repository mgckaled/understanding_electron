import { mapFsError } from './fsError'

describe('mapFsError', () => {
  it('maps ENOENT to not-found', () => {
    const error = Object.assign(new Error('gone'), { code: 'ENOENT' })
    expect(mapFsError(error, '/gone.csv')).toEqual({ kind: 'not-found', path: '/gone.csv' })
  })

  it('maps EACCES and EPERM to permission', () => {
    const eacces = Object.assign(new Error('denied'), { code: 'EACCES' })
    const eperm = Object.assign(new Error('denied'), { code: 'EPERM' })
    expect(mapFsError(eacces, '/x').kind).toBe('permission')
    expect(mapFsError(eperm, '/x').kind).toBe('permission')
  })

  it('falls back to unknown with the error message', () => {
    expect(mapFsError(new Error('boom'), '/x')).toEqual({ kind: 'unknown', message: 'boom' })
  })

  it('stringifies a non-Error thrown value', () => {
    expect(mapFsError('literal string', '/x')).toEqual({
      kind: 'unknown',
      message: 'literal string'
    })
  })
})
