import type { AttachmentPart } from '@shared/ipc'
import DatasetCard from './DatasetCard'
import DocumentCard from './DocumentCard'
import ImageCard from './ImageCard'

// Dispatches to the card for this attachment's kind (D17.4) — ConversationView
// draws one element regardless of how many kinds AttachmentPart carries.
function AttachmentCard({ part }: { part: AttachmentPart }): React.JSX.Element {
  switch (part.kind) {
    case 'dataset':
      return <DatasetCard part={part} />
    case 'document':
      return <DocumentCard part={part} />
    case 'image':
      return <ImageCard part={part} />
  }
}

export default AttachmentCard
