import { useState } from 'react'
import { ChevronRight, Table2 } from 'lucide-react'
import type { DatasetPart } from '@shared/ipc'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Button from '../../shared/ui/Button/Button'
import { useArtifact } from '../artifact/artifactContext'
import { useStepProposal } from './useStepProposal'

// The same trigger DocumentCard became in F-3-A (DF3A.6), reached later: rows,
// profile and SQL moved to the panel's tabs, so the chevron points RIGHT.
//
// "Propor passos" stays (DF3D.6) — it is not a view of the file but a sentence
// aimed at the model, and its answer arrives as a message, not as panel
// content. Moving it would separate the request from the reply.
function DatasetCard({ part }: { part: DatasetPart }): React.JSX.Element {
  const { current, toggle } = useArtifact()
  const [proposing, setProposing] = useState(false)
  const [request, setRequest] = useState('')
  const { state: proposalState, propose } = useStepProposal(part)
  const open = current?.id === part.hash

  async function handleSubmitProposal(): Promise<void> {
    if (request.trim() === '') return
    await propose(request.trim())
    setRequest('')
  }

  return (
    <div
      className={`flex max-w-[80%] flex-col gap-3 rounded-lg border bg-surface-raised px-5 py-4 text-text ${
        open ? 'border-accent-text' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex min-w-[0px] flex-1 cursor-pointer items-center gap-3 text-left"
          onClick={(event) => toggle({ kind: 'dataset', id: part.hash, part }, event.currentTarget)}
          aria-current={open ? 'true' : undefined}
        >
          <Table2
            size={ICON_SIZE.md}
            strokeWidth={ICON_STROKE}
            className="flex-none text-text-muted"
          />
          <div className="flex min-w-[0px] flex-1 flex-col gap-1">
            <span className="overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap">
              {part.fileName}
            </span>
            <span className="text-xs text-text-muted tabular-nums">
              {part.columns.length} colunas · {part.rowCount.toLocaleString('pt-BR')} linhas
            </span>
          </div>
          <ChevronRight
            size={ICON_SIZE.sm}
            strokeWidth={ICON_STROKE}
            className="flex-none text-text-muted"
          />
        </button>
        <Button
          variant="outline"
          size="sm"
          className="flex-none"
          onClick={() => setProposing((value) => !value)}
          aria-pressed={proposing}
        >
          Propor passos
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
    </div>
  )
}

export default DatasetCard
