import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import { settleLayout } from './helpers'

/** Call after the state's content assertions; retain both surrounding chrome and readable detail. */
export async function attachVisualState(page: Page, testInfo: TestInfo, name: string, target: Locator, focus: Locator) {
  await expect(target).toBeVisible()
  await expect(focus).toBeVisible()
  await settleLayout(page)
  await focus.scrollIntoViewIfNeeded()
  // Center small anchors rather than leaving their final line against a
  // rounded scrollport edge; preserve full containment as the readiness gate.
  if (focus !== target) await focus.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }))
  await expect(focus).toBeInViewport({ ratio: 1 })
  await testInfo.attach(`${name}-viewport`, {
    body: await page.screenshot({ fullPage: false, animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  })
  await testInfo.attach(`${name}-detail`, {
    body: await target.screenshot({ animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  })
}
