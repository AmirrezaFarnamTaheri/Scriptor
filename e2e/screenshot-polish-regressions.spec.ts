import { expect, test, type Locator, type Page } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

async function prepare(page: Page) {
  await launchApp(page)
  const narrow = (page.viewportSize()?.width ?? 1440) <= 768
  const magnifiedMobile = await page.locator('html').getAttribute('data-ui-reflow') === 'mobile'
  await waitForWorkspace(page, { allowHiddenVaultList: narrow || magnifiedMobile })
}

async function openPanel(page: Page, command: string) {
  await openCommandPalette(page)
  await runCommand(page, command)
}

for (const panel of [
  { command: 'Support Scriptor', selector: '.support-panel' },
  { command: 'Note history timeline', selector: '.note-history-panel' },
  { command: 'Open portal clipboard', selector: '.portal-panel' },
]) {
  test(`${panel.command} keeps its first content clear of the header divider`, async ({ page }) => {
    await prepare(page)
    await openPanel(page, panel.command)
    const shell = page.locator(panel.selector)
    await expect(shell).toBeVisible()
    for (const direction of ['ltr', 'rtl']) {
      await page.locator('html').evaluate((element, value) => { element.dir = value }, direction)
      await expect.poll(() => shell.evaluate(element => {
        const body = element.querySelector('.unified-panel-body')!
        const header = element.querySelector('.unified-panel-header')!
        const firstContent = body.firstElementChild!
        return firstContent.getBoundingClientRect().top - header.getBoundingClientRect().bottom
      })).toBeGreaterThanOrEqual(12)
    }
  })
}

async function controlStyle(control: Locator) {
  return control.evaluate(element => {
    const style = getComputedStyle(element)
    return {
      height: element.getBoundingClientRect().height,
      border: Number.parseFloat(style.borderTopWidth),
      radius: Number.parseFloat(style.borderTopLeftRadius),
      background: style.backgroundColor,
    }
  })
}

test('sticky view modes keep an opaque base over scrolling formatting actions', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await prepare(page)
  const modes = page.locator('.editor-view-modes').first()
  await expect(modes).toBeVisible()
  await expect.poll(() => modes.evaluate(element => {
    const style = getComputedStyle(element)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d')!
    context.fillStyle = style.backgroundColor
    context.fillRect(0, 0, 1, 1)
    return { position: style.position, alpha: context.getImageData(0, 0, 1, 1).data[3] }
  })).toEqual({ position: 'sticky', alpha: 255 })
})

test('expanded desktop footer reserves space for every status control and vault identity', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem('scriptor:status-dock-collapsed', 'false'))
  await prepare(page)
  const summary = page.locator('.status-summary')
  const repo = summary.locator('.repo-state')
  await expect(repo).toBeVisible()
  await expect(repo.locator('.repo-vault')).toBeVisible()
  for (const direction of ['ltr', 'rtl']) {
    await page.locator('html').evaluate((element, value) => { element.dir = value }, direction)
    await expect.poll(() => summary.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      const descendants = [...element.querySelectorAll('.repo-state, .repo-state button, .repo-vault, .repo-vault svg')]
        .filter(target => target.getBoundingClientRect().width > 0)
      return descendants.every(target => {
        const box = target.getBoundingClientRect()
        return box.left >= bounds.left - 1 && box.right <= bounds.right + 1
      })
    })).toBe(true)
    await expect.poll(() => repo.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  }
})

for (const zoom of [1.25, 1.5, 2]) {
  test(`magnified header owners and their controls do not overlap at ${zoom * 100}%`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('scriptor:ui-zoom', String(value)), zoom)
    await prepare(page)
    for (const direction of ['ltr', 'rtl']) {
      await page.locator('html').evaluate((element, value) => { element.dir = value }, direction)
      await expect.poll(() => page.locator('.topbar').evaluate(element => {
        const visible = (target: Element) => target.getBoundingClientRect().width > 0 && target.getBoundingClientRect().height > 0
        const groups = [...element.children].filter(visible)
        const overlaps = (children: Element[]) => children.some((a, index) => children.slice(index + 1).some(b => {
          const first = a.getBoundingClientRect(), second = b.getBoundingClientRect()
          return first.left < second.right - 1 && first.right > second.left + 1 && first.top < second.bottom - 1 && first.bottom > second.top + 1
        }))
        return overlaps(groups) || groups.filter(group => group.matches('.brand, .history-controls')).some(group => overlaps([...group.children].filter(visible)))
      })).toBe(false)
      await expect.poll(() => page.locator('.repo-state').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    }
  })
}

test('palette search focus ring has clearance on all sides', async ({ page }) => {
  await prepare(page)
  for (const direction of ['ltr', 'rtl']) {
    await page.locator('html').evaluate((element, value) => { element.dir = value }, direction)
    await openCommandPalette(page)
    const palette = page.locator('.command-palette')
    const search = palette.getByRole('searchbox')
    await expect(search).toBeFocused()
    await expect.poll(() => search.evaluate(element => {
      const field = element.getBoundingClientRect()
      const header = element.parentElement!.getBoundingClientRect()
      const style = getComputedStyle(element)
      const ring = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset)
      return Math.min(field.top - header.top, header.bottom - field.bottom, field.left - header.left, header.right - field.right) - ring
    })).toBeGreaterThanOrEqual(2)
    await page.keyboard.press('Escape')
  }
})

test('collections keep compact rows and themed selection controls', async ({ page }) => {
  await prepare(page)
  await openPanel(page, 'Open knowledge workbench')
  const workbench = page.getByRole('dialog', { name: 'Knowledge workbench', exact: true })
  await workbench.getByRole('tab', { name: 'Collections', exact: true }).click()
  const rows = workbench.locator('.smart-collection')
  await expect(rows).toHaveCount(3)
  await expect.poll(() => rows.evaluateAll(elements => {
    const boxes = elements.map(element => element.getBoundingClientRect())
    return Math.max(...boxes.slice(1).map((box, index) => box.top - boxes[index].bottom))
  })).toBeLessThanOrEqual(12)
  const style = await controlStyle(rows.first().getByRole('button').first())
  expect(style.height).toBeGreaterThanOrEqual(36)
  expect(style.border).toBeGreaterThanOrEqual(1)
})

test('saved views actions have themed bounds and separated presets', async ({ page }) => {
  await prepare(page)
  await openPanel(page, 'Open knowledge workbench')
  const workbench = page.getByRole('dialog', { name: 'Knowledge workbench', exact: true })
  await workbench.getByRole('tab', { name: 'Views', exact: true }).click()
  const style = await controlStyle(workbench.getByRole('button', { name: 'Open Database Studio', exact: true }))
  expect(style.height).toBeGreaterThanOrEqual(36)
  expect(style.border).toBeGreaterThanOrEqual(1)
  expect(await workbench.locator('.saved-views-presets').evaluate(element => Number.parseFloat(getComputedStyle(element).gap))).toBeGreaterThanOrEqual(8)
})

test('canvas new-board action follows the surrounding control treatment', async ({ page }) => {
  await prepare(page)
  await openPanel(page, 'Open canvas')
  const canvas = page.getByRole('dialog', { name: 'Canvas board', exact: true })
  const style = await controlStyle(canvas.getByRole('button', { name: 'New board', exact: true }))
  expect(style.height).toBeGreaterThanOrEqual(36)
  expect(style.border).toBeGreaterThanOrEqual(1)
})

for (const width of [1440, 320]) {
  test(`toolbar customizer uses themed fields and contained controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await prepare(page)
    await page.locator('.editor-toolbar .customize-trigger').click()
    const dialog = page.getByRole('dialog', { name: /Customize toolbar/i })
    const close = dialog.locator('.toolbar-customizer-close')
    await expect(close.locator('svg')).toHaveCount(1)
    const row = dialog.locator('.toolbar-customize-row').first()
    const field = await controlStyle(row.getByRole('spinbutton'))
    expect(field.height).toBeGreaterThanOrEqual(36)
    expect(field.border).toBeGreaterThanOrEqual(1)
    const order = await controlStyle(row.locator('.toolbar-customize-order button').last())
    expect(order.height).toBeGreaterThanOrEqual(36)
    expect(order.border).toBeGreaterThanOrEqual(1)
    await expect.poll(() => dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    await expect.poll(() => dialog.locator('.toolbar-customizer-list').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    const last = dialog.locator('.toolbar-customize-row').last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport()
    await expect(dialog.getByRole('button', { name: 'Apply', exact: true })).toBeInViewport()
  })
}

test('rename dialog uses a centered SVG close icon and themed checkbox accent', async ({ page }) => {
  await prepare(page)
  await page.locator('.virtual-note-list').getByRole('button', { name: 'Research Plan.md', exact: true }).click({ button: 'right' })
  const dialog = page.getByRole('dialog', { name: 'Rename note', exact: true })
  const close = dialog.getByRole('button', { name: 'Close', exact: true })
  await expect(close.locator('svg')).toHaveCount(1)
  expect(await close.evaluate(element => {
    const button = element.getBoundingClientRect()
    const icon = element.querySelector('svg')!.getBoundingClientRect()
    return Math.abs((button.top + button.bottom - icon.top - icon.bottom) / 2)
  })).toBeLessThanOrEqual(1)
  expect(await dialog.getByRole('checkbox').evaluate(element => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--primary)'
    element.parentElement!.appendChild(probe)
    const primary = getComputedStyle(probe).color
    probe.remove()
    return getComputedStyle(element).accentColor === primary
  })).toBe(true)
})

test('merge-conflict preview and bulk actions have interior clearance', async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem('e2e:git-conflicts', '1'))
  await prepare(page)
  await openPanel(page, 'Open Git panel')
  await page.locator('.git-panel').getByRole('button', { name: 'Resolve', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Resolve merge conflicts', exact: true })
  const geometry = await dialog.evaluate(element => {
    const preview = getComputedStyle(element.querySelector('.conflict-merged-body')!)
    const bulk = getComputedStyle(element.querySelector('.conflict-bulk-actions')!)
    const title = element.querySelector('header h2')!.getBoundingClientRect()
    const close = element.querySelector('header .icon-button')!.getBoundingClientRect()
    return { padding: Number.parseFloat(preview.paddingLeft), gap: Number.parseFloat(bulk.gap), center: Math.abs((title.top + title.bottom - close.top - close.bottom) / 2) }
  })
  expect(geometry.padding).toBeGreaterThanOrEqual(12)
  expect(geometry.gap).toBeGreaterThanOrEqual(8)
  expect(geometry.center).toBeLessThanOrEqual(1)
})

test('Git preview and confirmation actions keep themed bounds and separate targets', async ({ page }) => {
  await prepare(page)
  await openPanel(page, 'Open Git panel')
  const panel = page.getByRole('dialog', { name: 'Git', exact: true })
  const preview = await controlStyle(panel.getByRole('button', { name: 'Preview diff', exact: true }))
  expect(preview.height).toBeGreaterThanOrEqual(32)
  expect(preview.border).toBeGreaterThanOrEqual(1)
  expect(preview.radius).toBeGreaterThan(0)
  const form = panel.locator('.git-commit-form')
  await form.getByRole('textbox').fill('test: preview balanced confirmation controls')
  await form.getByRole('button', { name: /^Commit selected \([1-9]\d*\)$/ }).click()
  const confirmation = panel.getByRole('alertdialog', { name: 'Confirm Git action', exact: true })
  await expect(confirmation).toBeVisible()
  const gap = await confirmation.locator('.git-confirm-actions').evaluate(element => {
    const buttons = [...element.querySelectorAll('button')].map(button => button.getBoundingClientRect())
    return Math.max(buttons[1].left - buttons[0].right, buttons[1].top - buttons[0].bottom)
  })
  expect(gap).toBeGreaterThanOrEqual(8)
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(confirmation).toBeHidden()
})

test('narrow large-vault labels never overlap their identifying suffixes', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 })
  await page.addInitScript(() => window.sessionStorage.setItem('e2e:large-vault', '1'))
  await prepare(page)
  const list = page.locator('.vault-panel .virtual-note-list')
  await list.evaluate(element => { element.parentElement!.scrollTop = element.parentElement!.scrollHeight })
  await expect.poll(() => list.locator('.note-label-identity').count()).toBeGreaterThan(0)
  for (const direction of ['ltr', 'rtl']) {
    await page.locator('html').evaluate((element, value) => { element.dir = value }, direction)
    const geometry = await list.locator('.note-label').evaluateAll(elements => elements.flatMap(element => {
      const prefix = element.querySelector('.note-label-prefix')!.getBoundingClientRect()
      const identity = element.querySelector('.note-label-identity')?.getBoundingClientRect()
      if (!identity) return []
      const rtl = getComputedStyle(element).direction === 'rtl'
      return [{ gap: rtl ? prefix.left - identity.right : identity.left - prefix.right, overflow: (element as HTMLElement).scrollWidth - (element as HTMLElement).clientWidth }]
    }))
    for (const label of geometry) {
      expect(label.gap).toBeGreaterThanOrEqual(1)
      expect(label.overflow).toBeLessThanOrEqual(1)
    }
  }
})

test('narrow German vault navigation keeps labels and calendar icon contained', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.addInitScript(() => localStorage.setItem('scriptor:locale', 'de'))
  await prepare(page)
  const rail = page.locator('.vault-panel')
  const geometry = await rail.evaluate(element => {
    const nav = element.querySelector('.vault-nav-tabs')!
    const buttons = [...nav.querySelectorAll('button')].map(button => button.getBoundingClientRect())
    const date = element.querySelector('.daily-note-button')!.getBoundingClientRect()
    const icon = element.querySelector('.daily-note-button > svg')!.getBoundingClientRect()
    return { rowGap: buttons[1].top - buttons[0].bottom, iconWidth: icon.width, iconInset: icon.left - date.left, navColumns: getComputedStyle(nav).gridTemplateColumns.split(' ').length }
  })
  expect(geometry.navColumns).toBe(1)
  expect(geometry.rowGap).toBeGreaterThanOrEqual(6)
  expect(geometry.iconWidth).toBeGreaterThanOrEqual(16)
  expect(geometry.iconInset).toBeGreaterThanOrEqual(4)
})
