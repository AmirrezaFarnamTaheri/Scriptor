import { expect, test } from '@playwright/test'

test.describe('MCP write-approved', () => {
  test('write-approved mode allows proposePatch invoke', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(() => typeof window.__scriptorE2eMcpWriteApproved === 'function', null, {
      timeout: 30_000,
    })

    const result = await page.evaluate(async () => {
      if (!window.__scriptorE2eMcpWriteApproved) {
        throw new Error('E2E MCP harness not installed')
      }
      return window.__scriptorE2eMcpWriteApproved()
    })

    expect(result.ok).toBe(true)
    expect(result.saved).toMatchObject({ path: 'draft.md', markdown: '# Hello\n\nPatched\n' })
  })
})
