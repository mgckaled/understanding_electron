/**
 * Shared sizing for lucide-react icons (DS5.1). A plain TS constant, not a CSS
 * token: the value feeds the `size`/`strokeWidth` numeric props of an icon
 * component, never a CSS declaration a selector resolves — unlike `--space-*`
 * or `--font-size-*`, there is no `var()` consumer to keep in sync.
 */
// +2px across the board (DS-5 fixup) — read small next to the chrome type
// bump the same plan already made (Fase 4).
export const ICON_SIZE = { sm: 16, md: 18, lg: 26 } as const

/**
 * Thinner than lucide-react's own default (2), to match the flat, shadow-free,
 * gradient-free surface the design-system skill already describes.
 */
export const ICON_STROKE = 1.75
