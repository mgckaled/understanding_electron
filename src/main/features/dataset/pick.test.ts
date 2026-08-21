import { pickDataset } from './pick'

describe('pickDataset', () => {
  it('returns the picked path when the user selects a file', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/a.csv'] })

    const result = await pickDataset(undefined, showOpenDialog)

    expect(result).toEqual({ ok: true, value: { path: '/a.csv' } })
  })

  it('returns ok(null) when the user cancels the dialog', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] })

    const result = await pickDataset(undefined, showOpenDialog)

    expect(result).toEqual({ ok: true, value: null })
  })

  // Regression: the OS dialog shows only the FIRST filter by default — a
  // JSON-only second filter left JSON/NDJSON invisible until the user
  // manually switched the dropdown (found live, fixed post-18-E). The first
  // filter must list every extension this button supports.
  it('lists every supported extension in the first (default) filter', async () => {
    const showOpenDialog = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] })

    await pickDataset(undefined, showOpenDialog)

    const { filters } = showOpenDialog.mock.calls[0][0]
    expect(filters[0].extensions).toEqual(
      expect.arrayContaining(['csv', 'tsv', 'txt', 'json', 'ndjson', 'jsonl', 'xlsx'])
    )
  })
})
