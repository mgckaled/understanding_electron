/**
 * Button — the app's one clickable-affordance primitive. Four variants
 * (primary CTA, secondary default, ghost chrome-icon, danger destructive),
 * three sizes. Loading swaps the label for a spinner without resizing.
 * @startingPoint section="Components" subtitle="Primary, secondary, ghost, danger — 3 sizes" viewport="700x220"
 */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
}
