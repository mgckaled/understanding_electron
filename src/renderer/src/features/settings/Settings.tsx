import { useState } from 'react'
import Button from '../../shared/ui/Button/Button'
import Dialog from '../../shared/ui/Dialog/Dialog'
import Field from '../../shared/ui/Field/Field'
import Versions from '../../components/Versions'
import { useSettings } from './settingsContext'
import LoadedModels from './LoadedModels'

// Settings is a detour, not a destination (D13.8): a navigation destination would
// UNMOUNT the conversation, but this modal keeps it visible behind, so a reply
// keeps streaming. The trigger and dialog live together because the open state is
// theirs alone, and the dialog is a SIBLING in the tree, never a replacement.

// The field keeps its own text: clamping on every keystroke makes clearing it
// snap to 1, so clearing and typing "2" yields 12 (caught by the level-2 test).
// Only a value that parses is committed; blur puts the committed value back.
function ThreadsField(): React.JSX.Element {
  const { settings, setSettings } = useSettings()
  const [text, setText] = useState(String(settings.numThread))

  const change = (raw: string): void => {
    setText(raw)
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed >= 1) {
      setSettings((previous) => ({ ...previous, numThread: parsed }))
    }
  }

  return (
    <Field label="Threads de CPU" hint="Núcleos que o Ollama pode usar nesta máquina.">
      <input
        className="w-[96px] rounded-md border border-border bg-surface-sunken px-4 py-3 font-ui text-sm text-text focus-visible:border-accent-text focus-visible:outline-none"
        type="number"
        min={1}
        value={text}
        onChange={(event) => change(event.target.value)}
        onBlur={() => setText(String(settings.numThread))}
      />
    </Field>
  )
}

function Settings(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { loaded } = useSettings()

  return (
    <>
      {/* The gear now lives in the sidebar footer, next to the Ollama status
          (DS-3): an icon trigger, not the labelled button it was in the nav. */}
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Configurações">
        <span aria-hidden="true">⚙</span>
      </Button>
      <Dialog open={open} title="Configurações" onClose={() => setOpen(false)}>
        <p className="mb-6 text-xs text-text-muted">
          Ajustes desta máquina. Valem para todas as conversas e não mudam o que o modelo responde.
        </p>
        {/* Both conditions load-bearing: `open`, because <dialog> keeps children
            in the DOM when closed, so the field's initial useState would run at
            boot; `loaded`, because that useState copies the value, and mounting
            before the DB answered would freeze the DEFAULT into the field. */}
        {open && loaded && <ThreadsField />}
        {/* Only while open: its query refetches on mount, and mounting it with
            the modal closed would poll the provider from boot onwards. */}
        {open && <LoadedModels />}
        {/* The build versions moved here from the sidebar footer, which the DS-3
            target gives to the Ollama status. Gated on `open` so app:info does
            not fetch at boot. */}
        {open && (
          <div className="mt-6 border-t border-border pt-5">
            <Versions />
          </div>
        )}
      </Dialog>
    </>
  )
}

export default Settings
