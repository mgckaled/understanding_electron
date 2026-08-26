import { ChevronRight, Image } from 'lucide-react'
import type { ImagePart } from '@shared/ipc'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import { useArtifact } from '../artifact/artifactContext'

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toUpperCase()
}

// Same header shape as DocumentCard (D17.9) and, since DF3A.6, the same role:
// a trigger for the side panel, not a disclosure. The badge reads the ORIGINAL
// extension from `fileName`, not `mimeType`: SVG/WebP normalize to PNG on disk
// (D17.7), and showing "PNG" for a file the user picked as .svg would misstate
// what was attached.
//
// Second occurrence of this trigger shape, not extracted: the régua dos três
// reserves that for the third, which is the dataset card in F-3-C.
function ImageCard({ part }: { part: ImagePart }): React.JSX.Element {
  const { current, toggle } = useArtifact()
  const open = current?.id === part.hash

  return (
    <div
      className={`flex max-w-[80%] flex-col gap-3 rounded-lg border bg-surface-raised px-5 py-4 text-text ${
        open ? 'border-accent-text' : 'border-border'
      }`}
    >
      <button
        type="button"
        className="flex cursor-pointer items-center gap-3 text-left"
        onClick={(event) => toggle({ kind: 'image', id: part.hash, part }, event.currentTarget)}
        aria-current={open ? 'true' : undefined}
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
        <ChevronRight
          size={ICON_SIZE.sm}
          strokeWidth={ICON_STROKE}
          className="flex-none text-text-muted"
        />
      </button>
    </div>
  )
}

export default ImageCard
