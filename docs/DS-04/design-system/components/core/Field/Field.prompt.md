Field — wraps a single input/select/textarea with a label and a hint or error line. Use for every labeled control in settings, forms, and dialogs.

```jsx
<Field label="Threads de CPU" hint="Núcleos que o Ollama pode usar nesta máquina.">
  <input type="number" min={1} />
</Field>

<Field label="Chave de API" error="Chave inválida.">
  <input type="password" />
</Field>
```

Notable: `children` must be a single valid element (Field clones it to attach `id` and `aria-describedby`) — never wrap plain text or a fragment. Hint and error are mutually exclusive: passing both renders only the error.
