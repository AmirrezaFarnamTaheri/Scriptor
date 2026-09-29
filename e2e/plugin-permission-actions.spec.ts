import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { launchApp, waitForWorkspace } from './helpers'

/**
 * A plugin that is neither enabled nor consented had a permanently disabled Enable
 * toggle sitting directly above the "Review and grant required permissions" button
 * that is the only way to change its state. `PluginRegistry.setEnabled` refuses a
 * plugin whose required permissions were not granted for the active vault, so the
 * toggle could never act — inert decoration beside the real action.
 *
 * The toggle must disappear in exactly that state, and must return as soon as it
 * can do something again.
 */
const VAULT_LINT = 'Vault Lint'

async function openInstalled(page: Page) {
  await launchApp(page)
  await waitForWorkspace(page)
  // The store is reached through the inspector's Tools tab, not a command.
  await page.getByRole('tab', { name: 'Tools', exact: true }).click()
  const store = page.locator('.store-root')
  await expect(store.getByRole('tab', { name: 'Manage installed', selected: true })).toBeVisible({
    timeout: 20_000,
  })
  return store
}

test('a plugin awaiting consent shows no inert Enable toggle', async ({ page }) => {
  const store = await openInstalled(page)
  const permissions = store.getByRole('region', { name: `Permissions for ${VAULT_LINT}`, exact: true })
  await expect(permissions).toContainText('read (required)')

  // The card is in the awaiting-consent state: it offers the review action and says
  // a review is required.
  const review = permissions.getByRole('button', {
    name: `Review and grant required permissions for ${VAULT_LINT} in this vault`,
    exact: true,
  })
  await expect(review).toBeVisible()

  // No disabled Enable toggle competing with it anywhere in the card.
  const card = page.locator('.store-card', { has: permissions })
  await expect(card.getByRole('button', { name: 'Enable', exact: true })).toHaveCount(0)
  await expect(card.locator('.store-inline-actions button[disabled]')).toHaveCount(0)
})

test('the review path still enables the plugin, and the toggle returns', async ({ page }) => {
  const store = await openInstalled(page)
  const permissions = store.getByRole('region', { name: `Permissions for ${VAULT_LINT}`, exact: true })
  await expect(permissions).toContainText('read (required)')

  await permissions.getByRole('button', {
    name: `Review and grant required permissions for ${VAULT_LINT} in this vault`,
    exact: true,
  }).click()
  const confirmation = permissions.getByRole('group', { name: `Confirm permissions for ${VAULT_LINT}` })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Grant required access & enable' }).click()
  await expect(confirmation).toBeHidden()

  // Removing the inert toggle must not have removed the only route to enabling.
  await expect(permissions).toContainText('Permissions reviewed for this vault')
  await expect(permissions.getByRole('button', { name: 'Revoke this vault', exact: true })).toBeEnabled()
  const card = store.locator('.store-card').filter({ hasText: VAULT_LINT })
  await expect(card.getByRole('button', { name: 'Enabled', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
    { timeout: 20_000 },
  )
})

test('every card stays reachable because the panel body is the scroll container', async ({ page }) => {
  const store = await openInstalled(page)
  const cards = store.locator('.store-card')
  await expect(cards.first()).toBeVisible()

  // More cards than fit, so something has to scroll. A card that expands an inline
  // confirmation must not push the later ones out of reach.
  const body = store.locator('.store-panel-body')
  const metrics = await body.evaluate((n) => ({
    overflowY: getComputedStyle(n).overflowY,
    scrollHeight: n.scrollHeight,
    clientHeight: n.clientHeight,
  }))
  expect(['auto', 'scroll']).toContain(metrics.overflowY)
  expect(metrics.clientHeight).toBeGreaterThan(0)
  if (metrics.scrollHeight > metrics.clientHeight) {
    const scrolled = await body.evaluate((n) => {
      n.scrollTo(0, n.scrollHeight)
      return n.scrollTop
    })
    expect(scrolled, 'the installed list must scroll when its cards overflow').toBeGreaterThan(0)
  }
})
