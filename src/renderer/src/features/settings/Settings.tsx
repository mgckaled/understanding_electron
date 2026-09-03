import { useId, useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import type { Theme } from '@shared/ipc'
import Button from '../../shared/ui/Button/Button'
import Dialog from '../../shared/ui/Dialog/Dialog'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import SegmentedField from '../../shared/ui/SegmentedField/SegmentedField'
import { useSettings } from './settingsContext'
import CloudSecrets from './CloudSecrets'

// Settings is a detour, not a destination (D13.8): a navigation destination would
// UNMOUNT the conversation, but this modal keeps it visible behind, so a reply
// keeps streaming. The trigger and dialog live together because the open state is
// theirs alone, and the dialog is a SIBLING in the tree, never a replacement.

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' }
]

// A third option the prototype never needed (it had no OS to follow): without
// it, choosing Claro/Escuro once would leave no way back to "segue o sistema".
function ThemeField(): React.JSX.Element {
  const { settings, setSettings } = useSettings()

  return (
    <SegmentedField
      label="Aparência"
      options={THEME_OPTIONS}
      value={settings.theme}
      onChange={(theme) => setSettings((previous) => ({ ...previous, theme }))}
    />
  )
}

const THREAD_OPTIONS = [2, 4, 6].map((value) => ({ value, label: String(value) }))

function ThreadsField(): React.JSX.Element {
  const { settings, setSettings } = useSettings()

  return (
    <SegmentedField
      label="Threads de CPU"
      hint="Núcleos que o Ollama pode usar nesta máquina."
      options={THREAD_OPTIONS}
      // No option marks active when a value predates this control (any positive
      // integer used to be reachable) — silently rounding it would change a
      // persisted setting the user never asked to change.
      value={settings.numThread}
      onChange={(numThread) => setSettings((previous) => ({ ...previous, numThread }))}
    />
  )
}

const RETENTION_OPTIONS = [7, 30, 90].map((value) => ({ value, label: `${value} dias` }))

function RetentionField(): React.JSX.Element {
  const { settings, setSettings } = useSettings()

  return (
    <SegmentedField
      label="Retenção do Observatório"
      hint="Dados do Observatório mais antigos que isso são apagados automaticamente, sem recuperação."
      options={RETENTION_OPTIONS}
      value={settings.eventRetentionDays ?? 30}
      onChange={(eventRetentionDays) =>
        setSettings((previous) => ({ ...previous, eventRetentionDays }))
      }
    />
  )
}

function Settings(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { loaded } = useSettings()
  const descriptionId = useId()

  return (
    <>
      {/* The gear now lives in the sidebar footer, next to the Ollama status
          (DS-3): an icon trigger, not the labelled button it was in the nav.
          shape="square" (DS-5 fixup): an icon-only button reads as a hover
          box around the icon, not a wide rectangle sized for text. size="lg"
          (34px), not "md" — the lg icon (26px, DS5 item 1: notably bigger
          than its sm/md neighbours) needs the taller control for real padding. */}
      <Button
        variant="ghost"
        size="lg"
        shape="square"
        onClick={() => setOpen(true)}
        aria-label="Configurações"
      >
        <SettingsIcon size={ICON_SIZE.lg} strokeWidth={ICON_STROKE} />
      </Button>
      <Dialog
        open={open}
        title="Configurações"
        onClose={() => setOpen(false)}
        describedBy={descriptionId}
      >
        <p className="mb-6 text-xs text-text-muted" id={descriptionId}>
          Ajustes desta máquina. Valem para todas as conversas e não mudam o que o modelo responde.
        </p>
        {/* Both conditions load-bearing: `open`, because <dialog> keeps children
            in the DOM when closed, so the field's initial useState would run at
            boot; `loaded`, because that useState copies the value, and mounting
            before the DB answered would freeze the DEFAULT into the field. */}
        {open && loaded && (
          <div className="mb-7">
            <ThemeField />
          </div>
        )}
        {open && loaded && <ThreadsField />}
        {open && loaded && (
          <div className="mt-7">
            <RetentionField />
          </div>
        )}
        {/* secrets:has fires on mount, and <dialog> keeps closed children
            mounted (DN1A.3, passo 6). */}
        {open && <CloudSecrets />}
      </Dialog>
    </>
  )
}

export default Settings
