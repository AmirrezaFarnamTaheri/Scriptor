import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import { settleLayout } from './helpers'

/** Call after the state's content assertions; retain both surrounding chrome and readable detail. */
export async function attachVisualState(page: Page, testInfo: TestInfo, name: string, target: Locator, focus: Locator = target) {
  await expect(target).toBeVisible()
  await expect(focus).toBeVisible()
  await focus.scrollIntoViewIfNeeded()
  // Large panels can scroll; explicitly chosen controls must fit completely.
  await expect(focus).toBeInViewport({ ratio: focus === target ? 0 : 1 })
  await settleLayout(page)
  await testInfo.attach(`${name}-viewport`, {
    body: await page.screenshot({ fullPage: false, animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  })
  await testInfo.attach(`${name}-detail`, {
    body: await target.screenshot({ animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  })
}
