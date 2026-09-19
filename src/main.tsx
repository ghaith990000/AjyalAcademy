import '@/lib/zod-config' // first: it must run before any schema is built
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are served with the app (no third-party request, and they work offline): Cairo covers Arabic and Latin,
// Poppins the Latin headings.
import '@fontsource-variable/cairo/wght.css'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-800.css'
import '@/lib/i18n'
import '@/styles/index.css'
import App from '@/app/App'
import { AppErrorBoundary } from '@/app/AppErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
