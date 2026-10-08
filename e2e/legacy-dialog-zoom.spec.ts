import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

const viewports = [
  { width: 1440, height: 768 },
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
      const control = command === 'Saved views'
        ? dialog.getByRole('button', { name: 'Save current view', exact: true })
        : dialog.locator('.tag-list button').first()
      await expectReachable(control)
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
