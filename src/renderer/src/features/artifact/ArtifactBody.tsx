import { useState } from 'react'
import MarkdownMessage from '../../shared/ui/MarkdownMessage/MarkdownMessage'
import type { ArtifactRef } from './artifactContext'

const EMPTY = 'text-reading text-text-muted'

function ImageBody({ hash, fileName }: { hash: string; fileName: string }): React.JSX.Element {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <p className={EMPTY}>Não foi possível carregar esta imagem.</p>
  }
  return (
    <img
      src={`attachment://${hash}`}
      alt={fileName}
      onError={() => setFailed(true)}
      className="mx-auto max-w-full rounded-lg border border-border object-contain"
    />
  )
}

// Dispatches on `kind`, the same shape AttachmentCard already uses for the
// transcript. The slot may render asynchronously (DF3A.3) even though neither
// of today's two inhabitants needs to: a dataset body is paged and can fail,
// and a contract shaped around the synchronous cases would break in F-3-C.
function ArtifactBody({ artifact }: { artifact: ArtifactRef }): React.JSX.Element {
  switch (artifact.kind) {
    case 'document': {
      const { text, format } = artifact.part
      if (text.trim() === '') {
        return <p className={EMPTY}>Este arquivo não tem texto extraído.</p>
      }
      if (format === 'md') return <MarkdownMessage text={text} />
      return <p className="text-reading leading-normal whitespace-pre-wrap text-text">{text}</p>
    }
    case 'image':
      return <ImageBody hash={artifact.part.hash} fileName={artifact.part.fileName} />
  }
}

export default ArtifactBody
