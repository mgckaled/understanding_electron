import { extractDomainId, resultError } from './events'

describe('extractDomainId', () => {
  it('prefers conversationId over messageId and jobId', () => {
    expect(extractDomainId({ conversationId: 'c1', messageId: 'm1', jobId: 'j1' })).toBe('c1')
  })

  it('falls back to messageId when conversationId is absent', () => {
    expect(extractDomainId({ messageId: 'm1', jobId: 'j1' })).toBe('m1')
  })

  it('falls back to jobId when neither conversationId nor messageId is present', () => {
    expect(extractDomainId({ jobId: 'j1' })).toBe('j1')
  })

  it('returns null when args carries none of the three keys', () => {
    expect(extractDomainId({ url: 'https://example.com' })).toBeNull()
  })

  it('returns null for non-object args', () => {
    expect(extractDomainId(undefined)).toBeNull()
    expect(extractDomainId(null)).toBeNull()
    expect(extractDomainId('a string')).toBeNull()
  })
})

describe('resultError', () => {
  it('returns null for a successful Result', () => {
    expect(resultError({ ok: true, value: 42 })).toBeNull()
  })

  it('returns the AppError kind for a failed Result', () => {
    expect(resultError({ ok: false, error: { kind: 'cancelled' } })).toBe('cancelled')
  })

  it('returns null for a value with no Result shape at all', () => {
    expect(resultError([])).toBeNull()
    expect(resultError(undefined)).toBeNull()
    expect(resultError({ tables: [] })).toBeNull()
  })

  it('falls back to "unknown" when ok is false but error carries no kind', () => {
    expect(resultError({ ok: false, error: 'boom' })).toBe('unknown')
  })
})
