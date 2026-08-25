import type { Step } from '@shared/ipc'
import { describeStep, describeSteps } from './describe'

describe('describeStep', () => {
  it('describes a filter with a value', () => {
    expect(describeStep({ kind: 'filter', column: 'idade', operator: 'gt', value: 18 })).toBe(
      'filtrar idade maior que 18'
    )
  })

  it('describes isNull/isNotNull without a value', () => {
    expect(describeStep({ kind: 'filter', column: 'email', operator: 'isNull' })).toBe(
      'filtrar email é nulo'
    )
  })

  it('describes sort in each direction', () => {
    expect(describeStep({ kind: 'sort', column: 'nome', direction: 'asc' })).toBe(
      'ordenar por nome (crescente)'
    )
    expect(describeStep({ kind: 'sort', column: 'nome', direction: 'desc' })).toBe(
      'ordenar por nome (decrescente)'
    )
  })

  it('describes limit with singular/plural agreement', () => {
    expect(describeStep({ kind: 'limit', count: 1 })).toBe('limitar a 1 linha')
    expect(describeStep({ kind: 'limit', count: 5 })).toBe('limitar a 5 linhas')
  })

  it('describes dropColumns with singular/plural agreement', () => {
    expect(describeStep({ kind: 'dropColumns', columns: ['email'] })).toBe('remover coluna email')
    expect(describeStep({ kind: 'dropColumns', columns: ['a', 'b'] })).toBe('remover colunas a, b')
  })

  it('describes renameColumn', () => {
    expect(describeStep({ kind: 'renameColumn', from: 'cpf', to: 'documento' })).toBe(
      'renomear cpf para documento'
    )
  })

  it('describes fillMissing for each strategy', () => {
    expect(describeStep({ kind: 'fillMissing', column: 'idade', strategy: 'zero' })).toBe(
      'preencher nulos de idade (zero)'
    )
    expect(describeStep({ kind: 'fillMissing', column: 'nome', strategy: 'empty' })).toBe(
      'preencher nulos de nome (vazio)'
    )
    expect(
      describeStep({ kind: 'fillMissing', column: 'cidade', strategy: 'value', value: 'N/A' })
    ).toBe('preencher nulos de cidade (valor fixo: N/A)')
  })
})

describe('describeSteps', () => {
  it('numbers each step in order', () => {
    const steps: Step[] = [
      { kind: 'filter', column: 'idade', operator: 'gt', value: 18 },
      { kind: 'limit', count: 10 }
    ]

    expect(describeSteps(steps)).toBe('1. filtrar idade maior que 18\n2. limitar a 10 linhas')
  })
})
