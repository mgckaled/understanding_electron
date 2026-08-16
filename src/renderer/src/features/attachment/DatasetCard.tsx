import { Paperclip } from 'lucide-react'
import type { DatasetPart } from '@shared/ipc'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'

// What plano 16 draws in the transcript for a dataset attachment (D16.4 Passo
// 4) — schema and row count only, the same fields the model itself reads
// (core/ai/dataCard.ts). Never the card's SENT text: this is chrome, read at
// a glance, not the payload.
function DatasetCard({ part }: { part: DatasetPart }): React.JSX.Element {
  return (
    <div className="flex max-w-[80%] items-center gap-3 rounded-lg border border-border bg-surface-raised px-5 py-4 text-text">
      <Paperclip
        size={ICON_SIZE.md}
        strokeWidth={ICON_STROKE}
        className="flex-none text-text-muted"
      />
      <div className="flex min-w-[0px] flex-col gap-1">
        <span className="overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap">
          {part.fileName}
        </span>
        <span className="text-xs text-text-muted">
          {part.columns.length} colunas · {part.rowCount.toLocaleString('pt-BR')} linhas
        </span>
      </div>
    </div>
  )
}

export default DatasetCard
