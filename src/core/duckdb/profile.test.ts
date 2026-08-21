import {
  sqlIdentifier,
  buildSummarizeSql,
  buildMaterializeSql,
  buildDropScratchSql,
  buildCountSql,
  qualifiesForTopValues,
  buildTopValuesSql
} from './profile'

describe('sqlIdentifier', () => {
  it('escapes an internal double quote', () => {
    expect(sqlIdentifier('col"umn')).toBe('col""umn')
  })

  it('leaves a plain name untouched', () => {
    expect(sqlIdentifier('idade')).toBe('idade')
  })
})

describe('buildSummarizeSql', () => {
  it('wraps the table name in SUMMARIZE', () => {
    expect(buildSummarizeSql('dataset_profile_scratch')).toBe('SUMMARIZE "dataset_profile_scratch"')
  })
})

describe('buildMaterializeSql', () => {
  it('creates or replaces a temp table from the source view', () => {
    expect(buildMaterializeSql('dataset', 'dataset_profile_scratch')).toBe(
      'CREATE OR REPLACE TEMP TABLE "dataset_profile_scratch" AS SELECT * FROM "dataset"'
    )
  })
})

describe('buildDropScratchSql', () => {
  it('drops the scratch table if it exists', () => {
    expect(buildDropScratchSql('dataset_profile_scratch')).toBe(
      'DROP TABLE IF EXISTS "dataset_profile_scratch"'
    )
  })
})

describe('buildCountSql', () => {
  it('counts rows in the scratch table', () => {
    expect(buildCountSql('dataset_profile_scratch')).toBe(
      'SELECT COUNT(*) AS row_count FROM "dataset_profile_scratch"'
    )
  })
})

describe('qualifiesForTopValues', () => {
  it.each([
    ['at the count ceiling', 50, 1000],
    ['just under the ratio ceiling', 50, 101],
    ['low cardinality, small table', 3, 10]
  ])('qualifies %s', (_label, approxUnique, rowCount) => {
    expect(qualifiesForTopValues(approxUnique, rowCount)).toBe(true)
  })

  it.each([
    ['one over the count ceiling', 51, 1000],
    ['just over the ratio ceiling', 51, 100],
    ['zero rows', 1, 0]
  ])('does not qualify %s', (_label, approxUnique, rowCount) => {
    expect(qualifiesForTopValues(approxUnique, rowCount)).toBe(false)
  })
})

describe('buildTopValuesSql', () => {
  it('groups and counts the column, ordered and capped at 5 by default', () => {
    expect(buildTopValuesSql('dataset_profile_scratch', 'cidade')).toBe(
      'SELECT "cidade" AS value, COUNT(*) AS count FROM "dataset_profile_scratch" GROUP BY "cidade" ORDER BY count DESC LIMIT 5'
    )
  })

  it('escapes a column name with an internal double quote', () => {
    expect(buildTopValuesSql('dataset_profile_scratch', 'col"umn')).toContain('"col""umn"')
  })

  it('accepts a different limit', () => {
    expect(buildTopValuesSql('dataset_profile_scratch', 'cidade', 3)).toContain('LIMIT 3')
  })
})
