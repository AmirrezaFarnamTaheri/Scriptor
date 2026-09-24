import { expect, test } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, settleLayout } from './helpers'

test.describe('top bar customization and support', () => {
  test('customization closes with Escape, restores focus, and remains inside the viewport after zoom', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 640 })
    await launchApp(page)
    await settleLayout(page)

    const trigger = page.getByRole('button', { name: 'Customize top bar actions' })
    await trigger.evaluate((element) => element.scrollIntoView({ inline: 'end', block: 'nearest' }))
    await trigger.click()

    const popup = page.getByRole('dialog', { name: 'Customize top bar actions' })
    await expect(popup).toBeVisible()

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
      window.dispatchEvent(new Event('resize'))
    })
    await settleLayout(page)

    const box = await popup.boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(box?.x).toBeGreaterThanOrEqual(7)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) - 7)
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((viewport?.height ?? 0) - 7)

    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('support uses a distinct semantic red heart in the top bar and panel', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await launchApp(page)
    await settleLayout(page)

    const supportButton = page.getByRole('button', { name: 'Support Scriptor' }).first()
    await expect(supportButton).toHaveClass(/support-heart-action/)
    await expect(supportButton.locator('svg')).toHaveAttribute('fill', 'currentColor')
    await supportButton.click()

    const panel = page.getByRole('dialog', { name: 'Support Scriptor' })
    await expect(panel).toBeVisible()
    await expect(panel.locator('.support-heart-icon svg')).toHaveAttribute('fill', 'currentColor')
    await expect(panel).toContainText('Choose a network, then copy the wallet address.')
    await expect(panel).toContainText('Licensed under AGPL-3.0-or-later.')
    await expect(panel).not.toContainText('for non-commercial use')

    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 1024, height: 768 })
    await openCommandPalette(page)
    await runCommand(page, 'Support Scriptor')
    await expect(panel).toBeVisible()
  })

  test('top-bar panel buttons close their docked panels on a second click', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 })
    await page.addInitScript(() => window.localStorage.setItem('scriptor:panel-presentation', 'dock-right'))
    await launchApp(page)
    await settleLayout(page)

    for (const [buttonSelector, panelName] of [
      ['.topbar-secondary-status', 'Git'],
      ['.topbar-secondary-action', 'Quick capture'],
    ]) {
      const button = page.locator(buttonSelector).first()
      await button.click()
      const panel = page.getByRole('complementary', { name: panelName })
      await expect(panel).toBeVisible()
      await button.click()
      await expect(panel).toBeHidden()
    }
  })

  test('empty-state card contains its actions and tagline at desktop and tablet widths', async ({ page }) => {
    await launchApp(page)
    await page.locator('.tabs-row').getByRole('button', { name: 'Close Research Plan' }).click()

    for (const width of [1440, 768]) {
      await page.setViewportSize({ width, height: 700 })
      const card = page.locator('.editor-empty-card')
      await expect(card).toBeVisible()
      const contained = await card.evaluate((element) => {
        const outer = element.getBoundingClientRect()
        return [...element.querySelectorAll('button, small')].every((child) => {
          const box = child.getBoundingClientRect()
          return box.left >= outer.left && box.right <= outer.right && box.top >= outer.top && box.bottom <= outer.bottom
        })
      })
      expect(contained).toBe(true)
      if (width === 1440) {
        await page.screenshot({ path: test.info().outputPath('empty-note-refined.png'), animations: 'disabled' })
      }
    }
  })

  test('palette and built-in module managers remain separate product surfaces', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await launchApp(page)
    await settleLayout(page)

    await openCommandPalette(page)
    await runCommand(page, 'Open built-in modules')
    const modules = page.getByRole('dialog', { name: 'Built-in modules' })
    await expect(modules).toBeVisible()
    await expect(modules.getByText('Installer Profile Preset:')).toBeVisible()
    await expect(modules.getByRole('button', { name: 'Open runtime plugin marketplace' })).toBeVisible()
    await expect(modules.getByText('Category Filter:')).toHaveCount(0)
    await modules.getByRole('button', { name: 'Close' }).click()

    const customize = page.getByRole('button', { name: 'Customize top bar actions' })
    await customize.click()
    const popup = page.getByRole('dialog', { name: 'Customize top bar actions' })
    const paletteToggle = popup.getByRole('checkbox', { name: 'Color palettes' })
    await expect(paletteToggle).not.toBeChecked()
    await paletteToggle.check()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Color palettes' }).click()
    const palettes = page.getByRole('dialog', { name: 'Color palettes' })
    await expect(palettes).toBeVisible()
    await expect(palettes.getByText('Category Filter:')).toBeVisible()
    await expect(palettes.getByRole('button', { name: 'Create Custom Palette' })).toBeVisible()
    await expect(palettes.getByRole('button', { name: 'Open runtime plugin marketplace' })).toHaveCount(0)
    await expect(palettes.getByText('Installer Profile Preset:')).toHaveCount(0)
  })

})
