import { expect, test, type Locator, type Page } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => document.documentElement.clientWidth)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(width)
}

function cssColorLuminance(color: string): number | null {
  const rgb = color.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]+\s*(\d+(?:\.\d+)?)\s*[, ]+\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\s*\)$/,
  )
  if (rgb) {
    const [, red = '255', green = '255', blue = '255', alpha = '1'] = rgb
    if (Number(alpha) <= 0) return null
    const linearize = (channel: number) => {
      const normalized = channel / 255
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * linearize(Number(red))
      + 0.7152 * linearize(Number(green))
      + 0.0722 * linearize(Number(blue))
  }

  const oklch = color.match(
    /^oklch\(\s*(\d+(?:\.\d+)?)(%)?\s+(\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(?:deg)?(?:\s*\/\s*(\d+(?:\.\d+)?)(%)?)?\s*\)$/,
  )
  if (!oklch) return null

  const [, lightnessRaw = '0', lightnessPercent, chromaRaw = '0', hueRaw = '0', alphaRaw = '1', alphaPercent] = oklch
  const alpha = Number(alphaRaw) / (alphaPercent ? 100 : 1)
  if (alpha <= 0) return null

  const lightness = Number(lightnessRaw) / (lightnessPercent ? 100 : 1)
  const chroma = Number(chromaRaw)
  const hue = Number(hueRaw) * Math.PI / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)

  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b
  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3

  const red = Math.max(0, Math.min(1, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s))
  const green = Math.max(0, Math.min(1, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s))
  const blue = Math.max(0, Math.min(1, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

async function expectDarkSurface(locator: Locator) {
  await expect(locator).toBeVisible()
  const background = await locator.evaluate((element) => {
    const direct = getComputedStyle(element).backgroundColor
    const directMatch = direct.match(/^rgba?\([^)]*\)$/)
    if (directMatch && !/rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(direct)) return direct
    const layered = getComputedStyle(element, '::after').backgroundColor
    return layered && layered !== 'rgba(0, 0, 0, 0)' ? layered : direct
  })
  const luminance = cssColorLuminance(background)
  expect(luminance, `expected a supported opaque CSS background, got ${background}`).not.toBeNull()
  expect(luminance ?? 1).toBeLessThan(0.35)
}

async function closeSurface(surface: Locator) {
  const close = surface.getByRole('button', { name: /close/i }).first()
  await expect(close).toBeVisible()
  await close.click()
  await expect(surface).toBeHidden()
}

test.describe('visual coverage matrix', () => {
  test('Persian RTL workspace preserves viewport geometry', async ({ page }) => {
    await page.setViewportSize({ width: 1240, height: 900 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:locale', 'fa')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
    await expect(page.getByRole('main', { name: 'Scriptor workspace' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('German expansion keeps the primary editor toolbar on one row at compact desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:locale', 'de')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    const toolbar = page.locator('.editor-toolbar')
    await expect(toolbar).toBeVisible()
    const rowTops = await toolbar.locator(':scope > .format-group').evaluateAll((groups) =>
      groups.map((group) => Math.round(group.getBoundingClientRect().top)),
    )
    expect(new Set(rowTops).size).toBe(1)
    await expectNoHorizontalOverflow(page)
  })

  test('125% app zoom reflows without horizontal document overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:ui-zoom', '1.25')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    await expect(page.locator('html')).toHaveAttribute('data-ui-reflow', 'stacked')
    await expectNoHorizontalOverflow(page)
    const editor = await page.locator('.editor-panel').boundingBox()
    expect(editor).not.toBeNull()
    expect(editor?.width ?? 0).toBeGreaterThan(240)
  })

  test('dark theme covers the reviewed settings, automation, knowledge, history, canvas, plugin, and publish surfaces', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await expectDarkSurface(settings)
    await closeSurface(settings)

    await openCommandPalette(page)
    await runCommand(page, 'Open MCP panel')
    const mcp = page.getByRole('dialog', { name: 'MCP automation' })
    await expectDarkSurface(mcp)
    await closeSurface(mcp)

    await openCommandPalette(page)
    await runCommand(page, 'Open graph')
    const graph = page.getByRole('dialog', { name: 'Knowledge graph' })
    await expectDarkSurface(graph)
    await closeSurface(graph)

    await openCommandPalette(page)
    await runCommand(page, 'Open knowledge workbench')
    const workbench = page.getByRole('dialog', { name: 'Knowledge workbench' })
    await expectDarkSurface(workbench)
    await closeSurface(workbench)

    await openCommandPalette(page)
    await runCommand(page, 'Note history timeline')
    const history = page.getByRole('dialog', { name: 'Note history' })
    await expectDarkSurface(history)
    await closeSurface(history)

    await openCommandPalette(page)
    await runCommand(page, 'Open canvas')
    const canvas = page.getByRole('dialog', { name: 'Canvas board' })
    await expectDarkSurface(canvas)
    await closeSurface(canvas)

    await page.getByRole('tab', { name: 'Plugins', exact: true }).click()
    await expect(page.locator('.store-root')).toBeVisible()
    await expectDarkSurface(page.locator('.inspector-panel'))

    await page.locator('.workspace-mode-strip').getByRole('button', { name: 'Publish', exact: true }).click()
    const publish = page.getByRole('dialog', { name: 'Export & publish' })
    await expectDarkSurface(publish)
    await expectNoHorizontalOverflow(page)
  })

  test('dark theme explicitly covers Vault Health', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await openCommandPalette(page)
    await runCommand(page, 'Open vault health')
    const health = page.getByRole('dialog', { name: 'Vault health' })
    await expectDarkSurface(health)
    await expect(health.getByRole('heading', { name: 'Vault health' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await closeSurface(health)
  })

  test('first-run onboarding is explicitly themed in dark mode', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
      window.localStorage.setItem('scriptor:onboarding-complete', 'false')
    })
    await launchApp(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    const tour = page.getByRole('dialog', { name: 'Product tour' })
    await expectDarkSurface(tour)
    await expect(tour.getByRole('heading', { name: 'Your vault' })).toBeVisible()
    await expect(tour.getByRole('button', { name: 'Next' })).toBeFocused()
    await expectNoHorizontalOverflow(page)
  })

  test('dark conflict resolver stays themed and requires an explicit resolution', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.sessionStorage.setItem('e2e:git-conflicts', '1')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    await openCommandPalette(page)
    await runCommand(page, 'Open Git panel')
    const git = page.getByRole('dialog', { name: 'Git', exact: true })
    await expectDarkSurface(git)
    await git.getByRole('button', { name: 'Resolve' }).click()

    const resolver = page.getByRole('dialog', { name: 'Resolve merge conflicts' })
    await expectDarkSurface(resolver)
    await expect(resolver.getByRole('button', { name: 'Apply resolved file' })).toBeDisabled()
    await resolver.getByRole('radio', { name: 'Keep theirs', exact: true }).check()
    await expect(resolver.getByRole('button', { name: 'Apply resolved file' })).toBeEnabled()
  })

  test('long localized workspace chrome never produces page-level horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:locale', 'de')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.localStorage.setItem('scriptor:status-dock-collapsed', 'false')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    await expectNoHorizontalOverflow(page)
    const editor = await page.locator('.editor-panel').boundingBox()
    expect(editor).not.toBeNull()
    expect(editor?.width ?? 0).toBeGreaterThan(260)
  })

  test('125% device scale preserves workspace geometry', async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.25,
    })
    const scaledPage = await context.newPage()
    try {
      await scaledPage.addInitScript(() => {
        window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      })
      await launchApp(scaledPage)
      await waitForWorkspace(scaledPage)
      await settleLayout(scaledPage)
      await expectNoHorizontalOverflow(scaledPage)
      const editor = await scaledPage.locator('.editor-panel').boundingBox()
      expect(editor).not.toBeNull()
      expect(editor?.width ?? 0).toBeGreaterThan(300)
    } finally {
      await context.close()
    }
  })

  test('slow vault loading state stays bounded before the workspace becomes ready', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.sessionStorage.setItem('e2e:slow-vault', '1')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.vault-skeleton-row').first()).toBeVisible({ timeout: 5_000 })
    await expectNoHorizontalOverflow(page)
    await waitForWorkspace(page)
    await expect(page.locator('.vault-skeleton-row')).toHaveCount(0)
  })

  test('large fixture vault stays virtualized and long note names cannot widen the page', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.sessionStorage.setItem('e2e:large-vault', '1')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    const list = page.locator('.virtual-note-list')
    await expect(list).toBeVisible()
    expect(await list.locator(':scope > li').count()).toBeLessThan(80)
    const dimensions = await list.evaluate((element) => ({
      contentHeight: element.scrollHeight,
      viewportHeight: element.parentElement?.clientHeight ?? 0,
    }))
    expect(dimensions.contentHeight).toBeGreaterThan(dimensions.viewportHeight * 10)
    await expectNoHorizontalOverflow(page)

    await list.evaluate((element) => {
      const scroller = element.parentElement
      if (!scroller) throw new Error('virtual note list scroll container missing')
      scroller.scrollTop = scroller.scrollHeight
      scroller.dispatchEvent(new Event('scroll'))
    })
    await expect(
      list.getByRole('button', {
        name: 'Generated research note 0600 with an intentionally long filename for truncation and virtualization coverage.md',
      }),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })


  test('populated knowledge repair rows remain readable and triage stays in the workbench', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.sessionStorage.setItem('e2e:knowledge-repair-notes', '1')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    await openCommandPalette(page)
    await runCommand(page, 'Open knowledge workbench')
    const workbench = page.getByRole('dialog', { name: 'Knowledge workbench' })
    await expect(workbench).toBeVisible()

    const orphanTab = workbench.getByRole('tab', { name: /Orphans \(3\)/ })
    await orphanTab.click()
    const rows = workbench.locator('.virtual-knowledge-list > li')
    await expect(rows).toHaveCount(3)
    // Opening the modal uses a finite scale-in transform. Measure the stable
    // row geometry after that transition, otherwise getBoundingClientRect()
    // reports the transiently scaled height rather than the 72px layout row.
    await settleLayout(page)
    const geometry = await rows.evaluateAll((items) => items.map((item) => ({
      height: item.getBoundingClientRect().height,
      width: item.getBoundingClientRect().width,
      scrollWidth: item.scrollWidth,
    })))
    for (const row of geometry) {
      expect(row.height).toBeGreaterThanOrEqual(68)
      expect(row.scrollWidth).toBeLessThanOrEqual(Math.ceil(row.width) + 1)
    }
    await expect(
      workbench.getByText('Field Notes with an intentionally long title for zoom coverage', { exact: true }),
    ).toBeVisible()

    await workbench.getByRole('button', { name: /Start triage/ }).click()
    await expect(workbench).toBeVisible()
    await expect(workbench.getByText(/Triage 1 of 3/)).toBeVisible()
    await workbench.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(workbench).toBeVisible()
    await expect(workbench.getByText(/Triage 2 of 3/)).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

})