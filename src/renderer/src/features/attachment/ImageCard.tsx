import type { ImagePart } from '@shared/ipc'

// What plano 17 draws in the transcript for an image attachment — the only
// card that loads its content through the `attachment://` protocol (D17.6)
// instead of data already inline in the part: an image carries no bytes on
// the part itself (D17.2), only a hash.
function ImageCard({ part }: { part: ImagePart }): React.JSX.Element {
  return (
    <img
      src={`attachment://${part.hash}`}
      alt={part.fileName}
      className="max-h-[280px] max-w-[80%] rounded-lg border border-border object-contain"
    />
  )
}

export default ImageCard
