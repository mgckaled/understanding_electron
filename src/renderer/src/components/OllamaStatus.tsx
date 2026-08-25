import { useId, useState } from 'react'
import { useAiAvailability } from '../features/conversation/useAiAvailability'
import Popover from '../shared/ui/Popover/Popover'
import { toAnchorName } from '../shared/ui/Popover/anchorName'

// The sidebar footer's service indicator (D13.7 area): a coloured dot for
// whether Ollama answers, with its version. It shares the mount probe with the
// conversation view through useAiAvailability. The dot is a boot snapshot — the
// app has only ever checked availability once, at startup, and the reload button
// covers models and memory, never this. No Panel: the footer supplies the surface.
function OllamaStatus(): React.JSX.Element {
  const { state: availability } = useAiAvailability('ollama')
  const [open, setOpen] = useState(false)
  const anchorName = toAnchorName(useId())

  if (availability.status === 'ready') {
    return (
      <div className="flex items-center gap-3">
        <span className="h-[8px] w-[8px] flex-none rounded-full bg-ok" aria-hidden="true" />
        <button
          type="button"
          className="cursor-pointer bg-transparent p-[0px] font-ui text-text"
          style={{ anchorName }}
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          Ollama v{availability.data.version}
        </button>
        <Popover
          open={open}
          onClose={() => setOpen(false)}
          anchorName={anchorName}
          className="flex flex-col gap-1 px-2 py-1"
        >
          <span className="text-2xs text-text-faint">Conectado</span>
          {availability.data.host !== undefined && (
            <span className="font-mono text-xs text-text">{availability.data.host}</span>
          )}
        </Popover>
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
