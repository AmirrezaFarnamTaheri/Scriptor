import { expect, test, type Page } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

async function openEditor(page: Page) {
  await launchApp(page)
  await page.evaluate(() => {
    const internals = (window as Window & { __TAURI_INTERNALS__?: { invoke?: (command: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__
    if (!internals?.invoke) throw new Error('Native fixture unavailable')
    const original = internals.invoke.bind(internals)
    const files = new Map<string, { content: string; hash: string }>()
    files.set('main.py', { content: 'print(1)\r\n', hash: 'a'.repeat(64) })
    files.set('references.bib', { content: '@article{reviewed, title={Reviewed source}}\n', hash: 'c'.repeat(64) })
    internals.invoke = async (command, args = {}, options) => {
      if (command.startsWith('source_file_') || command === 'latex_compile') {
        const calls = JSON.parse(sessionStorage.getItem('e2e:source-calls') ?? '[]')
        calls.push({ command, args }); sessionStorage.setItem('e2e:source-calls', JSON.stringify(calls))
      }
      if (command.startsWith('source_file_')) {
        const path = String(args.path), existing = files.get(path)
        if (command === 'source_file_read' && !existing) throw new Error('Source file does not exist')
        if (command === 'source_file_create' && existing) throw new Error('Source destination already exists')
        if (command === 'source_file_save' && (sessionStorage.getItem('e2e:source-stale') === '1' || args.expectedContentHash !== existing?.hash)) throw new Error('Source changed on disk. Reload before saving; your draft is retained')
        const content = command === 'source_file_read' ? existing!.content : String(args.content)
        const hash = command === 'source_file_read' ? existing!.hash : 'b'.repeat(64)
        files.set(path, { content, hash })
        return { vault_id: args.expectedVaultId, path, content, content_hash: hash, language: /\.(tex|ltx)$/.test(path) ? 'latex' : path.endsWith('.bib') ? 'bibtex' : 'python' }
      }
      if (command === 'latex_compile') return { output_path: '.scriptor/latex-out/main.pdf', stdout: '', stderr: '', duration_ms: 3 }
      return original(command, args, options)
    }
  })
  await openCommandPalette(page); await runCommand(page, 'Source file editor')
  const editor = page.getByRole('region', { name: 'Source file editor', exact: true })
  await expect(editor.getByRole('heading', { name: 'Source files', exact: true })).toBeVisible()
  return editor
}
test('source editor creates LaTeX and compiles only reviewed saved content', async ({ page }) => {
  const editor = await openEditor(page)
  await editor.getByLabel('File path', { exact: true }).fill('main.tex')
  await editor.getByLabel('Source file content', { exact: true }).fill('\\documentclass{article}\n\\begin{document}Hello\\end{document}\n')
  await editor.getByRole('button', { name: 'Create file', exact: true }).click()
  const compile = editor.getByRole('button', { name: 'Compile PDF', exact: true })
  await expect(compile).toBeDisabled()
  await editor.getByLabel('I reviewed the saved source and want to compile it.').check()
  await compile.click()
  await expect(editor.getByText('Compilation: success', { exact: false })).toBeVisible()
  await editor.getByLabel('Source file content', { exact: true }).fill('Unsaved source')
  await expect(compile).toBeDisabled()
  const calls = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e:source-calls') ?? '[]'))
  expect(calls.filter((row: { command: string }) => row.command === 'source_file_create')).toHaveLength(1)
  expect(calls.filter((row: { command: string }) => row.command === 'latex_compile')).toHaveLength(1)
})

test('source editor settles both vault decisions dispatched before a render', async ({ page }) => {
  const editor = await openEditor(page)
  await editor.getByLabel('Source file content', { exact: true }).fill('Retain this draft')
  await page.evaluate(() => {
    const waits: Promise<unknown>[] = []
    for (let index = 0; index < 2; index += 1) {
      window.dispatchEvent(new CustomEvent('scriptor:vault-change-starting', { detail: { waitUntil: (promise: Promise<unknown>) => waits.push(promise) } }))
    }
    void Promise.all(waits).then(result => sessionStorage.setItem('e2e:source-vault-results', JSON.stringify(result)))
  })
  await editor.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('e2e:source-vault-results'))).toBe('[false,false]')
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('Retain this draft')
})

test('source editor cancels an outstanding vault decision when a sidebar file replaces it', async ({ page }) => {
  const editor = await openEditor(page)
  await editor.getByLabel('Source file content', { exact: true }).fill('Retain this draft')
  await page.evaluate(() => {
    const waits: Promise<unknown>[] = []
    window.dispatchEvent(new CustomEvent('scriptor:vault-change-starting', { detail: { waitUntil: (promise: Promise<unknown>) => waits.push(promise) } }))
    void Promise.all(waits).then(result => sessionStorage.setItem('e2e:source-vault-result', JSON.stringify(result)))
  })
  await expect(editor.getByRole('alertdialog')).toBeVisible()
  await page.getByText('references.bib', { exact: true }).click()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('e2e:source-vault-result'))).toBe('[false]')
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('Retain this draft')
  await editor.getByRole('button', { name: 'Discard and continue', exact: true }).click()
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('@article{reviewed, title={Reviewed source}}\n')
})
test('source editor retains conflicts and dirty drafts across cancelled close and vault switch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const editor = await openEditor(page)
  await editor.getByLabel('File path', { exact: true }).fill('main.py')
  await editor.getByRole('button', { name: 'Open file', exact: true }).click()
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('print(1)\n')
  await editor.getByLabel('Source file content', { exact: true }).fill('print(2)\n')
  await page.evaluate(() => sessionStorage.setItem('e2e:source-stale', '1'))
  await editor.getByRole('button', { name: 'Save file', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('Source changed on disk')
  await editor.getByRole('button', { name: 'Close editor', exact: true }).click()
  await expect(editor.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(editor.getByRole('button', { name: 'Save and continue', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(editor.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('print(2)\n')
  await page.evaluate(() => {
    const waits: Promise<unknown>[] = []
    window.dispatchEvent(new CustomEvent('scriptor:vault-change-starting', { detail: { waitUntil: (promise: Promise<unknown>) => waits.push(promise) } }))
    void Promise.all(waits).then(result => sessionStorage.setItem('e2e:source-vault-result', JSON.stringify(result)))
  })
  await editor.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('e2e:source-vault-result'))).toBe('[false]')
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('print(2)\n')
  await expect.poll(() => editor.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
})
