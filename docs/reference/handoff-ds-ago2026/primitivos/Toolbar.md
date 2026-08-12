Toolbar — a row of buttons/controls with consistent gap. Use it instead of a bare flex div whenever laying out 2+ controls side by side (e.g. "Escolher arquivo" + "Cancelar" in the open-dataset panel).

```jsx
<Toolbar>
  <Button variant="primary">Escolher arquivo</Button>
  <Button variant="secondary">Cancelar</Button>
</Toolbar>
```
