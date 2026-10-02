import { expect, test } from '@playwright/test'
import { closeWorkspacePanel, launchApp, openCommandPalette, runCommand } from './helpers'

const surfaces = [
  ['Database studio', 'Database Studio'], ['Capture reviewer', 'Capture reviewer'],
  ['Publishing studio', 'Publishing studio'], ['Drive collaboration', 'Drive collaboration'],
  ['Diagram studio', 'Diagram studio'], ['Runtime console', 'Runtime console'],
  ['Semantic inspector', 'Semantic Inspector'], ['Asset deck', 'Asset deck'],
] as const

for (const surface of surfaces) test(`${surface[0]} captures fresh light, dark and narrow RTL appearance with bounded controls`, async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e:research', '1')
    sessionStorage.setItem('e2e:asset-media', '1')
  })
    await launchApp(page)
    if (surface[0] === 'Semantic inspector') await page.evaluate(() => {
      const api = (window as Window & { __TAURI_INTERNALS__?: { invoke: (command: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__!
      const original = api.invoke
      api.invoke = (command, args, options) => command === 'semantic_inspect'
        ? Promise.resolve(JSON.stringify({ available: true, provider: 'ollama', model: 'nomic-embed-text', dimension: 768, total_notes: 2, indexed: 2, current: 2, stale: 0, missing: 0, orphaned: 0, invalid: 0, sampled: 2, truncated: false, projection: 'PCA', explained_variance: [0.8, 0.2, 0], points: [{ note_path: 'Research Plan.md', coordinates: [1, 0, 0], stale: false }, { note_path: 'Field Notes.md', coordinates: [-1, 0, 0], stale: false }] }))
        : original(command, args, options)
    })
    await openCommandPalette(page)
    await runCommand(page, surface[0])
    const panel = surface[1] === 'Asset deck'
      ? page.locator('.asset-deck-workspace[role="region"]')
      : page.getByRole('region', { name: surface[1], exact: true })
    await expect(panel).toBeVisible()
    await expect(page.locator('.workspace-leaf-actions > button[aria-label^="Close "]')).toHaveCount(1)
    await expect(panel.getByRole('button', { name: /^Close/i })).toHaveCount(0)
    if (surface[1] === 'Diagram studio') {
      await panel.getByRole('button',{name:'Render diagram',exact:true}).click()
      await expect(panel.locator('.diagram-viewport svg')).toBeVisible()
    }
    if (surface[0] === 'Semantic inspector') await panel.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('ollama')
    if (surface[1] === 'Publishing studio') {
      const folder = panel.getByLabel('Local site folder', { exact: true })
      expect(await folder.evaluate(element => getComputedStyle(element).borderRadius)).not.toBe('0px')
      expect(await folder.evaluate(element => getComputedStyle(element.parentElement!).flexDirection)).toBe('column')
    }
    for (const appearance of ['light', 'dark']) {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.locator('html').evaluate(element => { element.dir = 'ltr' })
      if (await page.locator('html').getAttribute('data-appearance') !== appearance) {
        await page.getByRole('button', { name: new RegExp(`Switch to ${appearance} appearance`) }).click()
      }
      await expect(page.locator('html')).toHaveAttribute('data-appearance', appearance)
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 900 })
        await page.locator('html').evaluate((element, value) => element.setAttribute('dir', value), width === 320 ? 'rtl' : 'ltr')
        const launcherStyle = await page.locator('.workspace-activity-bar button').first().evaluate(element => {
          const style = getComputedStyle(element)
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 1
          const context = canvas.getContext('2d')!
          const luminance = (color: string) => {
            context.clearRect(0, 0, 1, 1)
            context.fillStyle = color
            context.fillRect(0, 0, 1, 1)
            const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(channel => {
              const value = channel / 255
              return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
            })
            return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
          }
          const foreground = luminance(style.color), background = luminance(style.backgroundColor)
          return { contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05), radius: Number.parseFloat(style.borderRadius) }
        })
        expect(launcherStyle.contrast).toBeGreaterThanOrEqual(4.5)
        expect(launcherStyle.radius).toBeGreaterThanOrEqual(6)
        await panel.getByRole('heading').first().scrollIntoViewIfNeeded()
        const metrics = await panel.evaluate(element => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return { left: rect.left, right: rect.right, height: rect.height,
            overflow: element.scrollWidth - element.clientWidth, color: style.color, background: style.backgroundColor }
        })
        expect(metrics.left).toBeGreaterThanOrEqual(0)
        expect(metrics.right).toBeLessThanOrEqual(width + 1)
        expect(metrics.overflow).toBeLessThanOrEqual(1)
        expect(metrics.height).toBeGreaterThan(350)
        expect(metrics.color).not.toBe(metrics.background)
        const control = panel.locator('input:enabled,select:enabled,textarea:enabled,button:enabled').first()
        await page.keyboard.press('Tab')
        await control.focus()
        const focus = await control.evaluate(element => {
          const style = getComputedStyle(element)
          return { outline: style.outlineStyle, width: Number.parseFloat(style.outlineWidth), shadow: style.boxShadow }
        })
        expect((focus.outline !== 'none' && focus.width >= 2) || focus.shadow !== 'none').toBe(true)
        if (surface[1] === 'Capture reviewer') {
          const url = panel.getByLabel('Article URL', { exact: true })
          expect(await url.evaluate(element => getComputedStyle(element).direction)).toBe('ltr')
          const heading = (await panel.getByRole('heading', { name: 'Capture reviewer', exact: true }).boundingBox())!
          const form = (await panel.locator('form').boundingBox())!
          expect(form.y - heading.y - heading.height).toBeLessThanOrEqual(48)
          if (width === 320) {
            const field = await url.boundingBox()
            const action = await panel.getByRole('button', { name: 'Extract preview', exact: true }).boundingBox()
            expect(field!.width).toBeGreaterThan(240)
            expect(action!.y).toBeGreaterThanOrEqual(field!.y + field!.height)
          }
        }
        await panel.evaluate(element => {
          element.scrollTop = 0
          element.querySelectorAll<HTMLElement>('div,section,ul,ol,textarea').forEach(body => { body.scrollTop = 0 })
        })
        await panel.screenshot({ path: testInfo.outputPath(`${surface[1].replaceAll(' ', '-')}-${appearance}-${width}.png`), animations: 'disabled' })
        await page.screenshot({ path: testInfo.outputPath(`workspace-${appearance}-${width}.png`), fullPage: true, animations: 'disabled' })
        const lastControl = panel.locator('button,input,select,textarea,summary').last()
        await lastControl.scrollIntoViewIfNeeded()
        await panel.screenshot({ path: testInfo.outputPath(`${surface[1].replaceAll(' ', '-')}-${appearance}-${width}-bottom.png`), animations: 'disabled' })
      }
    }
    await closeWorkspacePanel(page, panel)
    await expect(panel).toHaveCount(0)
    await page.locator('html').evaluate(element => { element.dir = 'ltr' })
    await page.setViewportSize({ width: 1440, height: 900 })
})
