import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

async function captureGeometry(panel: Locator, width: number, label: string) {
  const geometry = await panel.evaluate(element => {
    const box = element.getBoundingClientRect()
    return {
      left: box.left, right: box.right, overflow: element.scrollWidth - element.clientWidth,
      controls: [...element.querySelectorAll('button,input,select,summary')].filter(control => control.getClientRects().length).map(control => {
        // A checkbox's associated wrapping label is its real clickable target.
        const hitTarget = control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type) ? control.closest('label') ?? control : control
        const rect = hitTarget.getBoundingClientRect()
        return { name: control.getAttribute('aria-label') ?? control.textContent?.trim().slice(0, 90) ?? control.tagName, width: rect.width, height: rect.height }
      }),
    }
  })
  expect.soft(geometry.left, `${label} left edge`).toBeGreaterThanOrEqual(-1)
  expect.soft(geometry.right, `${label} right edge`).toBeLessThanOrEqual(width + 1)
  expect.soft(geometry.overflow, `${label} horizontal overflow`).toBeLessThanOrEqual(1)
  if (width < 400) {
    for (const control of geometry.controls) {
      expect.soft(control.width, `${label} ${control.name} target width`).toBeGreaterThanOrEqual(43.5)
      expect.soft(control.height, `${label} ${control.name} target height`).toBeGreaterThanOrEqual(43.5)
    }
  }
  return geometry
}

async function scrollPanel(panel: Locator, end: boolean) {
  await panel.evaluate((element, bottom) => {
    const candidates = [element, ...element.querySelectorAll('*')].filter(node => node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1)
    for (const node of candidates) {
      const overflow = getComputedStyle(node).overflowY
      if (overflow === 'auto' || overflow === 'scroll') node.scrollTop = bottom ? node.scrollHeight : 0
    }
  }, end)
}

async function auditPopulated(page: Page, panel: Locator, testInfo: TestInfo, name: string, theme: string) {
  const measurements: unknown[] = []
  for (const direction of ['ltr', 'rtl']) {
    await page.locator('html').evaluate((element, value) => element.setAttribute('dir', value), direction)
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: 900 })
      await scrollPanel(panel, false)
      const label = `${name}-${theme}-${direction}-${width}`
      measurements.push({ label, ...await captureGeometry(panel, width, label) })
      await page.screenshot({ path: testInfo.outputPath(`${label}-top.png`), animations: 'disabled' })
      await scrollPanel(panel, true)
      await page.screenshot({ path: testInfo.outputPath(`${label}-bottom.png`), animations: 'disabled' })
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${label} document overflow`).toBeLessThanOrEqual(1)
    }
  }
  await testInfo.attach(`${name}-${theme}-populated-geometry`, { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' })
}

for (const theme of ['light', 'dark']) {
  test(`populated capture review metadata and source snapshot remain usable in ${theme}`, async ({ page }, testInfo) => {
    await page.addInitScript(() => sessionStorage.setItem('e2e:research', '1'))
    await page.route('https://**', route => route.abort())
    await launchApp(page, { theme })
    await openCommandPalette(page); await runCommand(page, 'Capture reviewer')
    const panel = page.getByRole('region', { name: 'Capture reviewer', exact: true })
    const url = panel.getByLabel('Article URL', { exact: true })
    await url.fill('https://example.org/article')
    await panel.getByRole('button', { name: 'Extract preview', exact: true }).click()
    await expect(panel.getByRole('textbox', { name: 'Reviewed Markdown', exact: true })).toHaveValue(/useful research/)
    await panel.getByLabel('Author', { exact: true }).fill('Jane Writer · نویسندهٔ پژوهش')
    await panel.getByLabel('Tags, separated by commas', { exact: true }).fill('research, writing, پژوهش')
    await panel.getByLabel('Vault directory', { exact: true }).fill('research/captured-articles')
    await expect(panel.getByRole('button', { name: 'Save reviewed capture as a new note', exact: true })).toBeEnabled()
    const snapshot = panel.locator('iframe[title="Original source snapshot"]')
    await expect(snapshot).toHaveAttribute('sandbox', '')
    await expect(snapshot).toHaveAttribute('referrerpolicy', 'no-referrer')
    await expect(page.frameLocator('iframe[title="Original source snapshot"]').getByRole('heading', { name: 'Original research finding', exact: true })).toBeVisible()
    await auditPopulated(page, panel, testInfo, 'capture', theme)
    expect.soft(await url.evaluate(element => getComputedStyle(element).direction), 'URL direction').toBe('ltr')
    expect.soft(await panel.getByLabel('Vault directory', { exact: true }).evaluate(element => getComputedStyle(element).direction), 'vault path direction').toBe('ltr')
  })

  test(`populated publication plan and deployment settings remain usable in ${theme}`, async ({ page }, testInfo) => {
    await page.addInitScript(() => { sessionStorage.setItem('e2e:research', '1'); sessionStorage.setItem('e2e:publishing-audit', '1') })
    await page.route('https://**', route => route.abort())
    await launchApp(page, { theme })
    await openCommandPalette(page); await runCommand(page, 'Publishing studio')
    const panel = page.getByRole('region', { name: 'Publishing studio', exact: true })
    const folder = panel.getByLabel('Local site folder', { exact: true })
    await folder.fill('C:/reviewed-site')
    await panel.getByRole('button', { name: 'Review publication plan', exact: true }).click()
    const row = panel.locator('tbody tr').filter({ hasText: 'Research Plan.md' })
    await expect(row).toContainText('Excluded by the current plan')
    await expect(row.getByRole('button', { name: 'Opt out Research Plan.md', exact: true })).toBeVisible()
    await row.getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(panel.getByText('Local note preview:', { exact: false })).toBeVisible()
    await panel.locator('summary').filter({ hasText: 'Cloudflare Pages deployment and custom domain' }).click()
    await panel.getByLabel('Account ID', { exact: true }).fill('a'.repeat(32))
    await panel.getByLabel('Project name', { exact: true }).fill('reviewed-research-project')
    await panel.getByLabel('Custom domain', { exact: true }).fill('research.example.org')
    await expect(panel.getByRole('button', { name: 'Deploy reviewed build', exact: true })).toBeDisabled()
    await auditPopulated(page, panel, testInfo, 'publishing', theme)
    for (const label of ['Local site folder', 'Account ID', 'Project name', 'Custom domain']) {
      expect.soft(await panel.getByLabel(label, { exact: true }).evaluate(element => getComputedStyle(element).direction), `${label} direction`).toBe('ltr')
    }
  })
}
