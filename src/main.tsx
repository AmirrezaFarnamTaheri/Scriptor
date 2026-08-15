import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AccessibilitySemantics } from './components/AccessibilitySemantics'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './App.tsx'
import { I18nProvider } from './lib/i18n/I18nProvider.tsx'
import { PluginStateProvider } from './context/PluginStateContext.tsx'

function applyInitialTheme() {
  const stored = window.localStorage.getItem('scriptor:app-theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme =
    stored && typeof stored === 'string'
      ? stored
      : prefersDark
        ? 'dark'
        : 'light'
}

async function mountApp() {
  applyInitialTheme()
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
      <I18nProvider>
        <PluginStateProvider>
          {fixtureMode ? <App /> : (
            <StrictMode>
              <App />
            </StrictMode>
          )}
        </PluginStateProvider>
      </I18nProvider>
    </ErrorBoundary>
  )

  createRoot(document.getElementById('root')!).render(app)
}

void mountApp()
