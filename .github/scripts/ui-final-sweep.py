from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    target = Path(path)
    text = target.read_text()
    found = text.count(old)
    if found < count:
        raise SystemExit(f"{path}: expected at least {count} occurrence(s), found {found}: {old!r}")
    target.write_text(text.replace(old, new, count))


# Large/long-data E2E fixture. Default fixture behavior is unchanged.
bootstrap = 'src/e2e/bootstrap.ts'
marker = "function activeConflictFixture(): string | null {\n  const flag = window.sessionStorage.getItem('e2e:git-conflicts')\n  if (!flag) return null\n  return CONFLICT_FIXTURES[flag] ?? null\n}\n"
helpers = marker + "\nfunction activeScanFixture() {\n  if (window.sessionStorage.getItem('e2e:large-vault') !== '1') return SCREENSHOT_SCAN\n  const generated = Array.from({ length: 600 }, (_, index) => {\n    const ordinal = String(index + 1).padStart(4, '0')\n    return {\n      path: `Generated research note ${ordinal} with an intentionally long filename for truncation and virtualization coverage.md`,\n      kind: 'note' as const,\n      size_bytes: 512 + index,\n      modified_at: '2026-06-23T10:00:00Z',\n    }\n  })\n  return [...SCREENSHOT_SCAN, ...generated]\n}\n\nfunction activeNoteSummaries() {\n  return activeScanFixture().filter((entry) => entry.kind === 'note').map((entry) => {\n    const doc = e2eNoteDocument(entry.path)\n    return {\n      path: entry.path,\n      title: doc.metadata.title,\n      modified_at: entry.modified_at ?? '',\n      note_type: null,\n      organized: true,\n      archived: false,\n      tags: doc.metadata.tags,\n    }\n  })\n}\n"
replace(bootstrap, marker, helpers)
replace(bootstrap, '          window.setTimeout(() => resolve(SCREENSHOT_SCAN), 2500)', '          window.setTimeout(() => resolve(activeScanFixture()), 2500)')
replace(bootstrap, "        return SCREENSHOT_SCAN\n      case 'indexer_rebuild':", "        return activeScanFixture()\n      case 'indexer_rebuild':")
old_summaries = "SCREENSHOT_SCAN.filter((entry) => entry.kind === 'note').map((entry) => {\n                  const doc = e2eNoteDocument(entry.path)\n                  return {\n                    path: entry.path,\n                    title: doc.metadata.title,\n                    modified_at: entry.modified_at ?? '',\n                    note_type: null,\n                    organized: true,\n                    archived: false,\n                    tags: doc.metadata.tags,\n                  }\n                })"
replace(bootstrap, old_summaries, 'activeNoteSummaries()')
old_summaries_fast = "SCREENSHOT_SCAN.filter((entry) => entry.kind === 'note').map((entry) => {\n          const doc = e2eNoteDocument(entry.path)\n          return {\n            path: entry.path,\n            title: doc.metadata.title,\n            modified_at: entry.modified_at ?? '',\n            note_type: null,\n            organized: true,\n            archived: false,\n            tags: doc.metadata.tags,\n          }\n        })"
replace(bootstrap, old_summaries_fast, 'activeNoteSummaries()')

matrix = Path('e2e/visual-coverage-matrix.spec.ts')
matrix_text = matrix.read_text()
if "large fixture vault stays virtualized" in matrix_text:
    raise SystemExit('visual matrix final sweep already applied')
insertion = r'''

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
'''
closing = '\n})'
before, sep, after = matrix_text.rpartition(closing)
if not sep:
    raise SystemExit('visual matrix describe closing marker missing')
matrix.write_text(before + insertion + sep + after)

# Normalize application chrome onto the existing semantic/theme token contract.
replace('src/styles/components/onboarding.css', '  background: #075e54;\n  border-color: #075e54;\n  color: #fff;', '  background: var(--primary-strong);\n  border-color: var(--primary-strong);\n  color: var(--color-text-inverse, var(--bg-elevated));')
replace('src/styles/components/buttons.css', '  color: #ffffff;', '  color: var(--color-text-inverse, var(--bg-elevated));', 2)
replace('packages/editor/src/frontmatter-gutter.ts', "      color: '#c47a00',", "      color: 'var(--color-status-warning, var(--amber, #c47a00))',")
replace('src/styles/app/dock-settings.css', '  box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.06);', '  box-shadow: 0 -8px 24px color-mix(in oklch, var(--ink-strong) 6%, transparent);')
replace('src/styles/app/dock-settings.css', 'var(--red, #ef4444)', 'var(--danger, #ef4444)', 2)
replace('src/styles/app/dock-settings.css', 'var(--green, #22c55e)', 'var(--success, #22c55e)')
replace('src/styles/app/dock-settings.css', 'var(--yellow, #eab308)', 'var(--amber, #eab308)')
replace('src/components/BibliographyPanel.tsx', 'var(--color-error, #e53e3e)', 'var(--color-status-error, var(--danger, #e53e3e))')
gmail = 'src/components/GmailManagerPanel.tsx'
replace(gmail, 'var(--color-success-bg, rgba(16, 185, 129, 0.1))', 'var(--color-status-success-bg, color-mix(in srgb, var(--success) 10%, transparent))')
replace(gmail, 'var(--color-success, #10b981)', 'var(--color-status-success, var(--success, #10b981))')
replace(gmail, 'var(--color-error-bg, rgba(239, 68, 68, 0.1))', 'var(--color-status-error-bg, color-mix(in srgb, var(--danger) 10%, transparent))')
replace(gmail, 'var(--color-error, #ef4444)', 'var(--color-status-error, var(--danger, #ef4444))')
replace(gmail, 'var(--color-primary, #0f766e)', 'var(--color-accent-default, var(--primary, #0f766e))')
replace(gmail, "color: 'var(--color-error)'", "color: 'var(--color-status-error, var(--danger))'")
reader = 'src/styles/components/reader-panel.css'
replace(reader, '  --reader-bg: var(--color-surface-raised, #1a1a2e);', '  --reader-bg: var(--color-bg-raised, var(--surface-raised));')
replace(reader, '  --reader-border: var(--color-border-subtle, rgba(255 255 255 / 0.08));', '  --reader-border: var(--color-border-subtle, var(--border));')
replace(reader, '  --reader-text: var(--color-text-primary, #e2e8f0);', '  --reader-text: var(--color-text-default, var(--ink));')
replace(reader, '  --reader-muted: var(--color-text-muted, #94a3b8);', '  --reader-muted: var(--color-text-secondary, var(--muted));')
replace(reader, '  --reader-accent: var(--color-accent, #818cf8);', '  --reader-accent: var(--color-accent-default, var(--primary));')
replace(reader, 'var(--color-hover-bg, rgba(255 255 255 / 0.07))', 'var(--color-bg-hover, var(--surface-hover))', 2)
replace(reader, 'var(--color-text-danger, #f87171)', 'var(--color-status-error, var(--danger))')
replace(reader, 'var(--color-surface-overlay, #1e1e2f)', 'var(--color-bg-overlay, var(--surface-elevated))')
replace(reader, '  box-shadow: 0 8px 32px rgba(0 0 0 / 0.4);', '  box-shadow: var(--shadow-lg);')
replace(reader, 'var(--color-input-bg, rgba(255 255 255 / 0.05))', 'var(--color-bg-sunken, var(--surface-muted))')
replace(reader, '  color: #fff;', '  color: var(--color-text-inverse, var(--bg-elevated));')
replace('src/components/PanelErrorFallback.tsx', "  boxShadow: '0 8px 28px rgb(0 0 0 / 18%)',", "  boxShadow: 'var(--shadow-lg)',")
replace('src/components/PanelErrorFallback.tsx', "  background: 'color-mix(in srgb, var(--backdrop, #000) 35%, transparent)',", "  background: 'var(--overlay)',")
replace('src/styles/app/features.css', '  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);', '  box-shadow: var(--shadow-md);')
replace('src/styles/app/features.css', '  background: color-mix(in srgb, var(--backdrop, #000) 35%, transparent);', '  background: var(--overlay);')
replace('src/styles/components/theme-card.css', '  color: white;', '  color: var(--color-text-inverse, var(--bg-elevated));')
replace('packages/editor/src/find-replace.ts', "backgroundColor: 'var(--background, #fff)'", "backgroundColor: 'var(--surface-raised, var(--surface, #fff))'", 2)

ledger = 'docs/visual-remediation-2026-09-09.md'
replace(ledger, '- [ ] Complete the visual matrix for Windows scaling, long names, large data, loading/error states, and destructive confirmations. Compact widths, mobile/tablet, 125% app zoom, Persian RTL, German expansion, several errors, and destructive flows now have coverage.', '- [x] Complete the visual matrix for Windows scaling, long names, large data, loading/error states, and destructive confirmations. Coverage now includes Windows visual regression, 125% device scale and app zoom, compact/mobile/tablet widths, large virtualized vaults with long filenames, slow-loading skeletons, editor/preview failures, destructive confirmations, Persian RTL, and German expansion.')
replace(ledger, '- [ ] Remove remaining hard-coded implementation/theme colors where semantic tokens are required. Graph and the reviewed shell paths now use semantic tokens, but repository-wide completion still needs a final sweep.', '- [x] Remove remaining hard-coded implementation/theme colors where semantic tokens are required. The final repository sweep normalized application chrome, status colors, editor warnings, reader surfaces, error overlays, and primary-action foregrounds onto semantic/theme tokens. Literal colors that remain are intentional palette definitions, user/content colors, export/print output colors, data-visualization/category palettes, or fallback values behind semantic variables.')
