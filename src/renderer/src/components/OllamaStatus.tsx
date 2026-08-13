import { useAiAvailability } from '../features/conversation/useAiAvailability'

// The sidebar footer's service indicator (D13.7 area): a coloured dot for
// whether Ollama answers, with its version. It shares the mount probe with the
// conversation view through useAiAvailability. The dot is a boot snapshot — the
// app has only ever checked availability once, at startup, and the reload button
// covers models and memory, never this. No Panel: the footer supplies the surface.
function OllamaStatus(): React.JSX.Element {
  const availability = useAiAvailability()

  if (availability.status === 'ready') {
    return (
      <div className="flex items-center gap-3">
        <span className="h-[8px] w-[8px] flex-none rounded-full bg-ok" aria-hidden="true" />
        <span>Ollama v{availability.data.version}</span>
      </div>
    )
  }

  if (availability.status === 'error') {
    return (
      <div className="flex items-center gap-3 text-warn-text">
        <span className="h-[8px] w-[8px] flex-none rounded-full bg-danger" aria-hidden="true" />
        <span>Ollama indisponível</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="h-[8px] w-[8px] flex-none rounded-full bg-text-faint" aria-hidden="true" />
      <span>Verificando o Ollama…</span>
    </div>
  )
}

export default OllamaStatus
