import {
  filterStepSchema,
  sortStepSchema,
  limitStepSchema,
  dropColumnsStepSchema,
  renameColumnStepSchema,
  fillMissingStepSchema,
  stepSchema,
  stepProposalSchema,
  stepProposalJsonSchema
} from './steps'

describe('filterStepSchema', () => {
  it('accepts a comparison step with a value', () => {
    const step = { kind: 'filter', column: 'idade', operator: 'gt', value: 18 }
    expect(filterStepSchema.parse(step)).toEqual(step)
  })

  it('accepts isNull with no value', () => {
    const step = { kind: 'filter', column: 'email', operator: 'isNull' }
    expect(filterStepSchema.parse(step)).toEqual(step)
  })

  it('rejects an unknown operator', () => {
    expect(() =>
      filterStepSchema.parse({ kind: 'filter', column: 'idade', operator: 'between' })
    ).toThrow()
  })

  it('rejects an empty column name', () => {
    expect(() =>
      filterStepSchema.parse({ kind: 'filter', column: '', operator: 'eq', value: 1 })
    ).toThrow()
  })
})

describe('sortStepSchema', () => {
  it('accepts asc and desc', () => {
    expect(sortStepSchema.parse({ kind: 'sort', column: 'nome', direction: 'asc' })).toBeTruthy()
    expect(sortStepSchema.parse({ kind: 'sort', column: 'nome', direction: 'desc' })).toBeTruthy()
  })

  it('rejects an invalid direction', () => {
    expect(() => sortStepSchema.parse({ kind: 'sort', column: 'nome', direction: 'up' })).toThrow()
  })
})

describe('limitStepSchema', () => {
  it('accepts a positive integer count', () => {
    expect(limitStepSchema.parse({ kind: 'limit', count: 10 })).toEqual({
      kind: 'limit',
      count: 10
    })
  })

  it('rejects zero and negative counts', () => {
    expect(() => limitStepSchema.parse({ kind: 'limit', count: 0 })).toThrow()
    expect(() => limitStepSchema.parse({ kind: 'limit', count: -1 })).toThrow()
  })
})

describe('dropColumnsStepSchema', () => {
  it('accepts one or more column names', () => {
    expect(dropColumnsStepSchema.parse({ kind: 'dropColumns', columns: ['a', 'b'] })).toEqual({
      kind: 'dropColumns',
      columns: ['a', 'b']
    })
  })

  it('rejects an empty list', () => {
    expect(() => dropColumnsStepSchema.parse({ kind: 'dropColumns', columns: [] })).toThrow()
  })
})

describe('renameColumnStepSchema', () => {
  it('accepts a from/to pair', () => {
    const step = { kind: 'renameColumn', from: 'cpf', to: 'documento' }
    expect(renameColumnStepSchema.parse(step)).toEqual(step)
  })
})

describe('fillMissingStepSchema', () => {
  it('accepts the zero and empty strategies with no value', () => {
    expect(
      fillMissingStepSchema.parse({ kind: 'fillMissing', column: 'idade', strategy: 'zero' })
    ).toBeTruthy()
    expect(
      fillMissingStepSchema.parse({ kind: 'fillMissing', column: 'nome', strategy: 'empty' })
    ).toBeTruthy()
  })

  it('accepts the value strategy with a value', () => {
    const step = { kind: 'fillMissing', column: 'idade', strategy: 'value', value: 0 }
    expect(fillMissingStepSchema.parse(step)).toEqual(step)
  })
})

describe('stepSchema', () => {
  it('dispatches on kind across all six operations', () => {
    const steps = [
      { kind: 'filter', column: 'a', operator: 'eq', value: 1 },
      { kind: 'sort', column: 'a', direction: 'asc' },
      { kind: 'limit', count: 5 },
      { kind: 'dropColumns', columns: ['a'] },
      { kind: 'renameColumn', from: 'a', to: 'b' },
      { kind: 'fillMissing', column: 'b', strategy: 'zero' }
    ]
    for (const step of steps) {
      expect(() => stepSchema.parse(step)).not.toThrow()
    }
  })

  it('rejects a kind outside the six operations', () => {
    expect(() => stepSchema.parse({ kind: 'aggregate', column: 'a' })).toThrow()
  })
})

describe('stepProposalSchema', () => {
  it('accepts a query proposal', () => {
    const proposal = {
      kind: 'query',
      steps: [{ kind: 'limit', count: 10 }]
    }
    expect(stepProposalSchema.parse(proposal)).toEqual(proposal)
  })

  it('accepts a steps proposal with the same step vocabulary', () => {
    const proposal = {
      kind: 'steps',
      steps: [{ kind: 'filter', column: 'a', operator: 'isNotNull' }]
    }
    expect(stepProposalSchema.parse(proposal)).toEqual(proposal)
  })

  it('rejects an empty steps array', () => {
    expect(() => stepProposalSchema.parse({ kind: 'steps', steps: [] })).toThrow()
  })

  it('rejects a kind outside query/steps', () => {
    expect(() =>
      stepProposalSchema.parse({ kind: 'plan', steps: [{ kind: 'limit', count: 1 }] })
    ).toThrow()
  })
})

describe('stepProposalJsonSchema', () => {
  it('is a JSON Schema object describing the discriminated union', () => {
    expect(stepProposalJsonSchema.oneOf).toBeInstanceOf(Array)
    expect(stepProposalJsonSchema.oneOf).toHaveLength(2)
  })
})
