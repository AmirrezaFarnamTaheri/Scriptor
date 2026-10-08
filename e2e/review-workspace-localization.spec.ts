import { expect, test } from '@playwright/test'
import { launchApp } from './helpers'

const scenarios = [
  {
    locale: 'de', direction: 'ltr', diagram: 'Diagramme',
    labels: ['Datenbank', 'Webclip prüfen', 'Veröffentlichen', 'Drive-Zusammenarbeit', 'Diagramme', 'Code-Konsole', 'Semantische Analyse', 'Medienablage'],
  },
  {
    locale: 'fa', direction: 'rtl', diagram: 'نمودار',
    labels: ['پایگاه داده', 'بررسی مطلب', 'انتشار', 'همکاری در درایو', 'نمودار', 'اجرای کد', 'تحلیل معنایی', 'منابع و رسانه'],
  },
] as const

for (const scenario of scenarios) {
  test(`review workspaces use ${scenario.locale} labels without changing routes or drafts`, async ({ page }, testInfo) => {
    await launchApp(page)
    // This case verifies explicitly pinned integration labels. Fresh profiles
    // intentionally show only the three compact writing shortcuts.
    await page.addInitScript(locale => {
      localStorage.setItem('scriptor:locale', locale)
      localStorage.setItem('scriptor:workspace-shortcuts:v1', JSON.stringify({ version: 1, visible: true, items:
        ['open-database-studio', 'open-capture-reviewer', 'open-publishing-studio', 'open-drive-collaboration', 'open-diagram-studio', 'open-runtime-console', 'open-semantic-inspector', 'open-asset-deck']
          .map(id => ({ id, shown: true, pinned: true, label: '', width: 0, fontSize: 12 })),
      }))
    }, scenario.locale)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', scenario.locale)
    await expect(page.locator('html')).toHaveAttribute('dir', scenario.direction)
    const activity = page.locator('.workspace-activity-bar')
    for (const label of scenario.labels) {
      await expect(activity.getByRole('button', { name: label, exact: true })).toBeVisible()
    }

    await activity.getByRole('button', { name: scenario.diagram, exact: true }).click()
    const leaf = page.locator('[data-leaf-id="feature:open-diagram-studio"]')
    const source = leaf.getByLabel('Diagram source', { exact: true })
    await source.fill('flowchart LR\n  Draft[Localized workspace] --> Saved[Kept draft]')
    await expect(page.getByRole('tab', { name: scenario.diagram, exact: true })).toBeVisible()

    // Search remains usable with a localized label and the established English
    // feature name. Both paths must focus the same leaf and retain its draft.
    for (const query of [scenario.diagram, 'Diagram studio']) {
      await page.keyboard.press('Control+KeyK')
      const palette = page.locator('.command-palette-overlay')
      await expect(palette).toBeVisible()
      await palette.getByRole('searchbox').fill(query)
      const option = palette.locator('#command-palette-item-open-diagram-studio')
      await expect(option.locator('strong')).toHaveText(scenario.diagram)
      await option.click()
      await expect(palette).toBeHidden()
      await expect(leaf).toBeVisible()
      await expect(source).toHaveValue(/Kept draft/)
      await expect(page.locator('[data-leaf-id="feature:open-diagram-studio"]')).toHaveCount(1)
    }

    await page.setViewportSize({ width: 375, height: 900 })
    await expect(page.getByRole('tab', { name: scenario.diagram, exact: true })).toBeVisible()
    const geometry = await page.locator('.workspace-leaf-dock').evaluate(element => ({
      right: element.getBoundingClientRect().right,
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(geometry.right).toBeLessThanOrEqual(geometry.width + 1)
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1)
    await page.screenshot({ path: testInfo.outputPath(`workspace-activity-${scenario.locale}-375.png`), animations: 'disabled' })
  })
}
