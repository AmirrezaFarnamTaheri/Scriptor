#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const distIndex = join(root, 'dist/index.html')
const cssPath = join(root, 'src/index.css')
const appPath = join(root, 'src/App.tsx')
const graphPanelPath = join(root, 'src/components/GraphPanel.tsx')
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

if (existsSync(graphPanelPath)) {
  const graphSource = readFileSync(graphPanelPath, 'utf8')
  if (!graphSource.includes('role="application"')) failures.push('graph role=application')
  if (!graphSource.includes('onKeyDown')) failures.push('graph onKeyDown')
  if (!graphSource.includes('aria-live="polite"')) failures.push('graph aria-live region')
  if (!graphSource.includes('aria-label=')) failures.push('graph node aria-label')
  if (!graphSource.includes('graph-node-focus-ring')) failures.push('graph focus ring')
} else {
  failures.push('GraphPanel.tsx')
}

const buttonPath = join(root, 'src/components/Button.tsx')
const dialogPath = join(root, 'src/components/Dialog.tsx')
const inputPath = join(root, 'src/components/Input.tsx')

for (const [componentPath, componentName] of [
  [buttonPath, 'Button.tsx'],
  [dialogPath, 'Dialog.tsx'],
  [inputPath, 'Input.tsx'],
]) {
  if (existsSync(componentPath)) {
    const src = readFileSync(componentPath, 'utf8')
    if (!src.includes('aria-label') && !src.includes('aria-labelledby') && !src.includes('aria-describedby')) {
      failures.push(`${componentName} interactive aria-label`)
    }
  }
}

if (existsSync(cssPath)) {
  const cssContent = readFileSync(cssPath, 'utf8')
  const focusTokens = ['--focus-ring', '--focus-outline', '--focus-ring-color', '--focus-ring-width']
  const foundToken = focusTokens.some((token) => cssContent.includes(token))
  if (!foundToken) failures.push('focus ring CSS token (--focus-ring-*)')
}

const editorWorkspacePath = join(root, 'src/components/shell/EditorWorkspace.tsx')
const sidebarPath = join(root, 'src/components/Sidebar.tsx')
const toolbarPath = join(root, 'src/components/FormatToolbar.tsx')

if (existsSync(editorWorkspacePath)) {
  const editorSource = readFileSync(editorWorkspacePath, 'utf8')
  if (!editorSource.includes('aria-label="Editor"') && !editorSource.includes('aria-labelledby=')) {
    failures.push('editor workspace aria-label')
  }
} else {
  failures.push('EditorWorkspace.tsx')
}

if (existsSync(sidebarPath)) {
  const sidebarSource = readFileSync(sidebarPath, 'utf8')
  if (!sidebarSource.includes('aria-label=') && !sidebarSource.includes('role="navigation"')) {
    failures.push('sidebar aria-label')
  }
}

if (existsSync(toolbarPath)) {
  const toolbarSource = readFileSync(toolbarPath, 'utf8')
  if (!toolbarSource.includes('aria-label=') && !toolbarSource.includes('role="toolbar"')) {
    failures.push('toolbar aria-label')
  }
}

const css = readFileSync(cssPath, 'utf8')
if (!css.includes(':focus-visible') && !css.includes(':focus')) {
  failures.push('focus-visible or :focus styles missing')
}
if (!css.includes('outline') && !css.includes('box-shadow')) {
  failures.push('focus indicator (outline/box-shadow) missing')
}

if (failures.length > 0) {
  console.error(`A11y smoke failed: missing ${failures.join(', ')}`)
  process.exit(1)
}

console.log('A11y smoke passed (static shell + graph keyboard nav checks). See docs/validation/ACCESSIBILITY_AUDIT.md for manual sign-off.')
