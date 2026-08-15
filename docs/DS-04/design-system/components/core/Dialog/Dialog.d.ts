/**
 * Dialog — native `<dialog>` + `showModal()`, zero dependency. Gives a top
 * layer, a focus trap, Esc-to-close, focus returned to the trigger, and a
 * stylable `::backdrop` — all from the platform. `closedby="any"` closes on
 * an outside click with no handler of your own. Settings is a Dialog, not a
 * route, so the conversation behind it never unmounts.
 * @startingPoint section="Components" subtitle="Native <dialog>, focus trap + Esc for free" viewport="700x260"
 */
export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}
