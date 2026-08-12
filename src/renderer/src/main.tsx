// Order matters once base.css joins @layer base (DS-1 step 2): tailwind.css
// carries the @layer declaration, and it has to come first.
import './shared/ui/tokens.css'
import './assets/tailwind.css'
import './assets/base.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
