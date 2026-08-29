import { useState } from 'react'
import { Telescope } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import Dialog from '../../shared/ui/Dialog/Dialog'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import ObservatoryShell from './ObservatoryShell'

// Trigger and dialog together, with no provider: which panel is open is read by
// nobody outside the modal (DO1.1).

function Observatory(): React.JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="lg"
        shape="square"
        onClick={() => setOpen(true)}
        aria-label="Observatório"
      >
        <Telescope size={ICON_SIZE.lg} strokeWidth={ICON_STROKE} />
      </Button>
      <Dialog open={open} title="Observatório" size="wide" onClose={() => setOpen(false)}>
        {/* <dialog> keeps its children mounted when closed, so every panel's
            reads would fire at boot without this gate. */}
        {open && <ObservatoryShell />}
      </Dialog>
    </>
  )
}

export default Observatory
