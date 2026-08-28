import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const E2E_SEARCH_MARKER = 'e2e-workspace-marker'

export const WORKSPACE_CHROME_PREFS = {
  vaultSidebarCollapsed: false,
  inspectorCollapsed: false,
  showFormatToolbar: true,
  showEditorAssist: true,
  showEditorStatus: true,
  showInspectorHealth: true,
  showWorkspaceFooter: true,
  showLineNumbers: true,
  editorFontSize: 14,
  editorFontFamily: 'jetbrains-mono',
  editorLineHeight: 1.55,
  editorPaddingPx: 12,
  previewMaxWidthCh: 72,
  editorSurfaceMode: 'source',
}

/**
 * Deterministic app boot: the onboarding tour renders a modal over the whole
 * workspace on a fresh profile, which makes every palette/panel interaction
 * flaky, so mark it complete before the app mounts. Callers that need extra
 * bootstrap state should add their own `page.addInitScript` before calling.
 */
export async function launchApp(page: Page, options: { theme?: string } = {}) {
  // Seed only when unset: init scripts run on every navigation, and clobbering
  // the theme on reload would mask persistence bugs.
  await page.addInitScript((theme: string) => {
    // Dialog-contract specs target the MODAL panel presentation; the docked
    // complementary-role ARIA is pinned separately (visual-review.spec).
    if (window.localStorage.getItem('scriptor:panel-presentation') === null) {
      window.localStorage.setItem('scriptor:panel-presentation', 'modal')
    }
    if (window.localStorage.getItem('scriptor:onboarding-complete') === null) {
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    }
    if (window.localStorage.getItem('scriptor:app-theme') === null) {
      window.localStorage.setItem('scriptor:app-theme', theme)
    }
  }, options.theme ?? 'light')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const workspace = page.getByRole('main', { name: 'Scriptor workspace' })
  try {
    await expect(workspace).toBeVisible({ timeout: 15_000 })
  } catch (firstBootError) {
    // A heavily loaded Windows browser worker can occasionally commit the
    // navigation while leaving the preview document blank. One explicit reload
    // is safe because the E2E bridge is deterministic; a reproducible boot
    // failure still fails on the second assertion.
    await page.reload({ waitUntil: 'domcontentloaded' })
    try {
      await expect(workspace).toBeVisible({ timeout: 30_000 })
    } catch {
      throw firstBootError
    }
  }
  return page
}

export async function openCommandPalette(page: Page) {
  // Opening the palette before the workspace finishes booting drops the global
  // keyboard handler. This is especially visible on a cold CI worker where the
  // first Vite dependency optimization can outlast a root-size-only layout wait.
  await expect(page.getByRole('main', { name: 'Scriptor workspace' })).toBeVisible({ timeout: 15_000 })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const navigationTimeOrigin = await page.evaluate(() => performance.timeOrigin)
    await page.keyboard.press('Control+KeyK')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    try {
      await expect(palette).toBeVisible({ timeout: 10_000 })
      return
    } catch (error) {
      // Vite can reload every open page when a parallel test reveals a lazily
      // optimized dependency. Retry only when this document actually changed;
      // a missing palette without navigation remains a real test failure.
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined)
      const currentTimeOrigin = await page
        .evaluate(() => performance.timeOrigin)
        .catch(() => navigationTimeOrigin)
      if (attempt === 0 && currentTimeOrigin !== navigationTimeOrigin) {
        await waitForWorkspace(page)
        continue
      }
      throw error
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Type `commandLabel` into the command palette and activate the first result.
 *
 * The palette filters on the *visible label* (`CommandPalette.tsx` does a plain
 * `label.toLowerCase().includes(needle)`), never on the command id, and it also
 * appends note search hits below the command hits. So the first option is not
 * guaranteed to be the command that was asked for: a fuzzy-match change or a
 * note whose title collides would silently redirect every command-driven test.
 * Assert the option we are about to click actually names the requested command
 * before clicking it.
 */
export async function runCommand(page: Page, commandLabel: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await palette.getByRole('searchbox').fill(commandLabel)
    const option = palette.getByRole('option').first()
    await expect(
      option,
      `command palette had no option for "${commandLabel}"`,
    ).toBeVisible({ timeout: 5000 })
    await expect(
      option,
      `command palette resolved "${commandLabel}" to a different option`,
    ).toHaveText(new RegExp(escapeRegExp(commandLabel), 'i'))

    const navigationTimeOrigin = await page.evaluate(() => performance.timeOrigin)
    try {
      await option.click({ timeout: 10_000 })
    } catch (error) {
      // Vite can perform one full reload when a lazily imported panel reveals a
      // dependency that was not in the initial optimizer graph. Retry only when
      // the document actually changed; ordinary click failures still fail fast.
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined)
      const currentTimeOrigin = await page
        .evaluate(() => performance.timeOrigin)
        .catch(() => navigationTimeOrigin)
      if (attempt === 0 && currentTimeOrigin !== navigationTimeOrigin) {
        await waitForWorkspace(page)
        await openCommandPalette(page)
        continue
      }
      throw error
    }

    await expect(palette).toBeHidden({ timeout: 5000 })

    // A Vite optimizer reload can begin after the click has already resolved.
    // In that case the palette disappears because the document was replaced,
    // but the command's in-memory panel state is lost with it. Detect the same
    // document replacement on the successful-click path and replay once.
    await page
      .evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 0)))
      .catch(() => undefined)
    await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined)
    const currentTimeOrigin = await page
      .evaluate(() => performance.timeOrigin)
      .catch(() => navigationTimeOrigin)
    if (currentTimeOrigin !== navigationTimeOrigin) {
      if (attempt === 0) {
        await waitForWorkspace(page)
        await openCommandPalette(page)
        continue
      }
      throw new Error(`Command "${commandLabel}" triggered two consecutive document reloads`)
    }
    return
  }
}

export async function settleLayout(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.waitForLoadState('domcontentloaded')
    try {
      await page.evaluate(async () => {
        await document.fonts.ready
        window.dispatchEvent(new Event('resize'))
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
      })
      break
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Error) || !error.message.includes('Execution context was destroyed')) {
        throw error
      }
    }
  }
  await page.waitForFunction(() => {
    const root = document.getElementById('root')
    return root && root.getBoundingClientRect().width > 0
  }, { timeout: 5000 })
}

export async function waitForWorkspace(page: Page) {
  await expect(page.getByRole('main', { name: 'Scriptor workspace' })).toBeVisible()
  await expect(page.locator('small.vault-badge', { hasText: 'Research Vault' })).toBeVisible({
    timeout: 45_000,
  })
  const vaultList = page.locator('.virtual-note-list')
  await expect(vaultList.getByRole('button', { name: 'Research Plan.md' })).toBeVisible({
    timeout: 45_000,
  })
  await expect(page.getByRole('tab', { name: 'Research Plan', selected: true })).toBeVisible({
    timeout: 30_000,
  })
  const editorSurface = page.locator('.monaco-editor .view-lines, .cm-content')
  // Monaco may have an empty virtualized view while its model is already
  // authoritative (especially when another panel is opening). Poll the
  // model first, then retain the DOM assertion as a rendering sanity check.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const editor = (window as Window & {
            __scriptorE2eEditor?: { getModel?: () => { getValue?: () => string } | null }
          }).__scriptorE2eEditor
          return editor?.getModel?.()?.getValue?.() ?? ''
        }),
      { timeout: 45_000 },
    )
    .toContain('Research Plan')
  await expect(editorSurface).toBeVisible({ timeout: 15_000 })
  await settleLayout(page)
}

export async function appendEditorLine(page: Page, line: string) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => Boolean((window as Window & { __scriptorE2eEditor?: unknown }).__scriptorE2eEditor)),
      { timeout: 15_000 },
    )
    .toBe(true)

  await page.evaluate((text) => {
    const editor = (window as Window & { __scriptorE2eEditor?: { getModel: () => { getLineCount: () => number; getLineMaxColumn: (line: number) => number } | null; executeEdits: (source: string, edits: unknown[]) => void } })
      .__scriptorE2eEditor
    if (!editor) throw new Error('E2E Monaco editor not mounted')
    const model = editor.getModel()
    if (!model) throw new Error('E2E Monaco model missing')
    const lineCount = model.getLineCount()
    const column = model.getLineMaxColumn(lineCount)
    editor.executeEdits('e2e-append', [
      {
        range: {
          startLineNumber: lineCount,
          startColumn: column,
          endLineNumber: lineCount,
          endColumn: column,
        },
        text: `\n\n${text}`,
        forceMoveMarkers: true,
      },
    ])
  }, line)
}

export async function waitForSavedMarker(page: Page, marker: string) {
  await expect(page.locator('.monaco-editor .view-lines')).toContainText(marker, { timeout: 10_000 })
  await expect(page.getByRole('region', { name: 'Editor' }).getByText(/^Saved /)).toBeVisible({
    timeout: 15_000,
  })
}
