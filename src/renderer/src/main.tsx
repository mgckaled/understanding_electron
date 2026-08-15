// Order matters once base.css joins @layer base (DS-1 step 2): tailwind.css
// carries the @layer declaration, and it has to come first.
import './shared/ui/tokens.css'
import './assets/tailwind.css'
import './assets/base.css'
// Self-hosted (DS5.2) — bundled by Vite, no network request at runtime, no CSP
// change. Only 400 is imported: every --font-mono consumer in the app (code,
// host:porta, model name) renders at normal weight, never bold.
import '@fontsource/jetbrains-mono/400.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
