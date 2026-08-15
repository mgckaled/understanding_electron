Button — the single clickable primitive in crivo. Use it for every button in the app instead of a bare `<button>`.

```jsx
<Button variant="primary" onClick={send}>Enviar</Button>
<Button variant="secondary">Cancelar</Button>
<Button variant="ghost" size="sm" aria-label="Fechar">×</Button>
<Button variant="danger">Excluir</Button>
<Button variant="primary" loading>Enviando…</Button>
```

Variants: `primary` (the one accent CTA per view — send, save), `secondary` (default, most buttons), `ghost` (icon-only chrome — sidebar collapse, row actions, dialog close), `danger` (destructive, e.g. delete conversation). Sizes: `sm` (24px, dense rows), `md` (28px, default), `lg` (34px, rare). `loading` hides the label via `visibility` (not `color`) so the spinner inherits the variant's `currentColor` without a dedicated colour per variant.
