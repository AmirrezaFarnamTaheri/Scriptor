import { test, expect, type Page } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'
import { attachVisualState } from './visual-state-evidence'
async function open(page: Page) {
  await launchApp(page)
  await page.evaluate(() => {
    const api = (window as Window & { __TAURI_INTERNALS__?: { invoke?: (command: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__
    if (!api?.invoke) throw new Error('Native fixture unavailable')
    const original = api.invoke.bind(api); let content = '\\section{Local}\r\n'; let hash = 'a'.repeat(64)
    api.invoke = async (command, args = {}, options) => {
      if (command.startsWith('source_file_') || command.startsWith('overleaf_')) {
        const calls = JSON.parse(sessionStorage.getItem('e2e:overleaf-calls') ?? '[]'); calls.push({ command, args }); sessionStorage.setItem('e2e:overleaf-calls', JSON.stringify(calls))
      }
      if (command.startsWith('source_file_')) {
        if (command === 'source_file_save') {
          if (args.expectedContentHash !== hash) throw new Error('Source changed on disk')
          content = String(args.content); hash = 'b'.repeat(64)
        }
        return { vault_id: args.expectedVaultId, path: args.path, content, content_hash: hash, language: 'latex' }
      }
      if (command === 'overleaf_read') {
        if (sessionStorage.getItem('e2e:overleaf-delay') === '1') await new Promise(resolve => setTimeout(resolve, 5000))
        return { head: 'c'.repeat(40), content: '\\section{Remote}\r\n', content_hash: 'd'.repeat(64) }
      }
      if (command === 'overleaf_push') {
        if (sessionStorage.getItem('e2e:overleaf-stale') === '1') throw new Error('Overleaf changed since review. Fetch a new preview before sharing; no files were pushed.')
        return { head: 'e'.repeat(40), content: args.content, content_hash: 'f'.repeat(64) }
      }
      return original(command, args, options)
    }
  })
  await openCommandPalette(page); await runCommand(page, 'Source file editor')
  const editor = page.getByRole('region', { name: 'Source file editor', exact: true })
  await editor.getByLabel('File path', { exact: true }).fill('main.tex')
  await editor.getByRole('button', { name: 'Open file', exact: true }).click()
  await editor.getByRole('button', { name: 'Open Overleaf sync', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Overleaf source sync', exact: true })
  await dialog.getByLabel('Overleaf project ID or official URL', { exact: true }).fill('abcdef123456')
  return { editor, dialog }
}
test('Overleaf reviews remote source, shares with remote CAS and applies with local CAS', async ({ page }, testInfo) => {
  const { editor, dialog } = await open(page)
  await dialog.getByRole('button', { name: 'Fetch remote source preview', exact: true }).click()
  const share = dialog.getByRole('button', { name: 'Share reviewed source with Overleaf', exact: true })
  await expect(share).toBeDisabled()
  await dialog.getByLabel('Reviewed source to apply locally or share', { exact: true }).fill('\\section{Reviewed merged source}\n')
  await attachVisualState(page, testInfo, 'overleaf-remote-local-merged-review', dialog)
  const consent = dialog.getByLabel('I compared both copies and reviewed this source for the selected action')
  await consent.check(); await share.click()
  await expect(dialog.getByRole('status')).toContainText('Reviewed source shared with Overleaf')
  await attachVisualState(page, testInfo, 'overleaf-reviewed-share-success', dialog)
  await consent.check()
  await dialog.getByRole('button', { name: 'Apply reviewed source locally', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('\\section{Reviewed merged source}\n')
  const calls = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e:overleaf-calls') ?? '[]') as Array<{command:string;args:Record<string,unknown>}>)
  const push = calls.find(row => row.command === 'overleaf_push')!.args
  expect(push.expectedHead).toBe('c'.repeat(40)); expect(push.expectedRemoteHash).toBe('d'.repeat(64)); expect(push.expectedVaultId).toBe('screenshot-vault')
  expect(calls.find(row => row.command === 'source_file_save')!.args.expectedContentHash).toBe('a'.repeat(64))
})
test('Overleaf rejects stale sharing, contains nested dialog focus and blocks pending vault switching', async ({ page }, testInfo) => {
  await page.clock.install()
  await page.setViewportSize({ width: 320, height: 720 })
  const { dialog } = await open(page)
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; sessionStorage.setItem('e2e:overleaf-delay', '1') })
  await dialog.getByRole('button', { name: 'Fetch remote source preview', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (JSON.parse(sessionStorage.getItem('e2e:overleaf-calls') ?? '[]') as Array<{command: string}>).filter(row => row.command === 'overleaf_read').length)).toBe(1)
  const decisions = await page.evaluate(async () => {
    const waits: Promise<boolean>[] = []
    window.dispatchEvent(new CustomEvent('scriptor:vault-change-starting', { detail: { waitUntil: (decision: Promise<boolean>) => waits.push(decision) } }))
    return Promise.all(waits)
  })
  expect(decisions).toContain(false)
  await page.clock.fastForward(5100)
  await expect(dialog.getByLabel('Reviewed source to apply locally or share', { exact: true })).toBeVisible()
  await expect.poll(() => dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await dialog.getByLabel('I compared both copies and reviewed this source for the selected action').check()
  await dialog.getByRole('button', { name: 'Share reviewed source with Overleaf', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close Overleaf sync', exact: true })).toBeFocused()
  await page.evaluate(() => sessionStorage.setItem('e2e:overleaf-stale', '1'))
  await dialog.getByLabel('I compared both copies and reviewed this source for the selected action').check()
  await dialog.getByRole('button', { name: 'Share reviewed source with Overleaf', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Overleaf changed since review')
  await attachVisualState(page, testInfo, 'overleaf-narrow-rtl-stale-share', dialog, dialog.getByRole('alert'))
})
