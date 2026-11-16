import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

async function openPublishCenter(page: Page) {
  await launchApp(page)
  await waitForWorkspace(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open publish center')
  const dialog = page.getByRole('dialog', { name: 'Export & publish' })
  await expect(dialog).toBeVisible({ timeout: 20_000 })
  return dialog
}

test('PDF is the recommended default and all format choices fit one selector', async ({ page }) => {
  const dialog = await openPublishCenter(page)
  const picker = dialog.getByRole('combobox', { name: 'Export format' })
  await expect(picker).toHaveValue('pdf-offline')
  await expect(dialog.getByText('Recommended PDF', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Creates a PDF on this device without an external typesetting service.')).toBeVisible()
  const options = await picker.locator('option').evaluateAll(nodes => nodes.map(node => ({ id: (node as HTMLOptionElement).value, label: node.textContent?.trim() ?? '' })))
  expect(options.length).toBeGreaterThanOrEqual(8)
  expect(options[0]?.id).toBe('pdf-offline')
  for (const { id } of options) {
    await picker.selectOption(id)
    await expect(dialog.locator('.publish-format-selection')).toBeVisible()
    await expect(dialog.locator('.publish-format-selection-label strong')).not.toBeEmpty()
  }
  await expect(dialog.locator('.publish-format-selection')).toHaveCount(1)
  await expect(dialog.locator('.publish-profile-list > li')).toHaveCount(0)
})

test('alternative PDF engines explain requirements and the destination follows selection', async ({ page }) => {
  const dialog = await openPublishCenter(page)
  const picker = dialog.getByRole('combobox', { name: 'Export format' })
  await picker.selectOption('pdf-print')
  await expect(dialog.getByText('Standard PDF via Pandoc; requires a configured PDF engine.')).toBeVisible()
  await expect(dialog.locator('.publish-format-destination code')).toContainText('exports/pdf')
  await picker.selectOption('pdf-typst')
  await expect(dialog.getByText('PDF via the Typst engine; requires Typst to be installed.')).toBeVisible()
  await expect(dialog.locator('.publish-format-destination code')).toContainText('exports/typst')
  await picker.selectOption('html-standalone')
  await expect(dialog.getByRole('button', { name: 'Preview export', exact: true })).toBeVisible()
  await expect(dialog.locator('.publish-format-destination code')).toContainText('exports/html')
})

test('advanced LaTeX compiler is discoverable after the simple format selector', async ({ page }) => {
  const dialog = await openPublishCenter(page)
  const ordered = await dialog.evaluate(root => {
    const picker = root.querySelector('.publish-format-workflow')
    const latex = root.querySelector('#latex-compile-heading')
    return Boolean(picker && latex && picker.compareDocumentPosition(latex) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  expect(ordered).toBe(true)
  const compiler = dialog.locator('details.publish-latex-options')
  await expect(compiler).not.toHaveAttribute('open', '')
  await compiler.locator('summary').click()
  await expect(compiler).toHaveAttribute('open', '')
  await expect(dialog.getByRole('button', { name: /Detect Tectonic|Tectonic (detected|not found)/ })).toBeVisible()
})
