import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

const viewports = [
  { width: 1440, height: 768 },
  { width: 1024, height: 768 },
  { width: 768, height: 900 },
]

async function prepare(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('scriptor:ui-zoom', '2')
    localStorage.setItem('scriptor:editor-mode', 'codemirror')
    sessionStorage.setItem('e2e:frontmatter-populated', '1')
    sessionStorage.setItem('e2e:snippets-populated', '1')
  })
  await launchApp(page)
  await waitForWorkspace(page, { allowHiddenVaultList: true })
  await expect.poll(() => page.evaluate(() => Number(document.body.style.zoom))).toBe(2)
}

async function expectFullBounds(target: Locator) {
  await expect(target).toBeVisible()
  await expect.poll(() => target.evaluate(element => {
    const box = element.getBoundingClientRect()
    return Math.max(0, -box.left, -box.top, box.right - innerWidth, box.bottom - innerHeight)
  })).toBeLessThanOrEqual(1)
  await expect(target).toBeInViewport({ ratio: 1 })
}

async function expectReachable(target: Locator) {
  await target.scrollIntoViewIfNeeded()
  await expectFullBounds(target)
}

async function captureDialog(page: Page, testInfo: TestInfo) {
  await testInfo.attach('legacy-dialog-200-percent', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
}

async function openCommand(page: Page, command: string, name: string) {
  await openCommandPalette(page)
  await runCommand(page, command)
  const dialog = page.getByRole('dialog', { name, exact: true })
  await expect(dialog).toBeVisible()
  await settleLayout(page)
  return dialog
}

// Restore the real app zoom before opening a surface. Before the sizing repair,
// raw viewport units let the 760px snippet and 920px conflict cards exceed the
// 720px effective desktop viewport, and narrower views also expose small cards.
for (const viewport of viewports) {
  const dimensions = `${viewport.width}x${viewport.height}`

  test(`top bar customization stays bounded and restores focus at restored 200 percent zoom at ${dimensions}`, async ({ page }, testInfo) => {
    await prepare(page, viewport)
    const trigger = page.getByRole('button', { name: 'Customize top bar actions', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Customize top bar actions', exact: true })
    await settleLayout(page)
    await expectFullBounds(dialog)
    await expectReachable(dialog.getByRole('checkbox').last())
    await expectReachable(dialog.locator('.customize-reset'))
    await expectFullBounds(dialog)
    await captureDialog(page, testInfo)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    await page.locator('header.topbar').click({ button: 'right' })
    await expectFullBounds(dialog)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test(`product tour and final actions fit at restored 200 percent zoom at ${dimensions}`, async ({ page }, testInfo) => {
    await page.addInitScript(() => localStorage.setItem('scriptor:onboarding-complete', 'false'))
    await prepare(page, viewport)
    const tour = page.getByRole('dialog', { name: 'Product tour', exact: true })
    await expectFullBounds(tour)
    const steps = Number(await tour.getByRole('progressbar').getAttribute('max'))
    expect(steps).toBeGreaterThan(1)
    expect(steps).toBeLessThanOrEqual(16)
    for (let step = 1; step < steps; step += 1) {
      const next = tour.getByRole('button', { name: 'Next', exact: true })
      await expectReachable(next)
      await next.click()
      await expect(tour.getByRole('progressbar')).toHaveAttribute('value', String(step + 1))
      await expectFullBounds(tour)
    }
    for (const action of ['Skip tour', 'Back', 'Help & guides', 'Open cheatsheet', 'Finish']) {
      await expectReachable(tour.getByRole('button', { name: action, exact: true }))
    }
    await expect.poll(() => tour.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    await captureDialog(page, testInfo)
    await tour.getByRole('button', { name: 'Finish', exact: true }).click()
    await expect(tour).toBeHidden()
  })

  test(`toolbar customizer keeps controls and actions contained at restored 200 percent zoom at ${dimensions}`, async ({ page }, testInfo) => {
    await prepare(page, viewport)
    await page.locator('.editor-toolbar .customize-trigger').click()
    const dialog = page.getByRole('dialog', { name: /Customize toolbar/i })
    await expectFullBounds(dialog)
    const close = dialog.locator('.toolbar-customizer-close')
    await expectFullBounds(close)
    await expectFullBounds(dialog.getByRole('button', { name: 'Apply', exact: true }))
    await expectReachable(dialog.locator('.toolbar-customize-row').last().getByRole('spinbutton'))
    await expect.poll(() => dialog.locator('.toolbar-customizer-list').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    await expectFullBounds(close)
    await captureDialog(page, testInfo)
    await dialog.locator('.toolbar-customizer-actions').getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toBeHidden()
  })

  test(`Tools menu stays attached, bounded and keyboard reachable at restored 200 percent zoom at ${dimensions}`, async ({ page }, testInfo) => {
    await prepare(page, viewport)
    const trigger = page.getByRole('button', { name: 'Tools', exact: true })
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
    const menu = page.getByRole('menu', { name: 'Tools', exact: true })
    await expect(menu).toHaveAttribute('data-positioned', 'true')
    await expectFullBounds(menu)
    await expect.poll(async () => {
      const menuBox = await menu.boundingBox()
      const triggerBox = await trigger.boundingBox()
      if (!menuBox || !triggerBox) return Number.POSITIVE_INFINITY
      return Math.min(
        Math.abs(menuBox.y - triggerBox.y - triggerBox.height),
        Math.abs(triggerBox.y - menuBox.y - menuBox.height),
      )
    }).toBeLessThanOrEqual(14)
    const first = menu.getByRole('menuitem').first()
    await expect(first, `Initial menu focus owner: ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 500))}`).toBeFocused()
    await page.keyboard.press('End')
    const last = menu.getByRole('menuitem').last()
    await expect(last).toBeFocused()
    await expectFullBounds(last)
    await expectFullBounds(menu)
    await captureDialog(page, testInfo)
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test(`command palette card and last result fit at restored 200 percent zoom at ${dimensions}`, async ({ page }, testInfo) => {
    await prepare(page, viewport)
    await openCommandPalette(page)
    const palette = page.getByRole('dialog', { name: 'Command palette', exact: true })
    const card = palette.locator('.command-palette')
    await settleLayout(page)
    await expectFullBounds(card)
    await expectFullBounds(palette.getByRole('searchbox'))
    await expectReachable(palette.getByRole('option').last())
    await expectFullBounds(card)
    await captureDialog(page, testInfo)
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()
  })

  test(`theme builder keeps header, footer and fields reachable at restored 200 percent zoom at ${dimensions}`, async ({ page }, testInfo) => {
    await prepare(page, viewport)
    const settings = await openCommand(page, 'Open settings', 'Settings')
    await settings.getByRole('tab', { name: 'Appearance', exact: true }).click()
    await settings.getByRole('button', { name: 'Manage color palettes', exact: true }).click()
    const palettes = page.getByRole('dialog', { name: 'Color palettes', exact: true })
    await settleLayout(page)
    await expectFullBounds(palettes.locator('.plugin-manager-modal'))
    const create = palettes.getByRole('button', { name: 'Create Custom Palette', exact: true })
    await expectReachable(create)
    await create.click()
    const dialog = page.getByRole('dialog', { name: 'Theme Customizer & Builder', exact: true })
    const card = dialog.locator('.customizer-modal')
    await settleLayout(page)
    await expectFullBounds(card)
    const close = dialog.locator('.customizer-header').getByRole('button')
    await expectFullBounds(close)
    await expectFullBounds(dialog.locator('.customizer-footer'))
    const name = dialog.locator('#theme-name-input')
    await expectReachable(name)
    await name.fill('Zoom review palette')
    await expect(name).toHaveValue('Zoom review palette')
    await expectReachable(dialog.locator('.picker-row textarea').last())
    await expectFullBounds(close)
    await expectFullBounds(dialog.locator('.customizer-footer'))
    await captureDialog(page, testInfo)
    await close.click()
    await expect(dialog).toBeHidden()
    await expect(palettes).toBeVisible()
  })

  for (const surface of [
    { command: 'Markdown cheatsheet', name: 'Markdown cheatsheet', close: 'Close cheatsheet' },
    { command: 'Manage snippet catalog', name: 'Snippet catalog', close: 'Close' },
    { command: 'New note from template', name: 'Choose template', close: 'Close' },
    { command: 'Import Obsidian vault', name: 'Import Obsidian vault', close: 'Close import dialog' },
  ]) {
    test(`${surface.name} stays bounded after restoring 200 percent app zoom at ${dimensions}`, async ({ page }, testInfo) => {
      await prepare(page, viewport)
      const dialog = await openCommand(page, surface.command, surface.name)
      await expectFullBounds(dialog)
      const close = dialog.getByRole('button', { name: surface.close, exact: true })
      await expectFullBounds(close)

      if (surface.name === 'Markdown cheatsheet') {
        const body = dialog.locator('.cheatsheet-body')
        await expect.poll(() => body.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0)
        await body.evaluate(element => { element.scrollTop = element.scrollHeight })
        await expectFullBounds(close)
      } else if (surface.name === 'Snippet catalog') {
        const content = dialog.getByRole('textbox', { name: 'Content', exact: true })
        await expectReachable(dialog.getByRole('textbox', { name: 'Name', exact: true }))
        await expectReachable(dialog.getByRole('textbox', { name: 'Description', exact: true }))
        // A multiline editor can exceed its scrollport. Verify real editing and
        // horizontal bounds instead of requiring all text rows at once.
        await content.fill('## Zoom regression\n\n${1:Finding}')
        await expect(content).toHaveValue('## Zoom regression\n\n${1:Finding}')
        await expect.poll(() => content.evaluate(element => {
          const box = element.getBoundingClientRect()
          return Math.max(0, -box.left, box.right - innerWidth)
        })).toBeLessThanOrEqual(1)
        await expectReachable(dialog.getByRole('button', { name: 'Save catalog', exact: true }))
      } else if (surface.name === 'Choose template') {
        await expectReachable(dialog.getByRole('option').last())
      } else {
        await expectReachable(dialog.getByRole('button', { name: 'Import vault', exact: true }))
      }

      await expectReachable(close)
      await captureDialog(page, testInfo)
      await close.click()
      await expect(dialog).toBeHidden()
    })
  }

  for (const surface of ['Writing targets', 'Frontmatter']) {
    test(`${surface} stays bounded after restoring 200 percent app zoom at ${dimensions}`, async ({ page }, testInfo) => {
      await prepare(page, viewport)
      await page.getByRole('button', { name: 'Tools', exact: true }).click()
      await page.getByRole('menuitem', { name: new RegExp(surface, 'i') }).click()
      const dialog = page.getByRole('dialog', { name: surface, exact: true })
      await settleLayout(page)
      await expectFullBounds(dialog)
      const close = dialog.getByRole('button', { name: 'Close', exact: true })
      await expectFullBounds(close)
      if (surface === 'Frontmatter') {
        await expect(dialog.getByLabel('project', { exact: true })).toHaveValue('Scriptor research')
        await expectReachable(dialog.getByLabel('project', { exact: true }))
        await expectReachable(dialog.getByRole('button', { name: 'Save', exact: true }).last())
      } else {
        await expectReachable(dialog.locator('.writing-history li').last())
        await expectReachable(dialog.getByRole('spinbutton', { name: 'Daily word target', exact: true }))
      }
      await expectReachable(close)
      await captureDialog(page, testInfo)
      await close.click()
      await expect(dialog).toBeHidden()
    })
  }

  // These commands now open embedded panels in Knowledge workbench. Cover the
  // supported routes without claiming standalone SavedViews/TagBrowser coverage.
  for (const command of ['Saved views', 'Browse tags']) {
    test(`${command} remains reachable in its workbench at restored 200 percent zoom at ${dimensions}`, async ({ page }, testInfo) => {
      await prepare(page, viewport)
      const dialog = await openCommand(page, command, 'Knowledge workbench')
      await expectFullBounds(dialog)
      const close = dialog.getByRole('button', { name: 'Close Knowledge workbench', exact: true })
      await expectFullBounds(close)
      if (command === 'Saved views') {
        await expect(dialog.getByRole('tab', { name: 'Views', exact: true })).toHaveAttribute('aria-selected', 'true')
      }
      const control = command === 'Saved views'
        ? dialog.getByRole('button', { name: 'Save current…', exact: true })
        : dialog.locator('.tag-list button').first()
      await expectReachable(control)
      if (command === 'Browse tags') {
        await expect(dialog.getByRole('tab', { name: 'Tags', exact: true })).toHaveAttribute('aria-selected', 'true')
        const details = dialog.locator('.tag-notes')
        // Measure in app CSS pixels: a bounded dialog can still squeeze its
        // detail pane into a one-word-per-line column at restored app zoom.
        await expect.poll(() => details.evaluate(element => element.getBoundingClientRect().width / Number(document.body.style.zoom))).toBeGreaterThanOrEqual(220)
        await control.click()
        await expect(details.locator('.tag-notes-header strong')).toContainText('#')
        for (const action of ['Insert tag', 'Rename tag']) {
          await expectReachable(details.getByRole('button', { name: action, exact: true }))
        }
        await expect.poll(() => details.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
        await expectReachable(details.getByRole('button', { name: 'Research Plan Research Plan.md', exact: true }))
      }
      await expectReachable(close)
      await captureDialog(page, testInfo)
      await close.click()
      await expect(dialog).toBeHidden()
    })
  }

  test(`rename preview remains bounded and cancellable at restored 200 percent zoom at ${dimensions}`, async ({ page }, testInfo) => {
    await prepare(page, viewport)
    await page.getByRole('navigation', { name: 'Mobile workspace navigation', exact: true })
      .getByRole('button', { name: 'Vault', exact: true }).click()
    await page.locator('.virtual-note-list').getByRole('button', { name: 'Research Plan.md', exact: true }).click({ button: 'right' })
    const dialog = page.getByRole('dialog', { name: 'Rename note', exact: true })
    await expectFullBounds(dialog)
    await dialog.getByRole('textbox', { name: 'New filename', exact: true }).fill('Research Plan Renamed')
    await expectReachable(dialog.getByRole('button', { name: 'Dry run', exact: true }))
    await dialog.getByRole('button', { name: 'Dry run', exact: true }).click()
    await expect(dialog.locator('.rename-preview strong')).toHaveText('2 link edits across 2 files')
    await expectFullBounds(dialog)
    await expectReachable(dialog.locator('.rename-preview li').last())
    await expectReachable(dialog.getByRole('button', { name: 'Apply rename', exact: true }))
    const close = dialog.getByRole('button', { name: 'Close', exact: true })
    await expectReachable(close)
    await captureDialog(page, testInfo)
    await close.click()
    await expect(dialog).toBeHidden()
    expect(await page.evaluate(() => window.__scriptorE2eRenameApply)).toBeUndefined()
  })

  test(`conflict review remains bounded with a reachable apply action at restored 200 percent zoom at ${dimensions}`, async ({ page }, testInfo) => {
    await page.addInitScript(() => sessionStorage.setItem('e2e:git-conflicts', '1'))
    await prepare(page, viewport)
    const git = await openCommand(page, 'Open Git panel', 'Git')
    const rows = git.locator('.git-changes li')
    await expect(rows).toHaveCount(2)
    for (const row of await rows.all()) {
      await expectReachable(row)
      for (const action of await row.getByRole('button').all()) await expectFullBounds(action)
      expect(await row.evaluate(element => {
        const selection = element.querySelector('.git-file-selection')!.getBoundingClientRect()
        const actions = element.querySelector('.git-file-row-actions')!.getBoundingClientRect()
        return selection.right <= actions.left + 1 || selection.bottom <= actions.top + 1
      })).toBe(true)
    }
    await testInfo.attach('git-rows-200-percent', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
    await git.getByRole('button', { name: 'Resolve', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Resolve merge conflicts', exact: true })
    await expectFullBounds(dialog)
    const choice = dialog.getByRole('radio', { name: 'Keep theirs', exact: true })
    await expectReachable(choice)
    await choice.check()
    await expect(dialog.locator('.conflict-merged-body')).toContainText('Updated field observations after second pass.')
    const apply = dialog.getByRole('button', { name: 'Apply resolved file', exact: true })
    await expect(apply).toBeEnabled()
    await expectReachable(apply)
    const close = dialog.getByRole('button', { name: 'Close', exact: true })
    await expectReachable(close)
    await captureDialog(page, testInfo)
    await close.click()
    await expect(dialog).toBeHidden()
    expect(await page.evaluate(() => window.__scriptorE2eMergedConflict)).toBeUndefined()
  })
}
