#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const distIndex = join(root, 'dist/index.html')
const cssPath = join(root, 'src/index.css')
const appPath = join(root, 'src/App.tsx')
const failures = []

process.chdir(root)

if (!existsSync(distIndex)) {
  console.log('Building frontend for a11y smoke...')
  execSync('pnpm build', { stdio: 'inherit' })
}

const html = readFileSync(distIndex, 'utf8')
if (!html.includes('id="root"')) failures.push('root mount')
if (!html.includes('<title>')) failures.push('document title')

if (existsSync(cssPath)) {
  const css = readFileSync(cssPath, 'utf8')
  for (const token of ['--focus-ring', '--focus-outline']) {
    if (!css.includes(token)) failures.push(`focus token ${token}`)
  }
} else {
  failures.push('index.css')
}

if (existsSync(appPath)) {
  const appSource = readFileSync(appPath, 'utf8')
  if (!appSource.includes('BRAND_WORKSPACE_LABEL')) failures.push('workspace landmark')
  if (!appSource.includes('role="status"')) failures.push('live status region')
} else {
  failures.push('App.tsx')
}

if (failures.length > 0) {
  console.error(`A11y smoke failed: missing ${failures.join(', ')}`)
  process.exit(1)
}

console.log('A11y smoke passed (static shell checks). See docs/validation/ACCESSIBILITY_AUDIT.md for manual sign-off.')
