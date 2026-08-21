import { createHash } from 'node:crypto'
import { hashedLines, hashFile } from './hashedLines'

async function* iterate(chunks: Buffer[]): AsyncGenerator<Buffer> {
  for (const chunk of chunks) yield chunk
}

async function collect(chunks: Buffer[]): Promise<{ lines: string[]; digest: string }> {
  const hash = createHash('sha256')
  const lines: string[] = []
  for await (const line of hashedLines(iterate(chunks), hash)) {
    lines.push(line)
  }
  return { lines, digest: hash.digest('hex') }
}

describe('hashedLines', () => {
  it('splits on \\n and strips a trailing \\r', async () => {
    const { lines } = await collect([Buffer.from('a,b\r\n1,2\n3,4', 'utf8')])
    expect(lines).toEqual(['a,b', '1,2', '3,4'])
  })

  it('yields the final line even with no trailing newline', async () => {
    const { lines } = await collect([Buffer.from('only line', 'utf8')])
    expect(lines).toEqual(['only line'])
  })

  it('decodes a multi-byte UTF-8 character split across a chunk boundary', async () => {
    const full = Buffer.from('endereço\n', 'utf8')
    // 'endere' is 6 ASCII bytes; ç (U+00E7) encodes as 0xC3 0xA7 right after —
    // slicing at byte 7 lands the boundary INSIDE that two-byte sequence. A
    // naive per-chunk toString('utf8') would decode each half to U+FFFD.
    const chunk1 = full.subarray(0, 7)
    const chunk2 = full.subarray(7)

    const { lines } = await collect([chunk1, chunk2])

    expect(lines).toEqual(['endereço'])
  })

  it('hashes the raw bytes, unaffected by where they were split', async () => {
    const full = Buffer.from('endereço,início\n', 'utf8')
    const expected = createHash('sha256').update(full).digest('hex')

    // Both splits land inside a two-byte character (ç at 6-7, í at 12-13).
    const chunked = await collect([full.subarray(0, 7), full.subarray(7, 13), full.subarray(13)])
    const whole = await collect([full])

    expect(chunked.digest).toBe(expected)
    expect(whole.digest).toBe(expected)
  })
})

describe('hashFile', () => {
  it('produces the same digest as hashing the buffer directly, for binary content', async () => {
    // Bytes that are not valid UTF-8 on their own (a lone continuation byte) —
    // proof this never goes through StringDecoder, unlike hashedLines.
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x80, 0x01])
    const expected = createHash('sha256').update(buffer).digest('hex')

    const hash = createHash('sha256')
    await hashFile(iterate([buffer.subarray(0, 3), buffer.subarray(3)]), hash)

    expect(hash.digest('hex')).toBe(expected)
  })
})
