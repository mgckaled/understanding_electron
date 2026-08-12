Panel — bordered card surface with an optional header (title + trailing actions).

```jsx
<Panel title="Modelos em memória" actions={<Button variant="ghost" size="sm">Recarregar</Button>}>
  <p>Conteúdo do painel.</p>
</Panel>
```

Skip Panel inside the sidebar or any region the shell already gives a surface to — the sidebar's `background: var(--color-surface)` already supplies the boundary, so a Panel there would be a border inside a border (see `OpenDatasetPanel`, which uses a plain `<section>` for this reason).
