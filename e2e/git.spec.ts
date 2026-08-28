import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { launchApp, settleLayout, openCommandPalette, runCommand } from './helpers'

const OPEN_GIT = 'Open Git panel'

async function openGitPanel(page: Page) {
  await launchApp(page)
  await settleLayout(page)
  await openCommandPalette(page)
  await runCommand(page, OPEN_GIT)
  const panel = page.getByRole('dialog', { name: 'Git', exact: true })
  await expect(panel).toBeVisible({ timeout: 45_000 })
  return panel
}

test.describe('Git panel', () => {
  test('opens via command palette', async ({ page }) => {
    const panel = await openGitPanel(page)
    await expect(panel.getByRole('heading', { name: 'Git' })).toBeVisible()
  })

  test('shows status content', async ({ page }) => {
    const panel = await openGitPanel(page)
    // The fixture reports branch `main` with a single modified note.
    await expect(panel.locator('.health-subtitle').first()).toContainText('main')
    await expect(panel.locator('.git-changes')).toContainText('1 changed file(s)')
    await expect(panel.locator('.git-file-path')).toHaveText('Research Plan.md')
  })

  test('commit flow stages and commits changes', async ({ page }) => {
    const panel = await openGitPanel(page)

    // There is no "stage all" control in this app: files are selected with the
    // per-file checkboxes and default to the first changed file. Assert the
    // commit form is really there instead of silently skipping when it is not.
    const form = panel.locator('.git-commit-form')
    await expect(form).toBeVisible()
    const message = form.getByRole('textbox')
    await expect(message).toBeVisible()
    await message.fill('test: e2e commit')

    await form.getByRole('button', { name: 'Commit selected' }).click()

    const confirm = panel.getByRole('alertdialog', { name: 'Confirm Git action' })
    await expect(confirm).toBeVisible()
    await expect(confirm).toContainText('test: e2e commit')
    await expect(confirm.locator('.git-confirm-files')).toContainText('Research Plan.md')
    await confirm.getByRole('button', { name: 'Confirm', exact: true }).click()

    // The commit really reached the bridge with the message and file we chose…
    await expect
      .poll(() => page.evaluate(() => window.__scriptorE2eGitCommits ?? []), { timeout: 10_000 })
      .toEqual([{ files: ['Research Plan.md'], message: 'test: e2e commit' }])

    // …and the refreshed status reflects it.
    await expect(panel.locator('.git-changes')).toContainText('Working tree clean')
  })

  test('conflict detection shows conflict indicator', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:git-conflicts', '1')
    })
    const panel = await openGitPanel(page)

    const banner = panel.getByRole('alert')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('1 merge conflict(s)')
    await expect(panel.getByRole('button', { name: 'Resolve' })).toBeVisible()
    // Pull/push must be blocked while the conflict is unresolved.
    await expect(panel.getByRole('button', { name: 'Pull', exact: true })).toBeDisabled()
    await expect(panel.getByRole('button', { name: 'Push', exact: true })).toBeDisabled()
  })

  test('no conflict indicator on a clean merge state', async ({ page }) => {
    const panel = await openGitPanel(page)
    await expect(panel.locator('.git-conflict-banner')).toHaveCount(0)
    await expect(panel.getByRole('button', { name: 'Resolve' })).toHaveCount(0)
  })

  test('conflict resolver round-trips to marker-free markdown', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:git-conflicts', '1')
    })
    const panel = await openGitPanel(page)
    await panel.getByRole('button', { name: 'Resolve' }).click()

    const resolver = page.getByRole('dialog', { name: 'Resolve merge conflict' })
    await expect(resolver).toBeVisible({ timeout: 15_000 })

    const hunk = resolver.locator('.conflict-hunk-card')
    await expect(hunk).toHaveCount(1)

    // Hunk 1: keep "theirs".
    await hunk.getByRole('radio', { name: 'Theirs', exact: true }).check()

    const merged = resolver.locator('.conflict-merged-body')
    await expect(merged).toContainText('Updated field observations after second pass.')
    await expect(merged).not.toContainText('<<<<<<<')
    await expect(merged).not.toContainText('=======')
    await expect(merged).not.toContainText('>>>>>>>')

    await resolver.getByRole('button', { name: 'Apply merged result' }).click()
    await expect(resolver).toBeHidden({ timeout: 10_000 })

    const applied = await page.evaluate(() => window.__scriptorE2eMergedConflict)
    expect(applied).toBeTruthy()
    expect(applied!.path).toBe('Field Notes.md')

    const markdown = applied!.mergedMarkdown
    // No conflict markers survive the round trip…
    expect(markdown).not.toContain('<<<<<<<')
    expect(markdown).not.toContain('=======')
    expect(markdown).not.toContain('>>>>>>>')
    // …the chosen side is kept…
    expect(markdown).toContain('Updated field observations after second pass.')
    expect(markdown).toContain('[[Methodology]]')
    expect(markdown).not.toContain('Observations from the first literature pass.')
    // …and the content that preceded the conflict is retained.
    expect(markdown.startsWith('# Field Notes')).toBe(true)
  })

  test('resolver does not truncate content around an unbalanced conflict marker', async ({ page }) => {
    // Regression guard for the data-loss bug in src/lib/conflictMerge.ts: a
    // dangling `<<<<<<<` after a valid hunk used to make applyConflictChoices
    // drop everything from that marker to EOF.
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:git-conflicts', '2')
    })
    const panel = await openGitPanel(page)
    await panel.getByRole('button', { name: 'Resolve' }).click()

    const resolver = page.getByRole('dialog', { name: 'Resolve merge conflict' })
    await expect(resolver).toBeVisible({ timeout: 15_000 })
    // Only the balanced hunk is offered as a choice.
    await expect(resolver.locator('.conflict-hunk-card')).toHaveCount(1)

    await resolver.getByRole('radio', { name: 'Theirs', exact: true }).check()
    await resolver.getByRole('button', { name: 'Apply merged result' }).click()
    await expect(resolver).toBeHidden({ timeout: 10_000 })

    const applied = await page.evaluate(() => window.__scriptorE2eMergedConflict)
    expect(applied).toBeTruthy()
    const markdown = applied!.mergedMarkdown

    // The resolved hunk really was resolved…
    expect(markdown).toContain('Updated field observations after second pass.')
    expect(markdown).not.toContain('>>>>>>> theirs')
    // …and nothing before, between, or after the unbalanced marker was lost.
    expect(markdown).toContain('Preamble recorded before the merge.')
    expect(markdown).toContain('## Next steps')
    expect(markdown).toContain('- Schedule follow-up interviews.')
    expect(markdown).toContain('Dangling half-conflict with no closing marker.')
  })

  test('docked presentation exposes a complementary landmark, not a dialog', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.localStorage.setItem('scriptor:panel-presentation', 'dock-right')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, OPEN_GIT)
    const docked = page.getByRole('complementary', { name: 'Git', exact: true })
    await expect(docked).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole('dialog', { name: 'Git', exact: true })).toHaveCount(0)
  })
})
