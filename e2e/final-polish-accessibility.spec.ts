import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, WORKSPACE_CHROME_PREFS } from './helpers'

const require = createRequire(import.meta.url)
const axeSource = readFileSync(createRequire(require.resolve('@axe-core/cli')).resolve('axe-core/axe.min.js'), 'utf8')

interface AuditResult {
  violations: { id: string; impact: string; nodes: { target: string[]; failureSummary: string }[] }[]
}
interface AuditEngine {
  run(context: { include: string[][] }, options: object): Promise<AuditResult>
}

const surfaces = [
  ['Database studio', 'Database Studio'], ['Capture reviewer', 'Capture reviewer'],
  ['Publishing studio', 'Publishing studio'], ['Drive collaboration', 'Drive collaboration'],
  ['Diagram studio', 'Diagram studio'], ['Runtime console', 'Runtime console'],
  ['Semantic inspector', 'Semantic Inspector'], ['Asset deck', 'Asset deck'],
] as const

for (const [command, region] of surfaces) {
  for (const appearance of ['light', 'dark']) {
    test(`${command} ${appearance} has accessible names, semantics and contrast in its visible workspace`, async ({ page }, testInfo) => {
      await page.addInitScript(() => {
        sessionStorage.setItem('e2e:research', '1')
        sessionStorage.setItem('e2e:asset-media', '1')
      })
      await launchApp(page)
      await openCommandPalette(page)
      await runCommand(page, command)
      const panel = region === 'Asset deck'
        ? page.locator('.asset-deck-workspace[role="region"]')
        : page.getByRole('region', { name: region, exact: true })
      await expect(panel).toBeVisible()
      if (appearance === 'dark') {
        await page.getByRole('button', { name: /Switch to dark appearance/ }).click()
      }
      await expect(page.locator('html')).toHaveAttribute('data-appearance', appearance)
      await page.addScriptTag({ content: axeSource })
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 900 })
        await page.locator('html').evaluate((element, direction) => { element.dir = direction }, width === 320 ? 'rtl' : 'ltr')
        const violations = await page.evaluate(async () => {
          const engine = (window as unknown as { axe: AuditEngine }).axe
          const result = await engine.run({ include: [['.workspace-leaf-content:not([hidden])']] }, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
          })
          return result.violations.map(({ id, impact, nodes }) => ({
            id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
          }))
        })
        await testInfo.attach(`accessibility-${width}px-${appearance}.json`, {
          body: JSON.stringify({ command, appearance, width, violations }, null, 2),
          contentType: 'application/json',
        })
        expect(violations, `${width}px: ${JSON.stringify(violations, null, 2)}`).toEqual([])
      }
    })
  }
}

test('the selected interface font reaches body text and controls after reload', async ({ page }) => {
  await page.addInitScript(prefs => {
    const key = 'scriptor:workspace-chrome'
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, JSON.stringify({ ...prefs, data: { ...prefs.data, uiFontFamily: 'georgia' } }))
    }
  }, WORKSPACE_CHROME_PREFS)
  await launchApp(page)
  for (const reload of [false, true]) {
    if (reload) await page.reload()
    await expect(page.getByRole('main', { name: 'Scriptor workspace' })).toBeVisible()
    await expect(page.locator('body')).toHaveCSS('font-family', /Georgia/)
    await expect(page.getByRole('button', { name: 'Open command palette (Ctrl+K)', exact: true })).toHaveCSS('font-family', /Georgia/)
  }
})
