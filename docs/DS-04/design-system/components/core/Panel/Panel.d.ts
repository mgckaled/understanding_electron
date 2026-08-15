/**
 * Panel — bordered surface with an optional header (title + actions). The
 * generic "card" container for anything that needs a boundary and isn't
 * already inside the shell's own chrome (sidebar sections skip Panel — see
 * OpenDatasetPanel in the UI kit — to avoid a border inside a border).
 * @startingPoint section="Components" subtitle="Bordered surface, optional header + actions" viewport="700x200"
 */
export interface PanelProps {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}
