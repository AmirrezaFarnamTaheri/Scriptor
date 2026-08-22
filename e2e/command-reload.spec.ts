import { expect, test } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

async function reloadAfterCommandClicks(page: import('@playwright/test').Page, count: number) {
  await page.addInitScript((reloadCount: number) => {
    const remainingKey = 'e2e:command-reloads-remaining'
    if (window.sessionStorage.getItem(remainingKey) === null) {
      window.sessionStorage.setItem(remainingKey, String(reloadCount))
    }

    document.addEventListener(
      'click',
      (event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        const option = target.closest('[role="option"]')
        if (!option?.textContent?.includes('Open graph')) return

        const remaining = Number(window.sessionStorage.getItem(remainingKey) ?? '0')
        if (remaining <= 0) return
        window.sessionStorage.setItem(remainingKey, String(remaining - 1))
        window.setTimeout(() => window.location.reload(), 0)
      },
      true,
    )
  }, count)
}

test('command replay recovers after one document reload', async ({ page }) => {
  await reloadAfterCommandClicks(page, 1)
  await launchApp(page)
  await waitForWorkspace(page)
  await openCommandPalette(page)

  await runCommand(page, 'Open graph')

  await expect(page.getByRole('dialog', { name: 'Knowledge graph' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('e2e:command-reloads-remaining'))).toBe('0')
})

test('command replay fails after two consecutive document reloads', async ({ page }) => {
  await reloadAfterCommandClicks(page, 2)
  await launchApp(page)
  await waitForWorkspace(page)
  await openCommandPalette(page)

  await expect(runCommand(page, 'Open graph')).rejects.toThrow(
    'Command "Open graph" triggered two consecutive document reloads',
  )
})
