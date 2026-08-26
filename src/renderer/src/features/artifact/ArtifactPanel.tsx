import { useArtifact } from './artifactContext'

// The width is a value, not a class: it comes from state (DF3A.4), and
// Tailwind's static scan cannot see a runtime number — the framework's own docs
// send complex sizing to `style` for exactly this. The clamp is what keeps the
// conversation readable: 50% is the user's ceiling, but on a narrow window the
// second term of the `min` wins and the panel yields instead.
const WIDTH = 'clamp(22rem, var(--artifact-width), min(50vw, 100vw - 32rem))'
const DEFAULT_WIDTH = '34rem'

function ArtifactPanel(): React.JSX.Element | null {
  const { current } = useArtifact()
  if (current === null) return null

  return (
    <aside
      className="flex h-full flex-col overflow-hidden border-l border-border bg-surface"
      style={{ '--artifact-width': DEFAULT_WIDTH, width: WIDTH } as React.CSSProperties}
      aria-label="Anexo aberto"
    >
      <p className="p-7 text-sm text-text">{current.part.fileName}</p>
    </aside>
  )
}

export default ArtifactPanel
