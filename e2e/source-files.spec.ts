import { expect, test, type Page } from '@playwright/test'
import { closeWorkspacePanel, launchApp, openCommandPalette, runCommand } from './helpers'
import { attachVisualState } from './visual-state-evidence'

async function openEditor(page: Page, theme = 'light') {
  await launchApp(page, { theme })
  await page.evaluate(() => {
    const internals = (window as Window & { __TAURI_INTERNALS__?: { invoke?: (command: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__
    if (!internals?.invoke) throw new Error('Native fixture unavailable')
    const original = internals.invoke.bind(internals)
    const files = new Map<string, { content: string; hash: string }>()
    files.set('main.py', { content: 'print(1)\r\n', hash: 'a'.repeat(64) })
    files.set('references.bib', { content: '@article{reviewed, title={Reviewed source}}\n', hash: 'c'.repeat(64) })
    internals.invoke = async (command, args = {}, options) => {
      if (command.startsWith('source_file_') || command === 'latex_compile' || command === 'vault_open') {
        const calls = JSON.parse(sessionStorage.getItem('e2e:source-calls') ?? '[]')
        calls.push({ command, args }); sessionStorage.setItem('e2e:source-calls', JSON.stringify(calls))
      }
      if (command === 'plugin:dialog|open' && sessionStorage.getItem('e2e:source-picked-vault')) return sessionStorage.getItem('e2e:source-picked-vault')
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
      if (command === 'latex_compile') {
        if (sessionStorage.getItem('e2e:source-compile-error') === '1') throw new Error('main.tex:3: Undefined control sequence: \\unknowncommand. No PDF was produced.')
        return { output_path: '.scriptor/latex-out/main.pdf', stdout: '', stderr: '', duration_ms: 3 }
      }
      return original(command, args, options)
    }
  })
  await openCommandPalette(page); await runCommand(page, 'Source file editor')
  const editor = page.getByRole('region', { name: 'Source file editor', exact: true })
  await expect(editor.getByRole('heading', { name: 'Source files', exact: true })).toBeVisible()
  return editor
}
test('source editor creates LaTeX and compiles only reviewed saved content', async ({ page }, testInfo) => {
  const editor = await openEditor(page)
  await editor.getByLabel('File path', { exact: true }).fill('main.tex')
  await editor.getByLabel('Source file content', { exact: true }).fill('\\documentclass{article}\n\\begin{document}Hello\\end{document}\n')
  await editor.getByRole('button', { name: 'Create file', exact: true }).click()
  const compile = editor.getByRole('button', { name: 'Compile PDF', exact: true })
  await expect(compile).toBeDisabled()
  await attachVisualState(page, testInfo, 'source-latex-saved', editor)
  await editor.getByLabel('I reviewed the saved source and want to compile it.').check()
  await compile.click()
  await expect(editor.getByText('Compilation: success', { exact: false })).toBeVisible()
  await attachVisualState(page, testInfo, 'source-latex-compile-success', editor)
  await editor.getByLabel('Source file content', { exact: true }).fill('Unsaved source')
  await expect(compile).toBeDisabled()
  const calls = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e:source-calls') ?? '[]'))
  expect(calls.filter((row: { command: string }) => row.command === 'source_file_create')).toHaveLength(1)
  expect(calls.filter((row: { command: string }) => row.command === 'latex_compile')).toHaveLength(1)
})

test('dark source editor retains saved LaTeX and actionable diagnostics after failed compilation', async ({ page }, testInfo) => {
  const editor = await openEditor(page, 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark')
  const source = '\\documentclass{article}\n\\begin{document}\n\\unknowncommand\n\\end{document}\n'
  await editor.getByLabel('File path', { exact: true }).fill('main.tex')
  await editor.getByLabel('Source file content', { exact: true }).fill(source)
  await editor.getByRole('button', { name: 'Create file', exact: true }).click()
  await expect(editor.getByRole('button', { name: 'Save file', exact: true })).toBeDisabled()
  await page.evaluate(() => sessionStorage.setItem('e2e:source-compile-error', '1'))
  await editor.getByLabel('I reviewed the saved source and want to compile it.').check()
  await editor.getByRole('button', { name: 'Compile PDF', exact: true }).click()
  await expect(editor.getByText('Compilation: error', { exact: true })).toBeVisible()
  await expect(editor.locator('pre')).toContainText('main.tex:3: Undefined control sequence')
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue(source)
  await expect(editor.getByRole('button', { name: 'Compile PDF', exact: true })).toBeDisabled()
  await attachVisualState(page, testInfo, 'source-dark-compile-diagnostics', editor)
})

test('source editor approved internal discard closes without prompting a second time', async ({ page }, testInfo) => {
  const editor = await openEditor(page)
  await editor.getByLabel('Source file content', { exact: true }).fill('Discard this draft once')
  await closeWorkspacePanel(page, editor)
  await expect(editor.getByRole('alertdialog', { name: 'Unsaved source changes' })).toBeVisible()
  await attachVisualState(page, testInfo, 'source-discard-review', editor.getByRole('alertdialog', { name: 'Unsaved source changes' }))
  await editor.getByRole('button', { name: 'Discard and continue', exact: true }).click()
  await expect(editor).not.toBeVisible()
  await expect(page.getByRole('alertdialog', { name: 'Unsaved source changes' })).not.toBeVisible()
  const calls = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e:source-calls') ?? '[]') as Array<{ command: string }>)
  expect(calls.filter(row => row.command === 'source_file_create' || row.command === 'source_file_save')).toHaveLength(0)
})

test('source editor settles both vault decisions dispatched before a render', async ({ page }) => {
  const editor = await openEditor(page)
  await editor.getByLabel('Source file content', { exact: true }).fill('Retain this draft')
  await page.evaluate(() => {
    const waits: Promise<unknown>[] = []
    for (let index = 0; index < 2; index += 1) {
      window.dispatchEvent(new CustomEvent('scriptor:vault-change-starting', { detail: { waitUntil: (wait: Promise<unknown> | (() => Promise<unknown>)) => waits.push(typeof wait === 'function' ? wait() : wait) } }))
    }
    void Promise.all(waits).then(result => sessionStorage.setItem('e2e:source-vault-results', JSON.stringify(result)))
  })
  await editor.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('e2e:source-vault-results'))).toBe('[false,false]')
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('Retain this draft')
})

test('pending source decision stays visible until cancelled before a sidebar file opens its own leaf', async ({ page }, testInfo) => {
  const editor = await openEditor(page)
  const originalTabLabel = await page.getByRole('tablist', { name: 'Side workspace tabs', exact: true }).getByRole('tab', { selected: true }).innerText()
  await editor.getByLabel('Source file content', { exact: true }).fill('Retain this draft')
  await page.evaluate(() => {
    const waits: Promise<unknown>[] = []
    window.dispatchEvent(new CustomEvent('scriptor:vault-change-starting', { detail: { waitUntil: (wait: Promise<unknown> | (() => Promise<unknown>)) => waits.push(typeof wait === 'function' ? wait() : wait) } }))
    void Promise.all(waits).then(result => sessionStorage.setItem('e2e:source-vault-result', JSON.stringify(result)))
  })
  await expect(editor.getByRole('alertdialog')).toBeVisible()
  const bibliography = page.getByRole('complementary', { name: 'Vault', exact: true }).getByRole('button', { name: 'references.bib', exact: true })
  await bibliography.click()
  await expect(editor.getByRole('alertdialog')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'references.bib', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('e2e:source-vault-result'))).toBeNull()
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('Retain this draft')
  await editor.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('e2e:source-vault-result'))).toBe('[false]')
  await bibliography.click()
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('@article{reviewed, title={Reviewed source}}\n')
  await attachVisualState(page, testInfo, 'source-bibtex-populated', editor)
  await page.getByRole('tab', { name: originalTabLabel, exact: true }).click()
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('Retain this draft')
})

test('real vault switching reveals two dirty source leaves sequentially and refusal prevents native open', async ({ page }, testInfo) => {
  const editor = await openEditor(page)
  await editor.getByLabel('File path', { exact: true }).fill('main.py')
  await editor.getByRole('button', { name: 'Open file', exact: true }).click()
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('print(1)\n')
  await attachVisualState(page, testInfo, 'source-python-populated', editor)
  await editor.getByLabel('Source file content', { exact: true }).fill('print("first draft")\n')
  await page.getByRole('complementary', { name: 'Vault', exact: true }).getByRole('button', { name: 'references.bib', exact: true }).click()
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('@article{reviewed, title={Reviewed source}}\n')
  await editor.getByLabel('Source file content', { exact: true }).fill('Second retained draft')
  await page.evaluate(() => sessionStorage.setItem('e2e:source-picked-vault', '/e2e/next-source-vault'))
  await page.getByRole('button', { name: 'Open Vault', exact: true }).click()
  const decision = page.getByRole('alertdialog', { name: 'Unsaved source changes', exact: true })
  await expect(decision).toHaveCount(1)
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('print("first draft")\n')
  await decision.getByRole('button', { name: 'Save and continue', exact: true }).click()
  await expect(decision).toHaveCount(1)
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('Second retained draft')
  await decision.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(decision).toHaveCount(0)
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('Second retained draft')
  const calls = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e:source-calls') ?? '[]') as Array<{ command: string; args: { path?: string; content?: string } }>)
  expect(calls.filter(row => row.command === 'source_file_save')).toEqual([expect.objectContaining({ args: expect.objectContaining({ path: 'main.py', content: 'print("first draft")\r\n' }) })])
  expect(calls.filter(row => row.command === 'vault_open')).toHaveLength(0)
})

test('nested Overleaf modal stays visible when a palette command attempts to open another workspace', async ({ page }, testInfo) => {
  const editor = await openEditor(page)
  await editor.getByLabel('File path', { exact: true }).fill('references.bib')
  await editor.getByRole('button', { name: 'Open file', exact: true }).click()
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('@article{reviewed, title={Reviewed source}}\n')
  await editor.getByRole('button', { name: 'Open Overleaf sync', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Overleaf source sync', exact: true })
  await expect(modal).toBeVisible()
  await openCommandPalette(page); await runCommand(page, 'Diagram studio')
  await expect(modal).toBeVisible()
  await expect(editor).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Diagram studio', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Diagram studio', exact: true })).toHaveCount(0)
  await attachVisualState(page, testInfo, 'source-nested-overleaf-route-blocked', modal)
  await modal.getByRole('button', { name: 'Close Overleaf sync', exact: true }).click()
  await expect(modal).toHaveCount(0)
  await openCommandPalette(page); await runCommand(page, 'Diagram studio')
  await expect(page.getByRole('region', { name: 'Diagram studio', exact: true })).toBeVisible()
})
test('source editor retains conflicts and dirty drafts across cancelled close and vault switch', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const editor = await openEditor(page)
  await editor.getByLabel('File path', { exact: true }).fill('main.py')
  await editor.getByRole('button', { name: 'Open file', exact: true }).click()
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('print(1)\n')
  await editor.getByLabel('Source file content', { exact: true }).fill('print(2)\n')
  await page.evaluate(() => sessionStorage.setItem('e2e:source-stale', '1'))
  await editor.getByRole('button', { name: 'Save file', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('Source changed on disk')
  await attachVisualState(page, testInfo, 'source-mobile-disk-conflict', editor, editor.getByRole('alert'))
  await closeWorkspacePanel(page, editor)
  await expect(editor.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused()
  await attachVisualState(page, testInfo, 'source-mobile-dirty-close', editor.getByRole('alertdialog', { name: 'Unsaved source changes' }))
  await page.keyboard.press('Tab')
  await expect(editor.getByRole('button', { name: 'Save and continue', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(editor.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('print(2)\n')
  await page.evaluate(() => {
    const waits: Promise<unknown>[] = []
    window.dispatchEvent(new CustomEvent('scriptor:vault-change-starting', { detail: { waitUntil: (wait: Promise<unknown> | (() => Promise<unknown>)) => waits.push(typeof wait === 'function' ? wait() : wait) } }))
    void Promise.all(waits).then(result => sessionStorage.setItem('e2e:source-vault-result', JSON.stringify(result)))
  })
  await editor.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('e2e:source-vault-result'))).toBe('[false]')
  await expect(editor.getByLabel('Source file content', { exact: true })).toHaveValue('print(2)\n')
  await expect.poll(() => editor.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
})
