import { useState } from 'react'
import Button from '../../shared/ui/Button/Button'
import Dialog from '../../shared/ui/Dialog/Dialog'
import Field from '../../shared/ui/Field/Field'
import { useSettings } from './settingsContext'
import styles from './Settings.module.css'

/*
 * Settings is a detour, not a destination (D13.8). It is opened because of what
 * you are already doing — "the model is slow, let me drop the threads" — and
 * you come back to the exact same place. A navigation destination would UNMOUNT
 * the conversation; a modal keeps it visible behind, and "I did not lose my
 * place" stops being something to trust and becomes something you can see.
 *
 * Since plano 14 the value survives the close: it lives in app_settings, in the
 * same database as the conversations (D14.7).
 *
 * The trigger and the dialog live together because the open state is theirs and
 * nothing else reads it. The dialog is a SIBLING in the tree, never a
 * replacement — that is what makes a reply keep streaming behind it.
 */

/*
 * The field keeps its own text, and that is not ceremony. Clamping on every
 * keystroke means clearing the field snaps it to 1, so a user who clears it and
 * types "2" ends up with 12 — found by the level-2 test, and it would have
 * shipped. The text is free to be empty or half-typed; only a value that parses
 * is committed, and blur puts the committed value back on screen.
 */
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
        className={styles.number}
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
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Configurações
      </Button>
      <Dialog open={open} title="Configurações" onClose={() => setOpen(false)}>
        <p className={styles.scope}>
          Ajustes desta máquina. Valem para todas as conversas e não mudam o que o modelo responde.
        </p>
        {/*
         * Two conditions, and both are load-bearing since plano 14. `open`,
         * because <dialog> keeps its children in the DOM when closed, so the
         * field's initial useState would otherwise run at boot. `loaded`,
         * because that initial useState copies the value — mounting before the
         * database answered would freeze the DEFAULT into the field and show a
         * number that is simply not the one in storage, with nothing on screen
         * suggesting anything is wrong.
         */}
        {open && loaded && <ThreadsField />}
      </Dialog>
    </>
  )
}

export default Settings
