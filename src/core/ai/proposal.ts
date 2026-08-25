import type { ChatMessage, ColumnProfile, DatasetPart, Result, StepProposal } from '@shared/ipc'
import { stepProposalSchema, stepProposalJsonSchema } from '@shared/ipc'
import { runStructuredChat } from './chat'
import { formatDataCard } from './dataCard'
import type { ChatFn } from './types'

const PROPOSAL_INSTRUCTIONS =
  'Você recebe o esquema de um arquivo tabular anexado e um pedido em português sobre ' +
  'como tratá-lo. Proponha uma lista de passos usando apenas os seis tipos disponíveis: ' +
  'filter, sort, limit, dropColumns, renameColumn, fillMissing. Nunca proponha um passo ' +
  'sobre uma coluna que não esteja no esquema mostrado.'

/**
 * Formats a column's level-2 profile for the model — type and
 * nullPercentage only. Never `topValues` (ESCOPO.md § privacidade): a
 * column's most frequent values ARE cell content, the exact thing the
 * schema-only boundary exists to keep out of the prompt.
 */
function formatColumnProfile(profile: ColumnProfile[]): string {
  return profile
    .map(
      (column) => `- ${column.column} (${column.type}): ${column.nullPercentage.toFixed(1)}% nulo`
    )
    .join('\n')
}

export function buildProposalMessages(
  card: DatasetPart,
  profile: ColumnProfile[] | undefined,
  request: string
): ChatMessage[] {
  const sections = [formatDataCard(card)]
  if (profile !== undefined) sections.push(formatColumnProfile(profile))
  sections.push(`Pedido: ${request}`)

  return [
    { role: 'system', content: PROPOSAL_INSTRUCTIONS },
    { role: 'user', content: sections.join('\n\n') }
  ]
}

/**
 * Turns a Portuguese request plus an attached dataset's schema (D9.4) into a
 * typed StepProposal — never rows, never `topValues`. Confirms the form
 * D19.1/D19.2 already decided; does not reopen it.
 */
export async function requestStepProposal(
  chat: ChatFn,
  params: {
    card: DatasetPart
    profile?: ColumnProfile[]
    request: string
    model: string
    numThread?: number
    numCtx?: number
  },
  opts: { signal?: AbortSignal } = {}
): Promise<Result<StepProposal>> {
  const messages = buildProposalMessages(params.card, params.profile, params.request)
  return runStructuredChat(
    chat,
    stepProposalSchema,
    stepProposalJsonSchema,
    { messages, model: params.model, numThread: params.numThread, numCtx: params.numCtx },
    opts
  )
}
