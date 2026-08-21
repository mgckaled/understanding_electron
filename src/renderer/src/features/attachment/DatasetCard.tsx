import { useState } from 'react'
import { ChevronDown, ChevronUp, Paperclip } from 'lucide-react'
import type { DatasetPart } from '@shared/ipc'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import Button from '../../shared/ui/Button/Button'
import DatasetPreview from './DatasetPreview'
import DatasetQueryPanel from './DatasetQueryPanel'

// What plano 16 draws in the transcript for a dataset attachment (D16.4 Passo
// 4) — schema and row count only, the same fields the model itself reads
// (core/ai/dataCard.ts). Never the card's SENT text: this is chrome, read at
// a glance, not the payload. The disclosure below (D18B.5) copies the form
// DocumentCard already has (useState + conditional render), not extracted:
// this is the second occurrence, and the régua dos três reserves extraction
// for the third (18-D). Consultar swaps the automatic preview for the custom
// SQL panel — the two never render a table at once, or the default query
// duplicates the rows already shown above it (post-18-C fix, see HISTORY.md).
function DatasetCard({ part }: { part: DatasetPart }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

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
          variant="ghost"
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
      {expanded ? <DatasetQueryPanel hash={part.hash} /> : <DatasetPreview part={part} />}
    </div>
  )
}

export default DatasetCard
