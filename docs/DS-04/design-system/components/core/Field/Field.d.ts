/**
 * Field — label + hint/error wrapper for a single form control. Clones its
 * child to inject `id`/`aria-describedby`, so it is agnostic to the control
 * type (input, select, textarea). Renders hint XOR error, never both.
 * @startingPoint section="Components" subtitle="Label + hint/error wrapper, clones its child" viewport="700x160"
 */
export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** A single form control element — receives id + aria-describedby via cloneElement. */
  children: React.ReactElement;
}
