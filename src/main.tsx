import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/monaco-environment.ts'
import './index.css'
import App from './App.tsx'

function applyInitialTheme() {
  const stored = window.localStorage.getItem('scriptor:app-theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme =
    stored === 'dark' || stored === 'light' ? stored : prefersDark ? 'dark' : 'light'
}

async function mountApp() {
  applyInitialTheme()
  if (import.meta.env.VITE_SCREENSHOT_MODE === 'true') {
    const { installScreenshotBridge } = await import('./screenshot/bootstrap.ts')
    installScreenshotBridge()
  }

  const app = import.meta.env.VITE_SCREENSHOT_MODE === 'true' ? <App /> : (
    <StrictMode>
      <App />
    </StrictMode>
  )

  createRoot(document.getElementById('root')!).render(app)
}

void mountApp()
