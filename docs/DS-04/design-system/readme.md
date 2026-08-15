# crivo — design system

Extracted from the real codebase: [`mgckaled/understanding_electron`](https://github.com/mgckaled/understanding_electron), branch `main` (see `github.md` at the project root for the sync record). Every token, primitive and screen here is copied or ported from `src/renderer/src/` — nothing here is invented, except where flagged below.

## What crivo is
A local desktop app (Electron 42 + React 19 + TypeScript) that lets you clean and query data files (CSV, Excel, Parquet, JSON) by **conversing** with a local AI model (via [Ollama](https://ollama.com)) in Portuguese. Two verbs: **perguntar** (ask a question, get an answer) and **tratar** (clean the file, as an editable, reapplicable list of steps compiling to SQL — the data engine, DuckDB, is planned but not yet built). Documents and images can be attached as read-only context. Local-first: nothing leaves the machine unless the user opts into a cloud provider, and even then only schema/aggregate data is shared, never raw rows.

**Status when this was extracted (ago/2026):** the conversation shell — sidebar, conversation history, streaming replies, model switching, Settings dialog — is built and working. The data engine, dataset/document attachments, and AI-proposed queries/steps are still on the roadmap. This design system reflects **what ships today**; see the repo's `docs/ROADMAP.md` for what's next.

## Sources
- Repo: `github.com/mgckaled/understanding_electron` (branch `main`)
- Design tokens: `src/renderer/src/shared/ui/tokens.css`, `src/renderer/src/assets/base.css`
- Primitives: `src/renderer/src/shared/ui/{Button,Field,Panel,Toolbar,Dialog,StateView}`
- Screens: `src/renderer/src/app/` (shell, sidebar), `src/renderer/src/features/{conversation,settings,open-dataset}/`
- Design-system decisions and rationale: `.claude/skills/design-system/SKILL.md`, `docs/HISTORY.md`

## Content fundamentals
- **Language: Portuguese (pt-BR) in every user-facing string.** Code, identifiers, comments and file names stay in English — this is a hard rule in the repo's own `CLAUDE.md`, so a component ported from there keeps English internals even inside this Portuguese-speaking product.
- **Direct, unadorned tone.** No exclamation marks, no marketing voice. Error copy states the fact plainly: *"Não foi possível conectar ao Ollama"*, not *"Oops! Something went wrong."*
- **Never fail silently.** A recurring product principle: when something can't be done (context window exceeded, model uninstalled, model doesn't fit in free RAM), the interface says so with the specific reason and, where one exists, the way out — never a generic error, never a silent truncation.
- **No emoji, no icon-as-decoration.** The only pictographic marks in the UI are a handful of Unicode glyphs used as literal controls (« » to collapse/expand, ✎ to rename, × to close/delete, ↻ to reload) — see Iconography below.
- **Lowercase brand name.** "crivo", never "Crivo" or "CRIVO", in running text or UI.

## Visual foundations
- **Two densities, not one scale.** "Chrome" (sidebar, headers, composer controls, dialogs) uses a compact t-shirt scale topping out at 16px, sized to be scanned. The "reading" surface (the model's replies, the composer's own draft text) uses a separate 18px token — a model's answer is read for a minute straight, and 13px chrome-scale text is tiring at that length. This is the single most load-bearing type decision in the system: don't collapse the two scales into one.
- **Two-tier color tokens, always.** A primitive neutral scale (`--gray-1`…`--gray-13`) and colour primitives (`--blue-9`, `--red-9`…) that no component touches directly; components read only semantic aliases (`--color-surface`, `--color-accent`…). Every state colour (accent/danger/warn/ok) has three forms: a solid fill for backgrounds, an `-on-*` label colour for text on that fill, and a `-text` form for text/borders/icons directly on a surface. Never use the solid fill as a text colour or vice versa.
- **Theme follows the OS, with no manual switch.** `prefers-color-scheme` is the only theme control — a deliberate simplicity decision (persisting a manual choice and syncing it to the native shell was judged not worth its cost). Light theme redefines only the semantic layer, elevating toward white; primitives never change.
- **No shadows, no gradients.** Depth comes from a stepped neutral scale (surface → surface-raised → surface-sunken) and 1px borders, never `box-shadow` or a colour gradient. This is a flat, quiet, information-dense desktop tool, not a marketing surface.
- **Motion is minimal and fast.** Three duration tokens (120/200/320ms), used for hover/focus transitions and the sidebar's width collapse — never for entrances or attention-seeking effects. `prefers-reduced-motion` zeroes all of it globally.
- **Borders over shadows for elevation; radius is small and consistent.** 4–10px across the board (`--radius-sm/md/lg`), 9999px only for genuinely pill-shaped things (there are currently none in the shipped UI — no chip/badge/tag primitive exists yet).
- **System font stack — no bundled webfont.** `--font-ui` (Segoe UI Variable → system-ui fallback chain) for everything except code, `--font-mono` (Cascadia Code → system monospace fallback) for code, model names, hashes, and any technical/copyable string. A local desktop tool has no reason to ship a custom typeface.
- **Structural scroll.** The document itself never scrolls — the shell is a fixed-height grid, and each region (sidebar content, conversation thread) owns its own internal scroll. Never let content push the window taller.
- **Text selection is off by default.** Desktop apps aren't web pages: `user-select: none` at the root, with `.selectable`/inline `user-select: text` opted back in only for copyable data — the model's reply, a model name, a file hash.

## Iconography
**There is no icon library, no SVG icon set, and no icon font.** Every "icon" in the shipped app is a literal Unicode character rendered as plain text at the button's font size: `«`/`»` (sidebar collapse/expand), `✎` (rename), `×` (delete, dialog close), `↻` (reload model list). This is a deliberate minimalism, not a placeholder — do not introduce Lucide, Phosphor, or any SVG icon set into this system without a real product decision to do so; it would be a genuine visual language change, not a like-for-like swap.

## Index
- `styles.css` — the single global-CSS entry point (imports everything under `tokens/`).
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `layout.css`, `motion.css`, `base.css` (resets + focus-visible + scrollbar).
- `components/core/` — `Button`, `Field`, `Panel`, `Toolbar`, `Dialog`, `StateView`. Each has `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md`, and a `*.card.html` demo.
- `guidelines/` — foundation specimen cards: color primitives/semantic/syntax, type scale/faces, spacing/radius/control-height scales, sidebar widths, brand mark.
- `ui_kits/crivo/` — the full conversational shell as a click-through: sidebar (new conversation, conversation list, open-dataset panel, footer), conversation view (model selector, thread, composer with context-budget meter), Settings dialog (CPU threads, loaded models).
- `assets/` — `logo-monogram.svg`, `app-icon.png`.
- `SKILL.md` — portable skill file for using this system in Claude Code.

## Intentional additions
None. Every primitive and token here has a direct source in the codebase. Where the real component's TypeScript/CSS Modules implementation was simplified for this system (inline styles instead of CSS Modules, no `cloneElement`-based ref forwarding beyond what's shown), that's noted in the component's own `.prompt.md`.

## Caveats
- Real `AppError`/`ViewState<T>` types weren't copied verbatim (they depend on the app's IPC contract, `src/shared/ipc.ts`, which wasn't read for this extraction) — `StateView` here uses a simplified inline shape. Pull the exact contract from `src/shared/ipc.ts` before wiring this into production code.
- `ModelSelector`, `Composer`'s context-budget gate, and `MarkdownMessage`'s syntax highlighting were read in full but not ported as standalone reusable components — they're deeply tied to the app's Ollama/IPC logic (`@core/ai/budget`, `useConversationChat`). The `ui_kits/crivo` recreation mocks their visuals with local state instead.
- No component for a chip/pill/tag/badge exists in the real app yet — don't add one speculatively.
