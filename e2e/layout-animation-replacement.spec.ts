import { expect, test } from '@playwright/test'
import { launchApp, settleLayout } from './helpers'

test('layout readiness observes cancelled transitions without retaining their stale completion promises', async ({ page }) => {
  await launchApp(page)
  await settleLayout(page)
  await page.evaluate(() => {
    const original = document.getAnimations.bind(document)
    let state: AnimationPlayState = 'running'
    const transition = {
      get playState() { return state },
      playbackRate: 1,
      effect: { getComputedTiming: () => ({ endTime: 10 }) },
      // Chromium can replace this promise when a transition becomes idle.
      get finished() {
        state = 'idle'
        return new Promise<void>(() => undefined)
      },
    } as unknown as Animation
    document.getAnimations = () => {
      requestAnimationFrame(() => { state = 'idle' })
      return [...original(), transition]
    }
  })
  await settleLayout(page)
  await expect(page.getByRole('main', { name: 'Scriptor workspace' })).toBeVisible()
})

test('Tools menu initializes focus after the activating key finishes dispatching', async ({ page }) => {
  await launchApp(page)
  await settleLayout(page)
  const trigger = page.getByRole('button', { name: 'Tools', exact: true })
  await trigger.focus()
  await page.evaluate(() => {
    const trigger = document.querySelector<HTMLButtonElement>('.tools-trigger')!
    // Reproduce an editor's final focus restoration in the same key dispatch.
    window.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') queueMicrotask(() => trigger.focus())
    }, { once: true })
  })
  await trigger.press('ArrowDown')
  const menu = page.getByRole('menu', { name: 'Tools', exact: true })
  await expect(menu.getByRole('menuitem').first()).toBeFocused()
  await page.keyboard.press('End')
  await expect(menu.getByRole('menuitem').last()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})
