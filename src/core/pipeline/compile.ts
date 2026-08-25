import { sqlIdentifier } from '../duckdb/profile'
import type { FillMissingStep, FilterStep, Step } from './steps'

const DATASET_VIEW = 'dataset'

const FILTER_COMPARATORS: Record<'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte', string> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<='
}

function sqlLiteral(value: string | number | boolean): string {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return `'${value.replace(/'/g, "''")}'`
}

function quotedColumn(column: string): string {
  return `"${sqlIdentifier(column)}"`
}

function ensureKnownColumn(known: Set<string>, column: string): void {
  if (!known.has(column)) throw new Error(`Unknown column: "${column}"`)
}

// The 'contains' pattern is built with the raw value between literal `%`
// wildcards — a value that itself contains `%`/`_` is not escaped, matching
// LIKE's own wildcard characters instead of the literal text. Acceptable at
// the D19.1 six-operation cut; not a case any of the six ops needs today.
function buildFilterCondition(step: FilterStep): string {
  const column = quotedColumn(step.column)
  if (step.operator === 'isNull') return `${column} IS NULL`
  if (step.operator === 'isNotNull') return `${column} IS NOT NULL`
  if (step.value === undefined) {
    throw new Error(`Step "filter" on "${step.column}" (${step.operator}) needs a value`)
  }
  if (step.operator === 'contains') {
    if (typeof step.value !== 'string') {
      throw new Error(`Step "filter" on "${step.column}" (contains) needs a string value`)
    }
    return `${column} LIKE ${sqlLiteral(`%${step.value}%`)}`
  }
  return `${column} ${FILTER_COMPARATORS[step.operator]} ${sqlLiteral(step.value)}`
}

function buildFillMissingFallback(step: FillMissingStep): string {
  if (step.strategy === 'zero') return '0'
  if (step.strategy === 'empty') return "''"
  if (step.value === undefined) {
    throw new Error(`Step "fillMissing" on "${step.column}" (value) needs a value`)
  }
  return sqlLiteral(step.value)
}

function applyStep(sql: string, step: Step, known: Set<string>): string {
  switch (step.kind) {
    case 'filter': {
      ensureKnownColumn(known, step.column)
      return `SELECT * FROM (${sql}) WHERE ${buildFilterCondition(step)}`
    }
    case 'sort': {
      ensureKnownColumn(known, step.column)
      const direction = step.direction === 'asc' ? 'ASC' : 'DESC'
      return `SELECT * FROM (${sql}) ORDER BY ${quotedColumn(step.column)} ${direction}`
    }
    case 'limit': {
      return `SELECT * FROM (${sql}) LIMIT ${step.count}`
    }
    case 'dropColumns': {
      for (const column of step.columns) ensureKnownColumn(known, column)
      const excluded = step.columns.map(quotedColumn).join(', ')
      for (const column of step.columns) known.delete(column)
      return `SELECT * EXCLUDE (${excluded}) FROM (${sql})`
    }
    case 'renameColumn': {
      ensureKnownColumn(known, step.from)
      known.delete(step.from)
      known.add(step.to)
      return `SELECT * RENAME (${quotedColumn(step.from)} AS ${quotedColumn(step.to)}) FROM (${sql})`
    }
    case 'fillMissing': {
      ensureKnownColumn(known, step.column)
      const column = quotedColumn(step.column)
      const fallback = buildFillMissingFallback(step)
      return `SELECT * REPLACE (COALESCE(${column}, ${fallback}) AS ${column}) FROM (${sql})`
    }
  }
}

/**
 * Compiles a step list into one SQL statement over the `dataset` view — pure,
 * no database involved. `columns` is the schema the model was shown; a step
 * referencing a column outside it (or missing a value an operator requires)
 * throws here, at compile time, never surfacing as a DuckDB engine error at
 * run time (D19.1 passo 2).
 */
export function compileSteps(steps: Step[], columns: readonly string[]): string {
  const known = new Set(columns)
  let sql = `SELECT * FROM ${quotedColumn(DATASET_VIEW)}`
  for (const step of steps) {
    sql = applyStep(sql, step, known)
  }
  return sql
}
