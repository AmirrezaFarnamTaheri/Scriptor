import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const E2E_SEARCH_MARKER = 'e2e-workspace-marker'

export const WORKSPACE_CHROME_PREFS = {
  vaultSidebarCollapsed: false,
  inspectorCollapsed: false,
  showFormatToolbar: true,
  showEditorAssist: true,
  showEditorStatus: true,
  showInspectorHealth: true,
  showWorkspaceFooter: true,
  showLineNumbers: true,
  editorFontSize: 14,
  editorFontFamily: 'jetbrains-mono',
  editorLineHeight: 1.55,
  editorPaddingPx: 12,
  previewMaxWidthCh: 72,
  editorSurfaceMode: 'source',
}

export async function launchApp(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' })
  return page
}

export async function openCommandPalette(page: Page) {
  await page.keyboard.press('Control+KeyK')
  const palette = page.getByRole('dialog', { name: 'Command palette' })
  await expect(palette).toBeVisible({ timeout: 5000 })
}

export async function runCommand(page: Page, commandName: string) {
  const palette = page.getByRole('dialog', { name: 'Command palette' })
  await palette.getByRole('searchbox', { name: 'Command palette search' }).fill(commandName)
  await palette.getByRole('option').first().click()
}

export async function settleLayout(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    window.dispatchEvent(new Event('resize'))
  })
  await page.waitForFunction(() => {
    const root = document.getElementById('root')
    return root && root.getBoundingClientRect().width > 0
  }, { timeout: 5000 })
}

export async function waitForWorkspace(page: Page) {
  await expect(page.getByRole('main', { name: 'Scriptor workspace' })).toBeVisible()
  await expect(page.locator('small.vault-badge', { hasText: 'Research Vault' })).toBeVisible({
    timeout: 45_000,
  })
  const vaultList = page.locator('.virtual-note-list')
  await expect(vaultList.getByRole('button', { name: 'Research Plan.md' })).toBeVisible({
    timeout: 45_000,
  })
  await expect(page.locator('.tab.active', { hasText: 'Research Plan' })).toBeVisible({
    timeout: 30_000,
  })
  const monaco = page.locator('.monaco-editor .view-lines')
  const codemirror = page.locator('.cm-content')
  await expect(monaco.or(codemirror)).toContainText('Research Plan', {
    timeout: 45_000,
  })
  await settleLayout(page)
}

export async function appendEditorLine(page: Page, line: string) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => Boolean((window as Window & { __scriptorE2eEditor?: unknown }).__scriptorE2eEditor)),
      { timeout: 15_000 },
    )
    .toBe(true)

  await page.evaluate((text) => {
    const editor = (window as Window & { __scriptorE2eEditor?: { getModel: () => { getLineCount: () => number; getLineMaxColumn: (line: number) => number } | null; executeEdits: (source: string, edits: unknown[]) => void } })
      .__scriptorE2eEditor
    if (!editor) throw new Error('E2E Monaco editor not mounted')
    const model = editor.getModel()
    if (!model) throw new Error('E2E Monaco model missing')
    const lineCount = model.getLineCount()
    const column = model.getLineMaxColumn(lineCount)
    editor.executeEdits('e2e-append', [
      {
        range: {
          startLineNumber: lineCount,
          startColumn: column,
          endLineNumber: lineCount,
          endColumn: column,
        },
        text: `\n\n${text}`,
        forceMoveMarkers: true,
      },
    ])
  }, line)
}

export async function waitForSavedMarker(page: Page, marker: string) {
  await expect(page.locator('.monaco-editor .view-lines')).toContainText(marker, { timeout: 10_000 })
  await expect(page.getByRole('region', { name: 'Editor' }).getByText(/^Saved /)).toBeVisible({
    timeout: 15_000,
  })
  await page.waitForFunction(() => {
    const saved = document.querySelector('[role="region"][aria-label="Editor"]')
    return saved && saved.textContent && /Saved \d/.test(saved.textContent)
  }, { timeout: 5000 })
}
