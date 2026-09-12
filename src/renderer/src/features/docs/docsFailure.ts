import type { AppError, ContextOutcome, SearchOutcome } from '@shared/ipc'
import { errorMessage } from '../../shared/ui/messages'
import type { ViewState } from '../../shared/ui/state'

/**
 * What the panel offers beside the text. `none` is text alone — situations 5
 * and 7 name Configurações in the sentence instead of opening it (D23I.4).
 */
export type DocsAction = 'retry' | 'back' | 'none'

export type DocsFailure = { text: string; action: DocsAction }

// Screen state, not AppError: shared/ui/messages.ts owns the translation of a
// kind for the whole app, and a Context7 upstream is the same kind as an
// Ollama one — nine texts there would erase the distinction (DM-12, D23I.1).
const NO_LIBRARIES =
  'Nenhuma biblioteca com esse nome. Tente outro termo — o Context7 indexa pelo nome do repositório ou do site.'
const EMPTY = 'A biblioteca existe, mas nada respondeu a essa pergunta. Tente reformular.'
const INDEXING =
  'Esta biblioteca ainda está sendo indexada pelo Context7. Tente daqui a alguns minutos.'
const LIBRARY_NOT_FOUND = 'Esta biblioteca não está mais no Context7. Volte e escolha outra.'
const KEY_REFUSED = 'A chave do Context7 foi recusada. Confira a chave em Configurações.'
const UNREACHABLE = 'Não foi possível alcançar o Context7. Verifique sua conexão.'

/**
 * The failure a docs call came back with, or `null` when there is none to draw.
 *
 * @param state - Either paid call's state; a miss travels inside `ready` and
 *   never as an error (D23A.3), so both branches land here.
 */
export function docsFailureOf(
  state: ViewState<SearchOutcome | ContextOutcome>
): DocsFailure | null {
  if (state.status === 'error') return failureFor(state.error)
  if (state.status !== 'ready') return null

  switch (state.data.status) {
    case 'found':
    case 'ready':
      return null
    case 'no-libraries':
      // No control: the form is still on screen with what was typed in it.
      return { text: NO_LIBRARIES, action: 'none' }
    case 'empty':
      return { text: EMPTY, action: 'retry' }
    case 'indexing':
      return { text: INDEXING, action: 'retry' }
    case 'library-not-found':
      return { text: LIBRARY_NOT_FOUND, action: 'back' }
  }
}

function failureFor(error: AppError): DocsFailure {
  if (error.kind === 'timeout') {
    // Read off afterMs rather than written out: the ceiling lives in
    // CONTEXT7_TIMEOUT_MS, and D23B.1 condição 1 asks for it on screen.
    const seconds = Math.round(error.afterMs / 1000)
    return {
      text: `O Context7 não respondeu em ${seconds} segundos e a consulta foi interrompida. Se o serviço estiver lento, tentar de novo costuma resolver.`,
      action: 'retry'
    }
  }
  if (error.kind === 'unavailable') return { text: UNREACHABLE, action: 'retry' }
  if (error.kind === 'upstream') {
    // 429 keeps the client's own text intact: it already composes the two
    // opposite halves with the real reset date, and rewriting it here would
    // open a second owner (D23I.3).
    if (error.status === 429) return { text: error.message, action: 'none' }
    if (error.status === 401 || error.status === 403) {
      return { text: KEY_REFUSED, action: 'none' }
    }
    return { text: error.message, action: 'retry' }
  }
  return { text: errorMessage(error), action: 'retry' }
}
