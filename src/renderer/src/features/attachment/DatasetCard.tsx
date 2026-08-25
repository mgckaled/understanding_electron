import { useState } from 'react'
import { ChevronDown, ChevronUp, Paperclip } from 'lucide-react'
import type { DatasetPart } from '@shared/ipc'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Button from '../../shared/ui/Button/Button'
import DatasetPreview from './DatasetPreview'
import DatasetQueryPanel from './DatasetQueryPanel'
import DatasetProfile from './DatasetProfile'
import { useStepProposal } from './useStepProposal'

// What plano 16 draws in the transcript for a dataset attachment (D16.4 Passo
// 4) — schema and row count only, the same fields the model itself reads
// (core/ai/dataCard.ts). Never the card's SENT text: this is chrome, read at
// a glance, not the payload. The disclosure below (D18B.5) copies the form
// DocumentCard already has (useState + conditional render), not extracted:
// this is the second occurrence, and the régua dos três reserves extraction
// for a third that has not shown up yet — the Consultar section below
// stopped being disclosure-shaped once the post-18-C fix turned it into a
// switcher (see DatasetProfile's own comment, D18D.5 revista). Consultar
// swaps the automatic preview for the custom SQL panel — the two never
// render a table at once, or the default query duplicates the rows already
// shown above it (post-18-C fix, see HISTORY.md). Profile is unrelated
// content (aggregate stats, not rows), so it renders alongside either one.
function DatasetCard({ part }: { part: DatasetPart }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [proposing, setProposing] = useState(false)
  const [request, setRequest] = useState('')
  const { state: proposalState, propose } = useStepProposal(part)

  async function handleSubmitProposal(): Promise<void> {
    if (request.trim() === '') return
    await propose(request.trim())
    setRequest('')
  }

  return (
    <div className="flex max-w-[80%] flex-col gap-3 rounded-lg border border-border bg-surface-raised px-5 py-4 text-text">
      <div className="flex items-center gap-3">
        <Paperclip
          size={ICON_SIZE.md}
          strokeWidth={ICON_STROKE}
          className="flex-none text-text-muted"
        />
        <div className="flex min-w-[0px] flex-1 flex-col gap-1">
          <span className="overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap">
            {part.fileName}
          </span>
          <span className="text-xs text-text-muted">
            {part.columns.length} colunas · {part.rowCount.toLocaleString('pt-BR')} linhas
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="flex-none"
          onClick={() => setProposing((value) => !value)}
          aria-pressed={proposing}
        >
          Propor passos
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-none"
          onClick={() => setExpanded((value) => !value)}
          aria-pressed={expanded}
        >
          <span className="flex items-center gap-1.5">
            {expanded ? 'Ver amostra' : 'Consultar'}
            {expanded ? (
              <ChevronUp size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
            ) : (
              <ChevronDown size={ICON_SIZE.sm} strokeWidth={ICON_STROKE} />
            )}
          </span>
        </Button>
      </div>
      {proposing && (
        // Minimal by design (D19's own scope note) — a single request field,
        // no history and no saved prompts. The proposal itself lands as a
        // new assistant message (useStepProposal), not inline here.
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <textarea
            className="min-h-[56px] resize-y rounded-md border border-border bg-surface px-3 py-2 text-xs text-text selectable"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            placeholder="Como tratar esse arquivo? Ex.: filtrar idade maior que 18"
            aria-label="Pedido em português"
          />
          <div>
            <Button
              variant="primary"
              size="sm"
              loading={proposalState.status === 'loading'}
              disabled={request.trim() === ''}
              onClick={() => void handleSubmitProposal()}
            >
              Enviar pedido
            </Button>
          </div>
          {proposalState.status === 'error' && (
            <p className="text-xs text-danger-text selectable" role="alert">
              {proposalState.message}
            </p>
          )}
        </div>
      )}
      {expanded ? <DatasetQueryPanel hash={part.hash} /> : <DatasetPreview part={part} />}
      <DatasetProfile hash={part.hash} />
    </div>
  )
}

export default DatasetCard
