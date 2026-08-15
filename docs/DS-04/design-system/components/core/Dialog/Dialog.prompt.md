Dialog — the app's only modal primitive, built on the native `<dialog>` element. Use it for any settings/confirmation surface that must sit on top of the current screen without unmounting it.

```jsx
const [open, setOpen] = React.useState(false);
<Button onClick={() => setOpen(true)}>Configurações</Button>
<Dialog open={open} title="Configurações" onClose={() => setOpen(false)}>
  <p>Conteúdo do modal.</p>
</Dialog>
```

Notable: the trigger button and the Dialog live together (same component) since the open state belongs only to them. Never a navigation route — a route unmounts what was on screen; Dialog is a sibling in the tree, so a streaming reply behind it keeps streaming.
