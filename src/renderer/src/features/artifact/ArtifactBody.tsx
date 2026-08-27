import { useState } from 'react'
import MarkdownMessage from '../../shared/ui/MarkdownMessage/MarkdownMessage'
import ArtifactDataset from './ArtifactDataset'
import type { ArtifactRef } from './artifactContext'

const EMPTY = 'text-reading text-text-muted'

// Reading density and one scrolling surface (D13.5). A dataset does NOT use
// it: its tab strip and pager stay put while only the rows scroll, so it takes
// the whole region and divides it itself.
const READING = 'min-h-[0px] flex-1 overflow-y-auto p-7 select-text'

function Reading({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className={READING}>{children}</div>
}

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

// Dispatches on `kind`, the same shape AttachmentCard uses for the transcript.
// The dataset body is the asynchronous case DF3A.3 shaped this slot against.
function ArtifactBody({ artifact }: { artifact: ArtifactRef }): React.JSX.Element {
  switch (artifact.kind) {
    case 'document': {
      const { text, format } = artifact.part
      if (text.trim() === '') {
        return (
          <Reading>
            <p className={EMPTY}>Este arquivo não tem texto extraído.</p>
          </Reading>
        )
      }
      return (
        <Reading>
          {format === 'md' ? (
            <MarkdownMessage text={text} />
          ) : (
            <p className="text-reading leading-normal whitespace-pre-wrap text-text">{text}</p>
          )}
        </Reading>
      )
    }
    case 'image':
      return (
        <Reading>
          <ImageBody hash={artifact.part.hash} fileName={artifact.part.fileName} />
        </Reading>
      )
    case 'dataset':
      return <ArtifactDataset part={artifact.part} />
  }
}

export default ArtifactBody
