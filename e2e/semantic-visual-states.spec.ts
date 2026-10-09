import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'
import { attachVisualState } from './visual-state-evidence'

test('populated semantic projection rotates in 3D, filters similarity results and preserves measurements on reindex failure', async ({ page }, testInfo) => {
  await launchApp(page, { theme: 'dark' })
  await page.evaluate(() => {
    const api = (window as Window & { __TAURI_INTERNALS__?: { invoke: (command: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__
    if (!api) throw new Error('Native fixture unavailable')
    const original = api.invoke.bind(api)
    api.invoke = async (command, args = {}, options) => {
      if (command.startsWith('semantic_') || command === 'authorize_sensitive_operation') {
        const calls = JSON.parse(sessionStorage.getItem('e2e:semantic-calls') ?? '[]')
        calls.push({ command, args })
        sessionStorage.setItem('e2e:semantic-calls', JSON.stringify(calls))
      }
      if (command === 'vault_load_config') return {
        ...(await original(command, args, options) as Record<string, unknown>),
        semantic: { provider: 'ollama', model: 'nomic-embed-text', dimension: 768, base_url: 'http://localhost:11434' },
      }
      if (command === 'semantic_inspect') return JSON.stringify({
        available: true, provider: 'ollama', model: 'nomic-embed-text', dimension: 768,
        total_notes: 3, indexed: 3, current: 2, stale: 1, missing: 0, orphaned: 0, invalid: 0,
        sampled: 3, truncated: false, projection: 'PCA', explained_variance: [0.6, 0.3, 0.1],
        points: [
          { note_path: 'Research Plan.md', coordinates: [1, 0.5, 0.2], stale: false },
          { note_path: 'Field Notes.md', coordinates: [-0.6, 0.2, 0.8], stale: true },
          { note_path: 'Methodology.md', coordinates: [0.2, -0.9, -0.4], stale: false },
        ],
      })
      if (command === 'semantic_search') return JSON.stringify([
        { note_path: 'Research Plan.md', score: 0.94 }, { note_path: 'Field Notes.md', score: 0.72 },
      ])
      if (command === 'semantic_sync') throw new Error('Embedding provider unavailable. Existing vectors were retained; retry when the provider is reachable.')
      return original(command, args, options)
    }
  })
  await openCommandPalette(page)
  await runCommand(page, 'Semantic inspector')
  const panel = page.getByRole('region', { name: 'Semantic Inspector', exact: true })
  const projection = panel.locator('.semantic-projection')
  await expect(projection.locator('g[role="button"]')).toHaveCount(3)
  await expect(projection.locator('circle.stale')).toHaveCount(1)
  await expect(panel.getByRole('button', { name: 'Reindex changed notes', exact: true })).toBeEnabled()
  await attachVisualState(page, testInfo, 'semantic-dark-populated-2d', panel)

  await panel.getByRole('combobox', { name: 'Projection view', exact: true }).selectOption('3d')
  const point = projection.getByRole('button', { name: 'Research Plan.md', exact: true }).locator('circle')
  const before = await point.getAttribute('cx')
  const rotation = panel.getByRole('slider', { name: 'Rotation', exact: true })
  await rotation.focus()
  await rotation.press('Home')
  await expect(rotation).toHaveValue('-3.14')
  await expect.poll(() => point.getAttribute('cx')).not.toBe(before)
  await panel.getByRole('slider', { name: 'Tilt', exact: true }).press('End')
  await expect(panel.getByRole('slider', { name: 'Tilt', exact: true })).toHaveValue('1.57')
  await expect(projection).toHaveAttribute('aria-label', 'Semantic Inspector: 3d')
  await attachVisualState(page, testInfo, 'semantic-dark-rotated-3d', panel)

  const search = panel.getByRole('group', { name: 'Find similar notes', exact: true })
  await search.getByRole('textbox', { name: 'Find similar notes', exact: true }).fill('research evidence')
  await search.getByRole('button', { name: 'Search by cosine similarity', exact: true }).click()
  await expect(search.locator('output')).toHaveText(['0.940', '0.720'])
  await attachVisualState(page, testInfo, 'semantic-similarity-results', search)
  const threshold = search.getByRole('slider', { name: /Minimum cosine similarity/ })
  await threshold.focus()
  await threshold.press('End')
  await expect(search.getByText('No results meet this threshold.', { exact: true })).toBeVisible()
  await attachVisualState(page, testInfo, 'semantic-filtered-empty-results', search)

  await page.setViewportSize({ width: 375, height: 844 })
  await page.locator('html').evaluate(element => { element.dir = 'rtl' })
  await panel.getByRole('button', { name: 'Reindex changed notes', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('Existing vectors were retained')
  await expect(projection.locator('g[role="button"]')).toHaveCount(3)
  await expect(panel.getByRole('button', { name: 'Reindex changed notes', exact: true })).toBeEnabled()
  await expect.poll(() => panel.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await attachVisualState(page, testInfo, 'semantic-narrow-rtl-reindex-failure', panel, panel.getByRole('alert'))

  const calls = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e:semantic-calls') ?? '[]') as Array<{ command: string; args: Record<string, unknown> }>)
  expect(calls.filter(call => call.command === 'semantic_search')).toEqual([
    expect.objectContaining({ args: expect.objectContaining({ query: 'research evidence', expectedVaultId: 'screenshot-vault' }) }),
  ])
  expect(calls.filter(call => call.command === 'semantic_sync')).toHaveLength(1)
  expect(calls.filter(call => call.command === 'authorize_sensitive_operation' && call.args.operation === 'ai_network_request')).toHaveLength(2)
})
