import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { appendEditorLine, launchApp, openCommandPalette, runCommand, WORKSPACE_CHROME_PREFS } from './helpers'

const reportStyles = ['workspace.css', 'foundation.css', 'features.css'].map(path => readFileSync(new URL(`../src/styles/app/${path}`, import.meta.url), 'utf8')).join('\n')

test('short snippet lists stay together at the top of a tall panel', async ({ page }) => {
  await page.setContent(`<style>${reportStyles}</style><div class="snippets-layout" style="height:600px"><aside style="display:grid;grid-template-rows:auto minmax(0,1fr)"><h3>Snippets</h3><ul><li><button>First</button></li><li><button>Second</button></li></ul></aside></div>`)
  const gap = await page.locator('li').evaluateAll(elements => elements[1].getBoundingClientRect().top - elements[0].getBoundingClientRect().bottom)
  expect(gap).toBeLessThanOrEqual(5)
})

test('RTL history arrows reverse direction and hibernated labels retain opacity', async ({ page }) => {
  await page.setContent(`<style>${reportStyles}</style><div class="history-controls"><button><svg class="flip"></svg></button><button><svg></svg></button></div><button class="subsystem-toggle-badge hibernated">Diagnostics</button>`)
  await page.locator('html').evaluate(element => element.setAttribute('dir', 'rtl'))
  await expect(page.locator('.history-controls button:first-child svg')).toHaveCSS('transform', 'none')
  await expect(page.locator('.history-controls button:nth-child(2) svg')).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)')
  await expect(page.locator('.hibernated')).toHaveCSS('opacity', '1')
})

test('desktop kanban columns use the available board width', async ({ page }) => {
  await launchApp(page)
  await page.getByRole('button', { name: 'Sprint Board.md', exact: true }).click()
  await openCommandPalette(page)
  await runCommand(page, 'Open kanban')
  const board = page.locator('.kanban-board')
  await expect(board).toBeVisible()
  const bounds = await board.evaluate(element => {
    const style = getComputedStyle(element)
    const available = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const columns = Array.from(element.querySelectorAll('.kanban-column'))
    const first = columns[0].getBoundingClientRect()
    const last = columns.at(-1)!.getBoundingClientRect()
    return { available, used: last.right - first.left }
  })
  expect(bounds.used).toBeGreaterThanOrEqual(bounds.available - 2)
})

test('canvas selection uses a readable count instead of internal identifiers', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open canvas')
  const canvas = page.getByRole('dialog', { name: 'Canvas board', exact: true })
  await expect(canvas).toBeVisible()
  await canvas.getByRole('button', { name: 'Add first card', exact: true }).click()
  const card = canvas.locator('.canvas-block').first()
  await card.click()
  await expect(canvas.locator('.canvas-footer')).toContainText('Selected 1 block')
  await expect(canvas.locator('.canvas-footer')).not.toContainText(/[a-f0-9]{8}-[a-f0-9]{4}-/)
})

test('an unopened vault does not report measured health or perpetual loading', async ({ page }) => {
  await page.addInitScript(prefs => {
    localStorage.setItem('scriptor:onboarding-complete', 'true')
    localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(prefs))
    sessionStorage.setItem('e2e:no-auto-open', '1')
  }, WORKSPACE_CHROME_PREFS)
  await page.goto('/')
  await expect(page.getByText('Open your writing workspace', { exact: true })).toBeVisible()
  await expect(page.locator('.inspector-panel .metric-grid')).toHaveCount(0)
  await expect(page.locator('.inspector-panel')).not.toContainText('Loading…')
})

test('theme builder exposes the complete border value at desktop and narrow widths', async ({ page }) => {
  await launchApp(page)
  await page.locator('header.topbar').getByRole('button', { name: 'Settings', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  await settings.getByRole('tab', { name: 'Appearance', exact: true }).click()
  await settings.getByRole('button', { name: 'Manage color palettes', exact: true }).click()
  await page.getByRole('dialog', { name: 'Color palettes', exact: true })
    .getByRole('button', { name: 'Create Custom Palette', exact: true }).click()
  const builder = page.getByRole('dialog', { name: 'Theme Customizer & Builder', exact: true })
  const border = builder.locator('textarea#custom-theme-border')
  await expect(border).toHaveValue('rgba(148, 163, 184, 0.2)')
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await border.scrollIntoViewIfNeeded()
    const geometry = await border.evaluate(element => ({
      clipped: element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight,
      right: element.getBoundingClientRect().right,
    }))
    expect(geometry.clipped, `complete border value at ${width}px`).toBe(false)
    expect(geometry.right).toBeLessThanOrEqual(width)
  }
})

test('rendered output formats resolved citations and preserves their source', async ({ page }) => {
  await launchApp(page)
  await page.getByRole('tab', { name: 'Rendered output', exact: true }).click()
  const preview = page.locator('.inspector-panel').getByRole('article', { name: 'Markdown preview' })
  await expect(preview).toContainText('Research Plan')
  const citation = preview.locator('.preview-citation[data-resolved="true"]').first()
  await expect(citation).toBeVisible()
  await expect(citation).toHaveAttribute('title', '[@smith2024]')
  await expect(citation).not.toHaveText('[@smith2024]')
})

test('missing citations remain explicit and code examples retain literal syntax', async ({ page }) => {
  await launchApp(page)
  await appendEditorLine(page, 'Missing [@unknownReviewKey]; code example `[@smith2024]`.')
  await page.getByRole('tab', { name: 'Rendered output', exact: true }).click()
  const preview = page.locator('.inspector-panel').getByRole('article', { name: 'Markdown preview' })
  const missing = preview.locator('.preview-citation[data-resolved="false"]')
  await expect(missing).toHaveText('[@unknownReviewKey]')
  await expect(missing).toHaveAttribute('aria-label', /Unresolved.*unknownReviewKey/i)
  await expect(preview.locator('code').filter({ hasText: '[@smith2024]' })).toHaveText('[@smith2024]')
  await expect(preview.locator('code .preview-citation')).toHaveCount(0)
})

test('triage keeps metrics aligned and its progress action separate from note rows', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('e2e:knowledge-repair-notes', '1'))
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open knowledge workbench')
  const workbench = page.getByRole('dialog', { name: 'Knowledge workbench', exact: true })
  await workbench.getByRole('tab', { name: /Orphans \(3\)/ }).click()
  await workbench.getByRole('button', { name: /Start triage/ }).click()
  await expect(workbench.getByText(/Triage 1 of 3/)).toBeVisible()
  const rightEdges = await workbench.locator('.knowledge-note-meta').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().right))
  expect(Math.max(...rightEdges) - Math.min(...rightEdges)).toBeLessThanOrEqual(1)
  await workbench.locator('.knowledge-triage-bar').getByRole('button', { name: 'Next', exact: true }).click()
  await expect(workbench.getByText(/Triage 2 of 3/)).toBeVisible()
})

test('writing-history chart shows stable values on its first rendered frames', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await launchApp(page)
  await page.getByRole('button', { name: 'Tools', exact: true }).click()
  await page.getByRole('menuitem', { name: /Writing targets/i }).click()
  const targets = page.getByRole('dialog', { name: 'Writing targets', exact: true })
  const canvas = targets.locator('canvas')
  await expect(canvas).toBeVisible()
  const stable = await canvas.evaluate(async element => {
    const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await frame()
    await frame()
    const first = element.toDataURL()
    await frame()
    await frame()
    return first === element.toDataURL()
  })
  expect(stable).toBe(true)
})
