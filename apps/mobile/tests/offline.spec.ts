import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const store = new Map<string, { markdown: string; hash: string }>()
    store.set('Research/paper.md', { markdown: '# Paper\nOriginal evidence', hash: 'h1' })
    let version = 1
    const metadata = (path: string, value: { markdown: string; hash: string }) => ({ path, title: value.markdown.split('\n')[0].replace(/^# /, ''), content_hash: value.hash })
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: { invoke: async (command: string, args: { request?: Record<string, unknown> }) => {
      if (command === 'mobile_lifecycle') return { scope: 1 }
      const req = args.request ?? {}
      const path = String(req.path ?? '')
      if (req.operation === 'search') return { notes: [...store].filter(([path, note]) => `${path} ${note.markdown}`.toLowerCase().includes(String(req.query).toLowerCase())).map(([path, note]) => metadata(path, note)), truncated: false }
      if (req.operation === 'read') { const value = store.get(path); if (!value) throw new Error('Missing note'); return { markdown: value.markdown, metadata: metadata(path, value) } }
      if (req.operation === 'save') {
        const previous = store.get(path)
        if ((previous?.hash ?? '<missing>') !== req.expected_hash) throw new Error('Stale note; newer content remains on disk')
        const next = { markdown: String(req.markdown), hash: `h${++version}` }; store.set(path, next)
        return { metadata: metadata(path, next) }
      }
      if (req.operation === 'history') return []
      if (req.operation === 'pdf_licenses') return 'Bundled fonts: Libertinus Serif, DejaVu. SIL Open Font License.'
      if (req.operation === 'export_pdf') {
        const value = store.get(path)
        if (!value || value.hash !== req.expected_hash) throw new Error('The note changed; reload before exporting')
        localStorage.setItem('test:pdf-request', JSON.stringify(req))
        return { saved: localStorage.getItem('test:cancel-pdf') !== 'yes', filename: 'paper.pdf', page_count: 1, warnings: [] }
      }
      throw new Error('Unknown command')
    } } })
  })
})

test('offline create edit save search and recovery work at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Paper Research/paper.md' }).click()
  const editor = page.locator('.cm-content')
  await editor.fill('# Paper\nUpdated evidence')
  await expect(page.getByText('Recovery draft saved on this device', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Notes', exact: true }).click()
  await page.getByRole('button', { name: 'Paper Research/paper.md' }).click()
  await expect(editor).toContainText('Updated evidence')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Notes', exact: true }).click()
  await page.getByLabel('Search Markdown').fill('Updated')
  await expect(page.getByRole('button', { name: 'Paper Research/paper.md' })).toBeVisible()
  await page.getByLabel('New note path').fill('new.md')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.locator('.mobile-editor-bar')).toContainText('new.md')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('stale recovered draft remains editable and cannot overwrite disk', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('scriptor-mobile:draft:Research/paper.md', JSON.stringify({ markdown: 'recovered content', baseHash: 'outdated' })))
  await page.goto('/')
  await page.getByRole('button', { name: 'Paper Research/paper.md' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Stale note')
  await expect(page.locator('.cm-content')).toContainText('recovered content')
  expect(await page.evaluate(() => localStorage.getItem('scriptor-mobile:draft:Research/paper.md'))).toContain('recovered content')
})

test('RTL layout and controls remain bounded with 200 percent text', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Paper Research/paper.md' }).click()
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; document.documentElement.style.fontSize = '200%' })
  for (const control of await page.locator('button,input').all()) {
    const rect = await control.boundingBox()
    if (rect) { expect(rect.height).toBeGreaterThanOrEqual(44); expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(375) }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('PDF export binds saved source and presents cancellation and font notices', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Paper Research/paper.md' }).click()
  const pdf = page.getByRole('button', { name: 'Save PDF', exact: true })
  await page.locator('.cm-content').fill('# Paper\nNew evidence')
  await expect(pdf).toBeDisabled()
  await expect(page.getByText('Save your current draft before exporting PDF.')).toBeVisible()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await pdf.click()
  await expect(page.getByRole('region', { name: 'PDF export' })).toContainText('paper.pdf saved')
  const request = JSON.parse(await page.evaluate(() => localStorage.getItem('test:pdf-request')) ?? '{}') as Record<string, unknown>
  expect(request).toMatchObject({ operation: 'export_pdf', path: 'Research/paper.md', expected_hash: 'h2' })
  expect(request).not.toHaveProperty('destination')
  await page.evaluate(() => localStorage.setItem('test:cancel-pdf', 'yes'))
  await pdf.click()
  await expect(page.getByRole('region', { name: 'PDF export' })).toContainText('PDF save cancelled')
  await page.getByRole('button', { name: 'Font licenses', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'PDF font licenses' })
  await expect(dialog).toContainText('SIL Open Font License')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
