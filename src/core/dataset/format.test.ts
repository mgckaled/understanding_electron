import { sniffDatasetFormat } from './format'

describe('sniffDatasetFormat', () => {
  it.each([
    ['a JSON object', '{"a": 1}'],
    ['a JSON array', '[1, 2, 3]'],
    ['whitespace before an object', '  \n{"a": 1}'],
    ['a BOM-prefixed JSON object', '﻿{"a": 1}'],
    ['a BOM-prefixed JSON array', '﻿[1, 2, 3]']
  ])('reads %s as json', (_label, sample) => {
    expect(sniffDatasetFormat(Buffer.from(sample, 'utf8'))).toBe('json')
  })

  it.each([
    ['a plain CSV', 'id,name\n1,Ana'],
    ['a BOM-prefixed CSV', '﻿id,name\n1,Ana'],
    ['an empty string', ''],
    ['a whitespace-only string', '   \n  ']
  ])('reads %s as delimited', (_label, sample) => {
    expect(sniffDatasetFormat(Buffer.from(sample, 'utf8'))).toBe('delimited')
  })

  it('reads the ZIP local-file-header signature as excel, over raw bytes never decoded as text', () => {
    const sample = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from([0x14, 0x00, 0x06, 0x00]) // arbitrary bytes following the signature
    ])
    expect(sniffDatasetFormat(sample)).toBe('excel')
  })

  it('does not read excel for a near-miss of the ZIP signature', () => {
    const sample = Buffer.from([0x50, 0x4b, 0x03, 0x05, ...Buffer.from('id,name\n1,Ana')])
    expect(sniffDatasetFormat(sample)).toBe('delimited')
  })

  it('does not throw on a sample shorter than the ZIP signature', () => {
    expect(sniffDatasetFormat(Buffer.from([0x50, 0x4b]))).toBe('delimited')
  })
})
