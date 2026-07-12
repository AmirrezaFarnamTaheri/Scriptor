import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/monaco-environment.ts'
import './index.css'
import { AccessibilitySemantics } from './components/AccessibilitySemantics'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './App.tsx'

function applyInitialTheme() {
  const stored = window.localStorage.getItem('scriptor:app-theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme =
    stored === 'dark' || stored === 'light' || stored === 'high-contrast'
      ? stored
      : prefersDark
        ? 'dark'
        : 'light'
}

async function mountApp() {
  applyInitialTheme()
  console.log('--- STARTING SCRIPTOR APP ---')
  console.log('VITE_E2E_MODE:', import.meta.env.VITE_E2E_MODE)
  console.log('VITE_SCREENSHOT_MODE:', import.meta.env.VITE_SCREENSHOT_MODE)
  if (import.meta.env.VITE_E2E_MODE === 'true') {
    const { installE2eBridge } = await import('./e2e/bootstrap.ts')
    installE2eBridge()
  } else if (import.meta.env.VITE_SCREENSHOT_MODE === 'true') {
    const { installScreenshotBridge } = await import('./screenshot/bootstrap.ts')
    installScreenshotBridge()
  }

  const fixtureMode =
    import.meta.env.VITE_E2E_MODE === 'true' || import.meta.env.VITE_SCREENSHOT_MODE === 'true'
  const app = (
    <ErrorBoundary name="app-root">
      <AccessibilitySemantics />
      {fixtureMode ? <App /> : (
        <StrictMode>
          <App />
        </StrictMode>
      )}
    </ErrorBoundary>
  )

  createRoot(document.getElementById('root')!).render(app)
}

void mountApp()
