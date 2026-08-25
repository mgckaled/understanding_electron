import type { FillMissingStrategy, FilterOperator, Step } from '@shared/ipc'

const FILTER_OPERATOR_LABEL: Record<FilterOperator, string> = {
  eq: 'igual a',
  neq: 'diferente de',
  gt: 'maior que',
  gte: 'maior ou igual a',
  lt: 'menor que',
  lte: 'menor ou igual a',
  contains: 'contém',
  isNull: 'é nulo',
  isNotNull: 'não é nulo'
}

const FILL_STRATEGY_LABEL: Record<FillMissingStrategy, string> = {
  value: 'valor fixo',
  zero: 'zero',
  empty: 'vazio'
}

/** A step in Portuguese, for the transcript resent to the model (D9.4) and the UI's editable list (D19.6). */
export function describeStep(step: Step): string {
  switch (step.kind) {
    case 'filter': {
      const label = FILTER_OPERATOR_LABEL[step.operator]
      return step.value === undefined
        ? `filtrar ${step.column} ${label}`
        : `filtrar ${step.column} ${label} ${step.value}`
    }
    case 'sort':
      return `ordenar por ${step.column} (${step.direction === 'asc' ? 'crescente' : 'decrescente'})`
    case 'limit':
      return `limitar a ${step.count} linha${step.count === 1 ? '' : 's'}`
    case 'dropColumns':
      return `remover coluna${step.columns.length === 1 ? '' : 's'} ${step.columns.join(', ')}`
    case 'renameColumn':
      return `renomear ${step.from} para ${step.to}`
    case 'fillMissing': {
      const strategy = FILL_STRATEGY_LABEL[step.strategy]
      return step.value === undefined
        ? `preencher nulos de ${step.column} (${strategy})`
        : `preencher nulos de ${step.column} (${strategy}: ${step.value})`
    }
  }
}

export function describeSteps(steps: Step[]): string {
  return steps.map((step, index) => `${index + 1}. ${describeStep(step)}`).join('\n')
}
