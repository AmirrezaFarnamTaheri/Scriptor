import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

/**
 * App-wide visual matrix: a workflow-state attachment can show an isolated
 * control and still miss clipping in its containing workspace. Capture complete
 * app-sized states for asset media and source editing in the visual workflow.
 * All local media/files are deterministic test fixtures, not actual vault data.
 */
async function openAssetDeck(page: import('@playwright/test').Page) {
  await launchApp(page)
  await waitForWorkspace(page, { allowHiddenVaultList: true })
  await openCommandPalette(page)
  await runCommand(page, 'Asset deck')
  const deck = page.getByRole('region', { name: 'Asset deck', exact: true })
  await expect(deck).toBeVisible()
  return deck
}

test('Asset Deck image, audio and narrow invalid-media states are in full-app visual evidence', async ({ page }, testInfo) => {
  await page.addInitScript(() => window.sessionStorage.setItem('e2e:asset-media', '1'))
  const deck = await openAssetDeck(page)
  const asset = (path: string) => deck.locator('.research-asset-list > li').filter({ hasText: path })
  await asset('assets/pixel.png').getByRole('button', { name: 'Open source', exact: true }).click()
  const image = deck.getByRole('img', { name: 'Vault source: assets/pixel.png', exact: true })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await settleLayout(page)
  await page.screenshot({ path: testInfo.outputPath('visual-app-asset-image-preview.png'), animations: 'disabled', caret: 'hide' })

  await asset('assets/tone.wav').getByRole('button', { name: 'Open source', exact: true }).click()
  const audio = deck.locator('audio[controls]')
  await expect(audio).toBeVisible()
  await expect(audio).toHaveAttribute('controls', '')
  await page.screenshot({ path: testInfo.outputPath('visual-app-asset-audio-preview.png'), animations: 'disabled', caret: 'hide' })

  await page.setViewportSize({ width: 320, height: 740 })
  await asset('assets/invalid.png').getByRole('button', { name: 'Open source', exact: true }).click()
  await expect(deck.getByRole('alert')).toContainText('do not match')
  await expect(deck.getByRole('button', { name: 'Retry preview', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
  await page.screenshot({ path: testInfo.outputPath('visual-app-asset-invalid-media-320.png'), animations: 'disabled', caret: 'hide' })
})

async function openSourceEditor(page: import('@playwright/test').Page, theme: 'light' | 'dark' = 'light') {
  await launchApp(page, { theme })
  await waitForWorkspace(page, { allowHiddenVaultList: true })
  await openCommandPalette(page)
  await runCommand(page, 'Source file editor')
  const editor = page.getByRole('region', { name: 'Source file editor', exact: true })
  await expect(editor).toBeVisible()
  await expect(editor.getByRole('textbox', { name: 'File path', exact: true })).toBeVisible()
  return editor
}

test('Source file editing default Monaco fills its own workspace rather than only a cropped control', async ({ page }, testInfo) => {
  const editor = await openSourceEditor(page)
  await expect(editor.getByRole('button', { name: 'Code editor', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(editor.locator('.source-file-monaco .monaco-editor')).toBeVisible({ timeout: 30_000 })
  await expect(editor.locator('.source-file-monaco .margin')).toBeVisible()
  await settleLayout(page)
  await page.screenshot({ path: testInfo.outputPath('visual-app-source-editor-monaco.png'), animations: 'disabled', caret: 'hide' })
})

test('Source file plain-text draft and navigation remain readable on dark 390px RTL', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const editor = await openSourceEditor(page, 'dark')
  await page.evaluate(() => { document.documentElement.dir = 'rtl' })
  await editor.getByRole('button', { name: 'Plain text', exact: true }).click()
  await editor.getByRole('textbox', { name: 'Source file content', exact: true }).fill('\\section{Draft}\\nReviewed English source.\\n')
  await expect(editor).toContainText('Unsaved changes')
  await expect(editor.getByRole('button', { name: 'Save file', exact: true })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
  await page.screenshot({ path: testInfo.outputPath('visual-app-source-editor-dark-rtl-390.png'), animations: 'disabled', caret: 'hide' })
})

test('Source file editor retains its mode controls and editing area at 200% app zoom', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('scriptor:ui-zoom', '2'))
  const editor = await openSourceEditor(page)
  await expect.poll(() => page.evaluate(() => Number(document.body.style.zoom))).toBe(2)
  await editor.getByRole('button', { name: 'Plain text', exact: true }).click()
  await expect(editor.getByRole('textbox', { name: 'Source file content', exact: true })).toBeVisible()
  await expect(editor.getByRole('button', { name: 'Code editor', exact: true })).toBeEnabled()
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
  await page.screenshot({ path: testInfo.outputPath('visual-app-source-editor-zoom-200.png'), animations: 'disabled', caret: 'hide' })
})
