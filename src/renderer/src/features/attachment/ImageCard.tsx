import { useState } from 'react'
import { ChevronDown, ChevronUp, Image } from 'lucide-react'
import type { ImagePart } from '@shared/ipc'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toUpperCase()
}

// What plano 17 draws in the transcript for an image attachment — collapsed
// by default, same header shape as DocumentCard (D17.9): icon, filename,
// format badge, chevron. A click reveals the actual bytes, loaded through the
// `attachment://` protocol (D17.6) — an image carries no bytes on the part
// itself (D17.2), only a hash, so there is nothing to show before that click
// resolves. The badge reads the ORIGINAL extension from `fileName`, not
// `mimeType`: SVG/WebP normalize to PNG on disk (D17.7), and showing "PNG"
// for a file the user picked as .svg would misstate what was attached.
function ImageCard({ part }: { part: ImagePart }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex max-w-[80%] flex-col gap-3 rounded-lg border border-border bg-surface-raised px-5 py-4 text-text">
      <button
        type="button"
        className="flex cursor-pointer items-center gap-3 text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <Image
          size={ICON_SIZE.md}
          strokeWidth={ICON_STROKE}
          className="flex-none text-text-muted"
        />
        <div className="flex min-w-[0px] flex-1 flex-col gap-1">
          <span className="overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap">
            {part.fileName}
          </span>
          <span className="text-xs text-text-muted">{extensionOf(part.fileName)}</span>
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
        <div className="border-t border-border pt-3">
          <img
            src={`attachment://${part.hash}`}
            alt={part.fileName}
            className="max-h-[280px] max-w-full rounded-lg border border-border object-contain"
          />
        </div>
      )}
    </div>
  )
}

export default ImageCard
