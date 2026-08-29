import { Suspense, lazy, useState } from 'react'
import { Telescope } from 'lucide-react'
import Button from '../../shared/ui/Button/Button'
import Dialog from '../../shared/ui/Dialog/Dialog'
import { ICON_SIZE, ICON_STROKE } from '../../shared/ui/icon'
import StateView from '../../shared/ui/StateView'

// Trigger and dialog together, with no provider: which panel is open is read by
// nobody outside the modal (DO1.1).

// The whole module behind one import(), not one per panel (DO1.3): once the
// modal is open the user moves between panels, and a fallback per click is
// worse than one on opening. `lazy` memoises after the first load, so reopening
// never shows it again.
const ObservatoryShell = lazy(() => import('./ObservatoryShell'))

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
            reads would fire at boot without this gate. Suspense sits here and
            not around the trigger, which has to render always. */}
        {open && (
          <Suspense fallback={<StateView state={{ status: 'loading' }} render={() => null} />}>
            <ObservatoryShell />
          </Suspense>
        )}
      </Dialog>
    </>
  )
}

export default Observatory
