import { spawn } from 'node:child_process'

const host = '127.0.0.1'
const port = 4173
const url = `http://${host}:${port}`
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

function spawnCommand(args, options = {}) {
  return spawn(pnpm, args, {
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  })
}

async function waitForReady(target, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(target, { redirect: 'manual' })
      if (response.ok || (response.status >= 300 && response.status < 400)) return
      lastError = new Error(`preview returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Vite preview did not become ready at ${target}: ${lastError ?? 'timeout'}`)
}

function waitForExit(child, label) {
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${label} terminated