import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import { settleLayout } from './helpers'

/** Call after the state's content assertions; retain both surrounding chrome and readable detail. */
export async function attachVisualState(page: Page, testInfo: TestInfo, name: string, target: Locator, focus: Locator) {
  await expect(target).toBeVisible()
  await expect(focus).toBeVisible()
  await expect(page.locator('.editor-loading-state')).toHaveCount(0)
  await settleLayout(page)
  // Scroll the panel's own scrollports. scrollIntoView also scrolls the page,
  // which can crop the workspace beneath its sticky header and move the footer.
  await focus.evaluate(element => {
    for (let parent = element.parentElement; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
      const style = getComputedStyle(parent)
      const box = parent.getBoundingClientRect()
      const anchor = element.getBoundingClientRect()
      if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight) {
        const scale = box.height / parent.offsetHeight || 1
        parent.scrollTop += (anchor.top + anchor.height / 2 - box.top - box.height / 2) / scale
      }
      if (/(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth) {
        const current = element.getBoundingClientRect()
        const scale = box.width / parent.offsetWidth || 1
        if (current.left < box.left) parent.scrollLeft += (current.left - box.left) / scale
        else if (current.right > box.right) parent.scrollLeft += (current.right - box.right) / scale
      }
    }
  })
  await expect(focus).toBeInViewport({ ratio: 1 })
  await testInfo.attach(`${name}-viewport`, {
    body: await page.screenshot({ fullPage: false, animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  })
  await testInfo.attach(`${name}-detail`, {
    body: await focus.screenshot({ animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  })
}
