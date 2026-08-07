import { scanDelimited } from './scan'

async function* linesFrom(values: string[]): AsyncGenerator<string> {
  for (const value of values) yield value
}

describe('scanDelimited', () => {
  it('returns zero rows and no columns for an empty input', async () => {
    const result = await scanDelimited({ lines: linesFrom([]) })

    expect(result).toEqual({ ok: true, value: { delimiter: ',', columns: [], rowCount: 0 } })
  })

  it('returns zero rows and populated columns for a header-only input', async () => {
    const result = await scanDelimited({ lines: linesFrom(['id,name,city']) })

    expect(result).toEqual({
      ok: true,
      value: { delimiter: ',', columns: ['id', 'name', 'city'], rowCount: 0 }
    })
  })

  it('picks the consistent delimiter over the one with more raw occurrences', async () => {
    // Raw comma count (ignoring quotes) is 5 across the sample, semicolon is
    // only 3 — a naive most-frequent-character count would pick comma. But
    // every comma here sits inside a quoted field, so field counts per line
    // are inconsistent for comma (1) and consistent for semicolon (2).
    const lines = linesFrom([
      'name;city',
      '"Silva, João, Pedro, Ana, Costa";São Paulo',
      '"Souza, Maria";Rio de Janeiro'
    ])

    const result = await scanDelimited({ lines })

    expect(result).toEqual({
      ok: true,
      value: { delimiter: ';', columns: ['name', 'city'], rowCount: 2 }
    })
  })

  it('does not split a quoted field containing the delimiter into a new column', async () => {
    const lines = linesFrom(['name,age', '"Silva, João",28'])

    const result = await scanDelimited({ lines })

    expect(result).toEqual({
      ok: true,
      value: { delimiter: ',', columns: ['name', 'age'], rowCount: 1 }
    })
  })

  it('does not split a quoted delimiter inside the header itself into a new column', async () => {
    const lines = linesFrom(['"first, name",age', '"Silva, João",28'])

    const result = await scanDelimited({ lines })

    expect(result).toEqual({
      ok: true,
      value: { delimiter: ',', columns: ['first, name', 'age'], rowCount: 1 }
    })
  })

  it('returns cancelled without consuming the iterable when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    let consumed = false
    async function* lines(): AsyncGenerator<string> {
      consumed = true
      yield 'a,b'
    }

    const result = await scanDelimited({ lines: lines(), signal: controller.signal })

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
    expect(consumed).toBe(false)
  })

  it('stops at the line where the signal was aborted mid-scan', async () => {
    const controller = new AbortController()
    async function* lines(): AsyncGenerator<string> {
      yield 'a,b'
      yield '1,2'
      controller.abort()
      yield '3,4'
    }

    const result = await scanDelimited({ lines: lines(), signal: controller.signal })

    expect(result).toEqual({ ok: false, error: { kind: 'cancelled' } })
  })
})
