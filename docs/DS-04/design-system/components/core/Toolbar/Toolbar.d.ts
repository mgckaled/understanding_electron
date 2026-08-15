/**
 * Toolbar — a plain horizontal flex row with the standard gap token. The
 * whole primitive is that one layout decision, kept in one place so every
 * button row in the app uses the same gap.
 * @startingPoint section="Components" subtitle="Horizontal row, standard gap" viewport="700x100"
 */
export interface ToolbarProps {
  children: React.ReactNode;
  className?: string;
}
