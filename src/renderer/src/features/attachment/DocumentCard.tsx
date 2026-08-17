import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'
import type { DocumentPart } from '@shared/ipc'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import MarkdownMessage from '../../shared/ui/MarkdownMessage/MarkdownMessage'

// What plano 17 draws in the transcript for a document attachment (D17.9) —
// same visual weight as DatasetCard by default; a click expands the
// extracted text at reading density. Markdown-rendered when the source is
// .md, since the model reads the same raw markdown either way.
function DocumentCard({ part }: { part: DocumentPart }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex max-w-[80%] flex-col gap-3 rounded-lg border border-border bg-surface-raised px-5 py-4 text-text">
      <button
        type="button"
        className="flex cursor-pointer items-center gap-3 text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <FileText
          size={ICON_SIZE.md}
          strokeWidth={ICON_STROKE}
          className="flex-none text-text-muted"
        />
        <div className="flex min-w-[0px] flex-1 flex-col gap-1">
          <span className="overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap">
            {part.fileName}
          </span>
          <span className="text-xs text-text-muted">{part.format.toUpperCase()}</span>
        </div>
        {expanded ? (
          <ChevronUp
            size={ICON_SIZE.sm}
            strokeWidth={ICON_STROKE}
            className="flex-none text-text-muted"
          />
        ) : (
          <ChevronDown
            size={ICON_SIZE.sm}
            strokeWidth={ICON_STROKE}
            className="flex-none text-text-muted"
          />
        )}
      </button>
      {expanded && (
        <div className="max-h-[400px] overflow-y-auto border-t border-border pt-3 text-reading leading-normal select-text">
          {part.format === 'md' ? (
            <MarkdownMessage text={part.text} />
          ) : (
            <p className="whitespace-pre-wrap">{part.text}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default DocumentCard
