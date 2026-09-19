import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// Preserve application cascade order: the geometry contract loads after the
// viewport rules. The fixture exercises the real styles, not copied overrides.
const styles = [
  '../src/styles/app/inspector.css',
  '../src/styles/app/responsive.css',
  '../src/styles/app/workspace-geometry-contract.css',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n')
const labels = ['Broken links', 'Orphan assets', 'Duplicate titles', 'Invalid frontmatter', 'Missing citations', 'Indexed notes', 'Vault words', 'Cache']

for (const width of [236, 340, 510]) {
  for (const direction of ['ltr', 'rtl']) {
    test(`health metrics adapt to a ${width}px ${direction} rail independently of viewport width`, async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.setContent(`<style>* { box-sizing: border-box; }</style><style>${styles}</style>
        <aside class="inspector-panel" style="width:${width}px" dir="${direction}">
          <section class="widget-card"><div class="metric-grid">
            ${labels.map((label) => `<div class="metric"><span>${label}</span><strong>0</strong></div>`).join('')}
          </div></section>
        </aside>`)
      const geometry = await page.locator('.metric-grid').evaluate((element) => ({
        columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
        overflow: element.scrollWidth > element.clientWidth,
      }))
      expect(geometry).toEqual({ columns: width < 450 ? 2 : 4, overflow: false })
    })
  }
}
