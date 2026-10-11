import { expect, test } from '@playwright/test'
import { launchApp, settleLayout } from './helpers'

test('layout readiness does not wait for a paused finite animation', async ({ page }) => {
  await launchApp(page)
  await page.evaluate(async () => {
    const target = document.createElement('div')
    target.id = 'paused-layout-fixture'
    target.textContent = 'Paused content remains visible'
    document.body.append(target)
    const animation = target.animate([{ opacity: 1 }, { opacity: 0.5 }], { duration: 60_000 })
    animation.pause()
    await animation.ready
  })
  await settleLayout(page)
  await expect(page.locator('#paused-layout-fixture')).toBeVisible()
  expect(await page.locator('#paused-layout-fixture').evaluate(element => element.getAnimations()[0]?.playState)).toBe('paused')
})

test('layout readiness waits for a running finite animation to finish', async ({ page }) => {
  await launchApp(page)
  await settleLayout(page)
  await page.evaluate(() => {
    const target = document.createElement('div')
    target.id = 'running-layout-fixture'
    target.textContent = 'Finished content remains visible'
    document.body.append(target)
    target.animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: 5_000, fill: 'forwards' })
  })
  expect(await page.locator('#running-layout-fixture').evaluate(element => element.getAnimations()[0]?.playState)).toBe('running')
  await settleLayout(page)
  await expect(page.locator('#running-layout-fixture')).toBeVisible()
  expect(await page.locator('#running-layout-fixture').evaluate(element => element.getAnimations()[0]?.playState)).toBe('finished')
})
