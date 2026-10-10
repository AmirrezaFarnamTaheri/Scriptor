import { expect, test, type Page } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

async function installExportFixture(page: Page) {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & {
      __TAURI_INTERNALS__: { invoke(command: string, args?: Record<string, unknown>, options?: unknown): Promise<unknown> }
      finishExportFixture?: () => void
      finishPlanFixture?: () => void
    }
    const original = host.__TAURI_INTERNALS__.invoke.bind(host.__TAURI_INTERNALS__)
    let selectedVault = 'screenshot-vault'
    const assets = new Map([['assets/export-Research Plan-0.png', 'user-owned diagram']])
    host.__TAURI_INTERNALS__.invoke = async (command, args = {}, options) => {
      const calls = JSON.parse(sessionStorage.getItem('e2e:export-integrity-calls') ?? '[]') as Array<{ command: string; args: Record<string, unknown> }>
      calls.push({ command, args })
      sessionStorage.setItem('e2e:export-integrity-calls', JSON.stringify(calls))
      if (command === 'plugin:dialog|open') return '/e2e/next-vault'
      if (command === 'vault_open') {
        selectedVault = 'next-vault'
        const value = await original(command, args, options) as { vault: Record<string, unknown> }
        return { ...value, vault: { ...value.vault, id: selectedVault, name: 'Next vault' } }
      }
      if (command === 'vault_read_note') {
        const value = await original(command, args, options) as { metadata: Record<string, unknown> }
        return { ...value, metadata: { ...value.metadata, vault_id: selectedVault } }
      }
      if (command === 'export_pdf_inprocess') {
        await new Promise<void>(resolve => { host.finishExportFixture = resolve })
        return { artifact_path: 'C:/vault/completed-offline.pdf', page_count: 2, warnings: [], duration_ms: 1 }
      }
      if (command === 'vault_publish_plan_starlight') {
        if (sessionStorage.getItem('e2e:delay-publication-plan') === '1') await new Promise<void>(resolve => { host.finishPlanFixture = resolve })
        return { output: 'C:/reviewed-site', docs_dir: 'C:/reviewed-site/src/content/docs', plan: { new_items: [{ rel_path: 'Research Plan.md', content_hash: 'a'.repeat(64) }], changed: [], unchanged: [], orphaned: [] } }
      }
      if (command === 'plantuml_render') return { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"></svg>' }
      if (command === 'vault_save_asset') {
        if (sessionStorage.getItem('e2e:reject-export-asset') === '1') throw new Error('The diagram asset could not be saved; check the vault folder permissions.')
        const path = String(args.relativePath)
        if (args.requireMissing && assets.has(path)) throw new Error('Asset destination already exists')
        assets.set(path, 'generated diagram')
        sessionStorage.setItem('e2e:export-user-asset', assets.get('assets/export-Research Plan-0.png')!)
        return path
      }
      if (command === 'export_run_markdown') return {
        job_id: crypto.randomUUID(), format: args.format, artifact_path: 'C:/vault/completed-export.html',
        command: ['pandoc'], stdout: '', stderr: '', duration_ms: 1, dry_run: args.dryRun,
      }
      return original(command, args, options)
    }
  })
}

async function command(page: Page, label: string) { await openCommandPalette(page); await runCommand(page, label) }
async function publishCenter(page: Page) {
  await command(page, 'Open publish center')
  return page.getByRole('dialog', { name: 'Export & publish', exact: true })
}
async function calls(page: Page, commandName: string) {
  return page.evaluate(name => (JSON.parse(sessionStorage.getItem('e2e:export-integrity-calls') ?? '[]') as Array<{ command: string; args: Record<string, unknown> }>).filter(row => row.command === name), commandName)
}

test('a pending offline export blocks a competing palette profile and vault replacement, then reports its actual completion', async ({ page }) => {
  await installExportFixture(page)
  let panel = await publishCenter(page)
  const offline = panel.locator('.publish-profile-list > li').filter({ has: page.locator('strong').filter({ hasText: /^PDF · Offline$/ }) })
  await offline.getByRole('button', { name: 'Export PDF', exact: true }).click()
  await expect.poll(async () => (await calls(page, 'export_pdf_inprocess')).length).toBe(1)
  await panel.getByRole('button', { name: /^Close / }).click()
  await command(page, 'Export active note as Reveal.js slides')
  // Palette commands have their own route and are not disabled by panel buttons.
  // The shared operation owner must reject that second profile at the hook.
  expect(await calls(page, 'export_run_markdown')).toHaveLength(0)
  await expect.poll(async () => (await calls(page, 'vault_append_activity_log')).some(row =>
    row.args.message === 'An export is already running. Wait for it to finish before starting another export.',
  )).toBe(true)
  await page.getByRole('button', { name: 'Open Vault', exact: true }).click()
  await expect(page.getByText('An export is still running. Wait for it to finish, or cancel it in Export & publish before changing vaults.', { exact: true })).toBeVisible()
  expect(await calls(page, 'vault_open')).toHaveLength(0)
  await page.evaluate(() => (window as Window & { finishExportFixture: () => void }).finishExportFixture())
  panel = await publishCenter(page)
  await expect(panel.locator('.publish-status-success')).toHaveCount(1)
  const latest = panel.locator('.publish-center-section').filter({ has: page.getByRole('heading', { name: 'Latest file export', exact: true }) })
  await expect(latest.locator('.publish-artifact')).toHaveText('C:/vault/completed-offline.pdf')
  await expect(latest.locator('.publish-artifact')).toBeVisible()
  await expect(panel.locator('.publish-center-history .publish-artifact')).toHaveText('C:/vault/completed-offline.pdf')
  await expect(panel.locator('.publish-center-history .publish-artifact')).toBeVisible()
  expect((await calls(page, 'export_pdf_inprocess'))[0].args.expectedVaultId).toBe('screenshot-vault')
})

test('a delayed publication plan cannot reopen or populate the publish center after an actual vault change', async ({ page }) => {
  await installExportFixture(page)
  await page.evaluate(() => sessionStorage.setItem('e2e:delay-publication-plan', '1'))
  await command(page, 'Publish Starlight site')
  const prompt = page.getByRole('dialog', { name: 'Plan Starlight publish', exact: true })
  await prompt.getByRole('button', { name: 'Review plan', exact: true }).click()
  await expect.poll(async () => (await calls(page, 'vault_publish_plan_starlight')).length).toBe(1)
  await command(page, 'Publish Starlight site')
  await expect(page.getByText('A publication operation is already running. Wait for it to finish before reviewing another plan.', { exact: true })).toBeVisible()
  expect(await calls(page, 'vault_publish_plan_starlight')).toHaveLength(1)
  await expect(prompt).toHaveCount(0)
  await page.getByRole('button', { name: 'Open Vault', exact: true }).click()
  await expect.poll(async () => (await calls(page, 'vault_open')).length).toBe(1)
  await expect(page.getByRole('tab', { name: 'Research Plan', selected: true })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Vault', exact: true }).getByText('Next vault', { exact: true })).toBeVisible()
  await page.evaluate(() => (window as Window & { finishPlanFixture: () => void }).finishPlanFixture())
  const panel = await publishCenter(page)
  await expect(panel.getByRole('button', { name: 'Plan site publish', exact: true })).toBeVisible()
  expect(await calls(page, 'vault_publish_apply_starlight')).toHaveLength(0)
  expect((await calls(page, 'vault_publish_plan_starlight'))[0].args.expectedVaultId).toBe('screenshot-vault')
})

test('previewing a diagram export writes no assets, and repeated exports preserve existing diagram files', async ({ page }, testInfo) => {
  await installExportFixture(page)
  const diagrams = [
    { name: 'flowchart', source: '%%{init: {"htmlLabels": true, "flowchart": {"htmlLabels": true}}}%%\nflowchart TD\n A[Draft] -->|Review| B[Published]' },
    { name: 'class', source: 'classDiagram\n class Draft\n class Published\n Draft --> Published : review' },
    { name: 'state', source: 'stateDiagram-v2\n [*] --> Draft\n Draft --> Published : Review\n Published --> [*]' },
    { name: 'sequence', source: 'sequenceDiagram\n Author->>Reviewer: Draft\n Reviewer-->>Author: Publish' },
  ]
  const markdown = '# Research Plan\n\n' + diagrams.map(diagram => `\`\`\`mermaid\n${diagram.source}\n\`\`\``).join('\n\n') + '\n'
  await page.evaluate(value => {
    const editor = (window as Window & { __scriptorE2eEditor: { getModel(): { setValue(value: string): void } } }).__scriptorE2eEditor
    editor.getModel().setValue(value)
  }, markdown)
  const panel = await publishCenter(page)
  const html = panel.locator('.publish-profile-list > li').filter({ has: page.locator('strong').filter({ hasText: /^HTML$/ }) })
  await html.getByRole('button', { name: 'Preview export', exact: true }).click()
  await expect(panel.locator('.publish-status-dry-run')).toHaveCount(1)
  expect(await calls(page, 'vault_save_asset')).toHaveLength(0)
  expect(await calls(page, 'plantuml_render')).toHaveLength(0)
  const preview = (await calls(page, 'export_run_markdown'))[0].args
  expect(preview.expectedVaultId).toBe('screenshot-vault')
  expect(preview.sourceMarkdown).toContain('```mermaid')
  for (const count of [1, 2]) {
    await html.getByRole('button', { name: 'Export HTML', exact: true }).click()
    await expect.poll(async () => ({
      successes: await panel.locator('.publish-status-success').count(),
      failures: await panel.locator('.publish-error').allTextContents(),
    })).toEqual({ successes: count, failures: [] })
  }
  const assets = await calls(page, 'vault_save_asset')
  expect(assets).toHaveLength(diagrams.length * 2)
  expect(new Set(assets.map(row => row.args.relativePath)).size).toBe(diagrams.length * 2)
  expect(assets.every(row => row.args.requireMissing === true && row.args.expectedVaultId === 'screenshot-vault')).toBe(true)
  expect(assets.every(row => /^assets\/export-[a-f\d-]+-\d+\.png$/.test(String(row.args.relativePath)))).toBe(true)
  for (let index = 0; index < assets.length; index += 1) {
    const bytes = assets[index].args.bytes as number[]
    expect(bytes.slice(0, 8)).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    const decoded = await page.evaluate(async values => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(values)], { type: 'image/png' }))
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext('2d')!
        context.drawImage(bitmap, 0, 0)
        const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data
        const colors = new Set<string>()
        for (let offset = 0; offset < pixels.length && colors.size < 2; offset += 4) {
          if (pixels[offset + 3] > 0) colors.add(Array.from(pixels.slice(offset, offset + 4)).join(','))
        }
        return { width: bitmap.width, height: bitmap.height, distinctVisibleColors: colors.size }
      } finally { bitmap.close() }
    }, bytes)
    expect(decoded.width).toBeGreaterThan(1)
    expect(decoded.height).toBeGreaterThan(1)
    expect(decoded.distinctVisibleColors).toBe(2)
    if (index < diagrams.length) await testInfo.attach(`mermaid-${diagrams[index].name}-export.png`, { body: Buffer.from(bytes), contentType: 'image/png' })
  }
  const exports = (await calls(page, 'export_run_markdown')).slice(1)
  expect(exports).toHaveLength(2)
  exports.forEach((row, index) => {
    expect(row.args.sourceMarkdown).not.toContain('```mermaid')
    for (const asset of assets.slice(index * diagrams.length, (index + 1) * diagrams.length)) {
      expect(row.args.sourceMarkdown).toContain(`![Mermaid diagram](${asset.args.relativePath})`)
    }
  })
  expect(await page.evaluate(() => (window as Window & { __scriptorE2eEditor: { getModel(): { getValue(): string } } }).__scriptorE2eEditor.getModel().getValue())).toBe(markdown)
  expect(await page.evaluate(() => sessionStorage.getItem('e2e:export-user-asset'))).toBe('user-owned diagram')
  await panel.getByRole('button', { name: /^Close / }).click()
  await page.locator('.editor-toolbar').getByRole('button', { name: 'Preview', exact: true }).click()
  const previewSurface = page.locator('.markdown-preview, .preview-surface, .editable-preview-editor').first()
  const previewDiagrams = previewSurface.locator('.mermaid[data-processed="true"]')
  await expect(previewDiagrams).toHaveCount(diagrams.length)
  await expect(previewDiagrams.first().locator('svg')).toContainText('Draft')
  // Interactive preview retains its usual HTML labels after export finishes.
  await expect(previewDiagrams.first().locator('foreignObject')).not.toHaveCount(0)
})

test('a rejected diagram asset fails export visibly without dispatching native export or rewriting the draft', async ({ page }) => {
  await installExportFixture(page)
  const markdown = '# Research Plan\n\n```plantuml\n@startuml\nAlice -> Bob: Hello\n@enduml\n```\n\nKeep the authored draft.\n'
  await page.evaluate(value => {
    sessionStorage.setItem('e2e:reject-export-asset', '1')
    const editor = (window as Window & { __scriptorE2eEditor: { getModel(): { setValue(value: string): void } } }).__scriptorE2eEditor
    editor.getModel().setValue(value)
  }, markdown)
  const panel = await publishCenter(page)
  const html = panel.locator('.publish-profile-list > li').filter({ has: page.locator('strong').filter({ hasText: /^HTML$/ }) })
  await html.getByRole('button', { name: 'Export HTML', exact: true }).click()
  await expect(panel.locator('.publish-status-error')).toHaveCount(1)
  await expect(panel.getByText(/Could not prepare PlantUML diagram 1: The diagram asset could not be saved/)).toBeVisible()
  expect(await calls(page, 'plantuml_render')).toHaveLength(1)
  expect(await calls(page, 'vault_save_asset')).toHaveLength(1)
  expect(await calls(page, 'export_run_markdown')).toHaveLength(0)
  expect(await calls(page, 'export_run_note')).toHaveLength(0)
  expect(await page.evaluate(() => {
    const editor = (window as Window & { __scriptorE2eEditor: { getModel(): { getValue(): string } } }).__scriptorE2eEditor
    return editor.getModel().getValue()
  })).toBe(markdown)
})
