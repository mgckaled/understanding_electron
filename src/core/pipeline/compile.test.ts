import { compileSteps } from './compile'
import type { Step } from './steps'

const COLUMNS = ['nome', 'idade', 'email', 'cidade']

describe('compileSteps', () => {
  it('starts from the dataset view with no steps', () => {
    expect(compileSteps([], COLUMNS)).toBe('SELECT * FROM "dataset"')
  })

  describe('filter', () => {
    it('compiles a comparison operator', () => {
      const steps: Step[] = [{ kind: 'filter', column: 'idade', operator: 'gt', value: 18 }]
      expect(compileSteps(steps, COLUMNS)).toBe(
        'SELECT * FROM (SELECT * FROM "dataset") WHERE "idade" > 18'
      )
    })

    it('compiles isNull with no value', () => {
      const steps: Step[] = [{ kind: 'filter', column: 'email', operator: 'isNull' }]
      expect(compileSteps(steps, COLUMNS)).toBe(
        'SELECT * FROM (SELECT * FROM "dataset") WHERE "email" IS NULL'
      )
    })

    it('compiles contains as a wildcarded LIKE', () => {
      const steps: Step[] = [
        { kind: 'filter', column: 'cidade', operator: 'contains', value: 'Paulo' }
      ]
      expect(compileSteps(steps, COLUMNS)).toBe(
        `SELECT * FROM (SELECT * FROM "dataset") WHERE "cidade" LIKE '%Paulo%'`
      )
    })

    it('escapes a single quote in a string value', () => {
      const steps: Step[] = [{ kind: 'filter', column: 'nome', operator: 'eq', value: "D'Angelo" }]
      expect(compileSteps(steps, COLUMNS)).toContain(`'D''Angelo'`)
    })

    it('throws when a comparison operator has no value', () => {
      const steps: Step[] = [{ kind: 'filter', column: 'idade', operator: 'gt' }]
      expect(() => compileSteps(steps, COLUMNS)).toThrow(/needs a value/)
    })

    it('throws when contains gets a non-string value', () => {
      const steps: Step[] = [{ kind: 'filter', column: 'idade', operator: 'contains', value: 1 }]
      expect(() => compileSteps(steps, COLUMNS)).toThrow(/string value/)
    })
  })

  describe('sort', () => {
    it('compiles ascending and descending', () => {
      expect(compileSteps([{ kind: 'sort', column: 'nome', direction: 'asc' }], COLUMNS)).toBe(
        'SELECT * FROM (SELECT * FROM "dataset") ORDER BY "nome" ASC'
      )
      expect(compileSteps([{ kind: 'sort', column: 'nome', direction: 'desc' }], COLUMNS)).toBe(
        'SELECT * FROM (SELECT * FROM "dataset") ORDER BY "nome" DESC'
      )
    })
  })

  describe('limit', () => {
    it('compiles a row cap', () => {
      expect(compileSteps([{ kind: 'limit', count: 10 }], COLUMNS)).toBe(
        'SELECT * FROM (SELECT * FROM "dataset") LIMIT 10'
      )
    })
  })

  describe('dropColumns', () => {
    it('compiles a SELECT * EXCLUDE', () => {
      expect(compileSteps([{ kind: 'dropColumns', columns: ['email'] }], COLUMNS)).toBe(
        'SELECT * EXCLUDE ("email") FROM (SELECT * FROM "dataset")'
      )
    })

    it('drops the column from what later steps may reference', () => {
      const steps: Step[] = [
        { kind: 'dropColumns', columns: ['email'] },
        { kind: 'filter', column: 'email', operator: 'isNull' }
      ]
      expect(() => compileSteps(steps, COLUMNS)).toThrow(/Unknown column: "email"/)
    })
  })

  describe('renameColumn', () => {
    it('compiles a SELECT * RENAME', () => {
      expect(
        compileSteps([{ kind: 'renameColumn', from: 'cidade', to: 'municipio' }], COLUMNS)
      ).toBe('SELECT * RENAME ("cidade" AS "municipio") FROM (SELECT * FROM "dataset")')
    })

    it('makes the new name known to a later step', () => {
      const steps: Step[] = [
        { kind: 'renameColumn', from: 'cidade', to: 'municipio' },
        { kind: 'sort', column: 'municipio', direction: 'asc' }
      ]
      expect(() => compileSteps(steps, COLUMNS)).not.toThrow()
    })
  })

  describe('fillMissing', () => {
    it('compiles the zero strategy', () => {
      expect(
        compileSteps([{ kind: 'fillMissing', column: 'idade', strategy: 'zero' }], COLUMNS)
      ).toBe('SELECT * REPLACE (COALESCE("idade", 0) AS "idade") FROM (SELECT * FROM "dataset")')
    })

    it('compiles the empty strategy', () => {
      expect(
        compileSteps([{ kind: 'fillMissing', column: 'nome', strategy: 'empty' }], COLUMNS)
      ).toBe(`SELECT * REPLACE (COALESCE("nome", '') AS "nome") FROM (SELECT * FROM "dataset")`)
    })

    it('compiles the value strategy with a literal', () => {
      expect(
        compileSteps(
          [{ kind: 'fillMissing', column: 'cidade', strategy: 'value', value: 'N/A' }],
          COLUMNS
        )
      ).toBe(
        `SELECT * REPLACE (COALESCE("cidade", 'N/A') AS "cidade") FROM (SELECT * FROM "dataset")`
      )
    })

    it('throws when the value strategy has no value', () => {
      expect(() =>
        compileSteps([{ kind: 'fillMissing', column: 'cidade', strategy: 'value' }], COLUMNS)
      ).toThrow(/needs a value/)
    })
  })

  describe('combinations of two steps', () => {
    it('nests filter then sort', () => {
      const steps: Step[] = [
        { kind: 'filter', column: 'idade', operator: 'gte', value: 18 },
        { kind: 'sort', column: 'nome', direction: 'asc' }
      ]
      expect(compileSteps(steps, COLUMNS)).toBe(
        'SELECT * FROM (SELECT * FROM (SELECT * FROM "dataset") WHERE "idade" >= 18) ORDER BY "nome" ASC'
      )
    })

    it('nests sort then limit', () => {
      const steps: Step[] = [
        { kind: 'sort', column: 'idade', direction: 'desc' },
        { kind: 'limit', count: 5 }
      ]
      expect(compileSteps(steps, COLUMNS)).toBe(
        'SELECT * FROM (SELECT * FROM (SELECT * FROM "dataset") ORDER BY "idade" DESC) LIMIT 5'
      )
    })
  })

  describe('invalid column', () => {
    it('throws for a column outside the given schema', () => {
      const steps: Step[] = [{ kind: 'sort', column: 'salario', direction: 'asc' }]
      expect(() => compileSteps(steps, COLUMNS)).toThrow('Unknown column: "salario"')
    })

    it('throws for dropColumns referencing an unknown column', () => {
      const steps: Step[] = [{ kind: 'dropColumns', columns: ['idade', 'salario'] }]
      expect(() => compileSteps(steps, COLUMNS)).toThrow('Unknown column: "salario"')
    })
  })
})
