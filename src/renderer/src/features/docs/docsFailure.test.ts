import type { AppError, ContextOutcome, SearchOutcome } from '@shared/ipc'
import type { ViewState } from '../../shared/ui/state'
import { docsFailureOf } from './docsFailure'

function ready(data: SearchOutcome | ContextOutcome): ViewState<SearchOutcome | ContextOutcome> {
  return { status: 'ready', data }
}

function failed(error: AppError): ViewState<SearchOutcome | ContextOutcome> {
  return { status: 'error', error }
}

describe('docsFailureOf', () => {
  it.each([
    ['idle', { status: 'idle' } as const],
    ['loading', { status: 'loading' } as const]
  ])('has nothing to draw while %s', (_label, state) => {
    expect(docsFailureOf(state)).toBeNull()
  })

  const resolved: [string, SearchOutcome | ContextOutcome][] = [
    ['a hit', { status: 'found', candidates: [] }],
    ['an answer', { status: 'ready', docs: { snippets: [], notes: [], rules: null } }]
  ]

  it.each(resolved)('has nothing to draw for %s — that outcome owns its screen', (_l, outcome) => {
    expect(docsFailureOf(ready(outcome))).toBeNull()
  })

  it('names the search miss without echoing the service, and offers no control', () => {
    const failure = docsFailureOf(ready({ status: 'no-libraries', message: 'No libraries found' }))

    expect(failure?.text).toContain('Nenhuma biblioteca com esse nome')
    expect(failure?.text).not.toContain('No libraries found')
    expect(failure?.action).toBe('none')
  })

  // The three outcomes of the second call are the reason this function exists:
  // one generic text would make the user guess which of them happened.
  it('tells the three second-call outcomes apart, text and action', () => {
    const empty = docsFailureOf(ready({ status: 'empty' }))
    const indexing = docsFailureOf(ready({ status: 'indexing', state: 'parsing' }))
    const gone = docsFailureOf(ready({ status: 'library-not-found' }))

    expect(empty?.text).toContain('nada respondeu a essa pergunta')
    expect(indexing?.text).toContain('sendo indexada')
    expect(gone?.text).toContain('não está mais no Context7')
    expect(empty?.text).not.toBe(indexing?.text)
    expect([empty?.action, indexing?.action, gone?.action]).toEqual(['retry', 'retry', 'back'])
  })

  it('keeps the 429 text the client composed, with its reset date', () => {
    const message =
      'As 200 consultas mensais gratuitas do Context7 acabaram. A cota volta em 30 de setembro de 2026, 21:00. Uma chave do Context7 aumenta o limite.'
    const failure = docsFailureOf(
      failed({ kind: 'upstream', service: 'context7', status: 429, message })
    )

    expect(failure?.text).toBe(message)
    // Nothing to retry against a quota that is out until the month turns.
    expect(failure?.action).toBe('none')
  })

  it.each([401, 403])('writes its own text for %i, never the AI provider hint', (status) => {
    const failure = docsFailureOf(
      failed({ kind: 'upstream', service: 'context7', status, message: 'Erro do serviço: 401' })
    )

    expect(failure?.text).toContain('foi recusada')
    expect(failure?.text).toContain('Configurações')
    expect(failure?.action).toBe('none')
  })

  it('hands a 5xx the service message and a retry', () => {
    const failure = docsFailureOf(
      failed({ kind: 'upstream', service: 'context7', status: 503, message: 'Serviço fora do ar.' })
    )

    expect(failure).toEqual({ text: 'Serviço fora do ar.', action: 'retry' })
  })

  it('names the connection when the service was never reached', () => {
    const failure = docsFailureOf(
      failed({ kind: 'unavailable', service: 'context7', hint: 'Verifique sua conexão' })
    )

    expect(failure?.text).toContain('alcançar o Context7')
    expect(failure?.action).toBe('retry')
  })

  // D23B.1 condição 1: the ceiling that made `invoke` acceptable instead of a
  // job has to be on screen, and it is read off the error, never written out.
  it('says how long it waited, in seconds taken from the error', () => {
    const failure = docsFailureOf(failed({ kind: 'timeout', afterMs: 30_000 }))

    expect(failure?.text).toContain('30 segundos')
    expect(failure?.action).toBe('retry')
  })
})
