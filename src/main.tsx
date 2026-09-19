import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './App.tsx'
import { I18nProvider } from './lib/i18n/I18nProvider.tsx'
import { PluginStateProvider } from './context/PluginStateContext.tsx'
import { applyThemeToElement, nativeAppearanceForTheme, resolveAppearance, validateStoredTheme, type AppearanceMode } from './hooks/useAppTheme.ts'

function applyInitialTheme() {
  const rawTheme = window.localStorage.getItem('scriptor:app-theme')
  const rawAppearance = window.localStorage.getItem('scriptor:appearance-mode')
  const storedPalette = validateStoredTheme(rawTheme)
  const palette = storedPalette ?? 'dark'
  const appearance: AppearanceMode =
    rawAppearance === 'light' || rawAppearance === 'dark' || rawAppearance === 'system'
      ? rawAppearance
      : storedPalette
        ? nativeAppearanceForTheme(storedPalette)
        : 'system'
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  applyThemeToElement(document.documentElement, palette, resolveAppearance(appearance, systemDark))
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
