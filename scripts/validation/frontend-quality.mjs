#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

import { importsTauriCore } from './frontend-quality-patterns.mjs'

const root = process.cwd()
const failures = []
const productionExtensions = new Set(['.ts', '.tsx', '.css'])
const excludedSegments = new Set(['e2e', '__tests__', 'fixtures', 'test-fixtures'])

function walk(directory) {
  const files = []
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry)
    const rel = relative(root, absolute).replaceAll('\\', '/')
    const stat = statSync(absolute)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'target' || excludedSegments.has(entry)) continue
      files.push(...walk(absolute))
    } else if (productionExtensions.has(extname(entry))) {
      files.push({ absolute, rel })
    }
  }
  return files
}

function source(path) {
  return readFileSync(join(root, path), 'utf8')
}

function requirePattern(path, pattern, message) {
  if (!pattern.test(source(path))) failures.push(`${path}: ${message}`)
}

function rejectPattern(path, pattern, message) {
  if (pattern.test(source(path))) failures.push(`${path}: ${message}`)
}

const productionFiles = [
  ...walk(join(root, 'src')),
  ...walk(join(root, 'packages')),
].filter(({ rel }) => !rel.includes('/validate-runner.') && !rel.includes('/xss-fixtures.'))

for (const { absolute, rel } of productionFiles) {
  const text = readFileSync(absolute, 'utf8')
  if (rel.startsWith('src/') && !rel.startsWith('src/bridge/') && importsTauriCore(text)) {
    failures.push(`${rel}: production renderer code must call native commands through src/bridge`)
  }
  if (/\bas\s+any\b|:\s*any\b|<any>/.test(text)) {
    failures.push(`${rel}: explicit any is forbidden in production UI/type contracts`)
  }
  if (/[\u{1F300}-\u{1FAFF}]/u.test(text)) {
    failures.push(`${rel}: emoji glyph found; use the installed icon system`)
  }
  if (/fonts\.(?:googleapis|gstatic)\.com|@import\s+url\(\s*["']?https?:/i.test(text)) {
    failures.push(`${rel}: remote font or CSS import found; desktop UI must be self-contained`)
  }
  if (extname(rel) === '.css' && /transition\s*:\s*all\b/i.test(text)) {
    failures.push(`${rel}: transition: all is forbidden; enumerate the properties that may animate`)
  }
}

for (const path of [
  'src/components/GraphPanel.tsx',
  'src/components/ObsidianImportDialog.tsx',
  'src/components/ErrorBoundary.tsx',
  'src/components/shell/EditorWorkspace.tsx',
]) {
  rejectPattern(path, /style=\{\{/, 'static inline styles must be expressed through the design system')
}

requirePattern('src/components/GraphPanel.tsx', /useFocusTrap\(dialogRef, \{ active: true \}\)/, 'graph dialog must trap and restore focus')
requirePattern('src/components/GraphPanel.tsx', /aria-modal="true"/, 'graph dialog must declare modal semantics')
requirePattern('src/components/ObsidianImportDialog.tsx', /useFocusTrap\(dialogRef,\s*\{\s*active:\s*true(?:,\s*initialFocus:\s*false)?\s*\}\)/, 'import dialog must trap and restore focus')
requirePattern('src/components/ObsidianImportDialog.tsx', /aria-labelledby=\{titleId\}/, 'import dialog must have a programmatic title')
requirePattern('src/components/shell/EditorWorkspace.tsx', /type EditorTransformAction/, 'editor actions must use the editor package contract')
requirePattern('src/components/shell/EditorWorkspace.tsx', /type MarkdownPreviewProps/, 'preview bridge must use the renderer package contract')
{
  const editorSource = source('src/components/shell/EditorWorkspace.tsx')
  const buttonTags = editorSource.match(/<\/?button\b[^>]*>/gi) ?? []
  let buttonDepth = 0
  for (const tag of buttonTags) {
    buttonDepth += tag.startsWith('</') ? -1 : 1
    if (buttonDepth > 1) {
      failures.push('src/components/shell/EditorWorkspace.tsx: nested interactive buttons are not allowed in editor tabs')
      break
    }
  }
}
rejectPattern('src/App.tsx', /as any/, 'application integration must not bypass action types')

{
  const overlaySource = source('src/hooks/useOverlayPanelStore.ts')
  const appSource = source('src/App.tsx')
  const panelControllerSource = source('src/controllers/usePanelSurfaceController.ts')
  if (!/useOverlayPanelStore/.test(panelControllerSource) || !/useState<OverlayPanelState>/.test(overlaySource)) {
    failures.push('overlay panel state must have one owner in useOverlayPanelStore')
  }
  if (/useAppOverlayState/.test(appSource)) {
    failures.push('src/App.tsx: retired useAppOverlayState must not be referenced')
  }
}
requirePattern('src/App.tsx', /useEditorPreferences\(theme(?:,\s*initialWorkspaceLayout)?\)/, 'editor defaults must follow the application theme')
requirePattern('src/hooks/useEditorPreferences.ts', /editorThemeOverride \?\? defaultEditorTheme\(appTheme\)/, 'editor theme must use an app-theme fallback until explicitly overridden')
requirePattern('src/styles/components/editor-workspace.css', /@media\s*\(max-width:/, 'editor workspace needs an explicit compact layout')
requirePattern('src/styles/components/canvas-graph.css', /@media\s*\(max-width:\s*720px\)/, 'graph needs an explicit compact layout')
requirePattern('src/styles/components/modals.css', /100dvh/, 'modal layout must account for dynamic mobile viewport height')
requirePattern('src/styles/components/error-boundary.css', /\.error-boundary/, 'error surfaces must use design-system CSS')
requirePattern('src/styles/app/foundation.css', /error-boundary\.css/, 'error-boundary CSS must be included in the application bundle')

if (failures.length > 0) {
  console.error('Frontend quality validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Frontend quality OK: ${productionFiles.length} production TypeScript/CSS files checked.`)
