StateView — the one place every async list/panel in the app renders its state. Wrap any data fetch in a `ViewState<T>` and hand it to StateView instead of writing a new if/else for loading/empty/error.

```jsx
<StateView
  state={modelsState}
  emptyMessage="Nenhum modelo instalado."
  render={(models) => <ModelList models={models} />}
/>
```

`loading` shows a determinate `<progress>` when `progress.total` is known, indeterminate otherwise. `error` reads a message off the app's `AppError` registry (see `messages.ts` in the real codebase) rather than showing a raw exception.
