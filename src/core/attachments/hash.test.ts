import { isAttachmentHash } from './hash'

const VALID = 'a'.repeat(64)

describe('isAttachmentHash', () => {
  it('accepts a sha256 digest', () => {
    expect(isAttachmentHash(VALID)).toBe(true)
    expect(isAttachmentHash('0123456789abcdef'.repeat(4))).toBe(true)
  })

  // The whole reason it exists: the value reaches a path, so anything that
  // could leave the attachments directory has to die here.
  it.each(['../etc/passwd', `${VALID}/..`, `${VALID}\\x`, 'a/b', ''])(
    'rejects %j, which would not stay inside the attachments directory',
    (hash) => {
      expect(isAttachmentHash(hash)).toBe(false)
    }
  )

  it('rejects the near misses: wrong length, uppercase, non-hex', () => {
    expect(isAttachmentHash('a'.repeat(63))).toBe(false)
    expect(isAttachmentHash('a'.repeat(65))).toBe(false)
    expect(isAttachmentHash('A'.repeat(64))).toBe(false)
    expect(isAttachmentHash('g'.repeat(64))).toBe(false)
  })

  it('rejects a valid digest with anything appended, newline included', () => {
    expect(isAttachmentHash(`${VALID}\n`)).toBe(false)
    expect(isAttachmentHash(` ${VALID}`)).toBe(false)
  })
})
