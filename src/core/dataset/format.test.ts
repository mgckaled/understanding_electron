import { sniffDatasetFormat } from './format'

describe('sniffDatasetFormat', () => {
  it.each([
    ['a JSON object', '{"a": 1}'],
    ['a JSON array', '[1, 2, 3]'],
    ['whitespace before an object', '  \n{"a": 1}'],
    ['a BOM-prefixed JSON object', '﻿{"a": 1}'],
    ['a BOM-prefixed JSON array', '﻿[1, 2, 3]']
  ])('reads %s as json', (_label, sample) => {
    expect(sniffDatasetFormat(sample)).toBe('json')
  })

  it.each([
    ['a plain CSV', 'id,name\n1,Ana'],
    ['a BOM-prefixed CSV', '﻿id,name\n1,Ana'],
    ['an empty string', ''],
    ['a whitespace-only string', '   \n  ']
  ])('reads %s as delimited', (_label, sample) => {
    expect(sniffDatasetFormat(sample)).toBe('delimited')
  })
})
