// Order matters once base.css joins @layer base (DS-1 step 2): tailwind.css
// carries the @layer declaration, and it has to come first.
import './shared/ui/tokens.css'
import './assets/tailwind.css'
import './assets/base.css'
// Self-hosted (DS5.2) — bundled by Vite, no network request at runtime.
// latin-400, not the plain 400 (which pulls every subset, including
// greek/cyrillic/vietnamese small enough for Vite to inline as data: URIs —
// blocked live by `default-src 'self'`, confirmed via console errors this
// session). latin covers Latin-1 Supplement (U+00A0-00FF), which is where
// every Portuguese diacritic (ã, ç, õ, á, é...) already lives.
import '@fontsource/jetbrains-mono/latin-400.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
