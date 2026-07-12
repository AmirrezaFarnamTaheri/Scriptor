import { spawn } from 'node:child_process'

const host = '127.0.0.1'
const port = 4173
const url = `http://${host}:${port}`
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const run = (args, stdio = 'inherit') =>
  spawn(pnpm, args, { stdio, windowsHide: true })

const exited = (child, label) =>
  new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`${label} terminated by ${signal}`))
      else if (code === 0) resolve()
      else reject(new Error(`${label} exited with code ${code}`))
    })
  })

async function waitForReady() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Vite preview did not become ready at ${url}`)
}

const preview = run(['exec', 'vite', 'preview', '--host', host, '--port', String(port), '--strictPort'])
let previewExited = false
preview.once('exit', () => {
  previewExited = true
})

try {
  await waitForReady()
  if (previewExited) throw new Error('Vite preview exited before becoming ready')

  const axe = run([
    'exec',
    'axe',
    url,
    '--tags',
    'wcag2a,wcag2aa,wcag21aa',
    '--exit',
    '--chrome-options=no-sandbox,headless,disable-dev-shm-usage',
  ])
  await exited(axe, 'axe accessibility audit')
} finally {
  if (!previewExited) preview.kill('SIGTERM')
}
