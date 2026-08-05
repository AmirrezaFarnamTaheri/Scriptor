import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('production publication is secret-free, architecture-complete, and stages installers only', () => {
  const workflow = read('.github/workflows/release.yml')
  const signingPolicy = read('scripts/release/signing-policy.mjs')
  const staging = read('scripts/release/stage-release-assets.mjs')

  assert.doesNotMatch(workflow, /\bsecrets\./)
  assert.doesNotMatch(workflow, /WINDOWS_CERTIFICATE|APPLE_CERTIFICATE|LINUX_SIGNING_KEY/)
  assert.doesNotMatch(signingPolicy, /WINDOWS_CERTIFICATE|APPLE_CERTIFICATE|LINUX_SIGNING_KEY/)
  assert.match(signingPolicy, /requiredInputs:\s*\[\]/)
  assert.match(workflow, /architecture:\s*x86_64/)
  assert.match(workflow, /architecture:\s*aarch64/)
  assert.match(workflow, /ubuntu-24\.04-arm/)
  assert.match(workflow, /stage-release-assets\.mjs/)
  assert.match(staging, /expected exactly one/)
  assert.doesNotMatch(workflow, /target\/release\/bundle\/\*\*\/\*/)
  assert.equal(fs.existsSync(path.join(root, '.github/workflows/release-arms.yml')), false)
})

test('manual release dispatch defaults to preview and production requires an immutable v* tag', () => {
  const workflow = read('.github/workflows/release.yml')
  const kickoff = read('.github/workflows/release-kickoff.yml')
  const dispatchStart = workflow.indexOf('  workflow_dispatch:')
  const tagStart = workflow.indexOf('  push:', dispatchStart)
  assert.ok(dispatchStart >= 0 && tagStart > dispatchStart, 'release workflow dispatch block is missing')
  const dispatch = workflow.slice(dispatchStart, tagStart)
  assert.match(dispatch, /publish:/)
  assert.match(dispatch, /default:\s*false/)

  const productionGuard = /github\.event_name\s*==\s*'workflow_dispatch'[\s\S]{0,200}?inputs\.publish[\s\S]{0,200}?startsWith\(github\.ref,\s*'refs\/tags\/v'\)/
  assert.match(workflow, productionGuard)
  assert.match(workflow, /github\.event_name\s*==\s*'push'[\s\S]{0,200}?startsWith\(github\.ref,\s*'refs\/tags\/v'\)/)
  assert.match(kickoff, /git tag -a/)
  assert.match(kickoff, /gh workflow run release\.yml/)
  assert.match(kickoff, /refusing to move or reuse it/)
})

test('release receipt records target-specific unsigned trust status with schema 4', () => {
  const receipt = read('scripts/release/create-receipt.mjs')
  const verifier = read('scripts/release/verify-release-evidence.mjs')
  const signing = read('scripts/release/signing-evidence.mjs')
  assert.match(receipt, /schemaVersion:\s*4/)
  assert.match(verifier, /receipt\.schemaVersion !== 4/)
  assert.match(receipt, /collectSigningEvidence/)
  assert.match(receipt, /signing,/)
  assert.match(verifier, /assertSigningEvidence/)
  assert.match(signing, /architecture:/)
  assert.match(signing, /DEFAULT_RELEASE_TARGETS/)
  assert.doesNotMatch(signing, /production .* artifact is unsigned/)
})

test('toolbar popovers escape scroll clipping and provide keyboard recovery', () => {
  const portal = read('src/components/ToolbarPopover.tsx')
  const css = read('src/styles/components/toolbar-popover.css')
  const appCss = read('src/App.css')
  assert.match(portal, /createPortal\(/)
  assert.match(portal, /document\.body/)
  assert.match(portal, /addEventListener\('scroll', updatePosition, true\)/)
  assert.match(portal, /ResizeObserver/)
  assert.match(portal, /event\.key !== 'Escape'/)
  assert.match(css, /position:\s*fixed/)
  assert.match(css, /z-index:\s*10000/)
  assert.match(appCss, /toolbar-popover\.css/)

  for (const file of ['src/components/TypographyMenu.tsx', 'src/components/InsertMenu.tsx']) {
    const source = read(file)
    assert.match(source, /<ToolbarPopover/)
    assert.match(source, /aria-controls=/)
    assert.doesNotMatch(source, /<menu className=/)
  }
})

test('functional and visual Playwright suites are enforced by release and CI', () => {
  const packageJson = JSON.parse(read('package.json'))
  const releaseCommand = packageJson.scripts['check:release']
  assert.match(releaseCommand, /test:e2e/)
  assert.match(releaseCommand, /test:visual/)

  const ci = read('.github/workflows/ci.yml')
  assert.match(ci, /name: Browser E2E and visual regression/)
  assert.match(ci, /test:e2e/)
  assert.match(ci, /test:visual/)
})

test('browser integration suites contain no permanent skips', () => {
  const files = fs.readdirSync(path.join(root, 'e2e')).filter((name) => name.endsWith('.spec.ts'))
  const permanentAnnotation = /\btest(?:\.[A-Za-z_$][\w$]*)*\.(?:skip|fixme)\b/
  const skipped = files.flatMap((name) => {
    const source = read(`e2e/${name}`)
    return permanentAnnotation.test(source) ? [name] : []
  })
  assert.deepEqual(skipped, [])
})

test('every ignored RustSec advisory has an owned, dated exception record', () => {
  const deny = read('deny.toml')
  const ignored = [...deny.matchAll(/"(RUSTSEC-\d{4}-\d{4})"/g)].map((match) => match[1])
  assert.ok(ignored.length > 0)
  const ledger = read('docs/security/RUSTSEC-EXCEPTIONS.md')
  for (const advisory of ignored) {
    assert.match(ledger, new RegExp(`\\| ${advisory} \\|`), `${advisory} missing from exception ledger`)
  }
  for (const heading of ['Owner', 'Reachability', 'Upstream', 'Review by', 'Exit condition']) {
    assert.match(ledger, new RegExp(`\\b${heading}\\b`))
  }
})

test('merged audit report records final verification instead of pending status', () => {
  const report = read('docs/reports/AI_SLOP_CLEANUP.md')
  assert.doesNotMatch(report, /current-head CI is pending/i)
  assert.doesNotMatch(report, /verification remains pending/i)
  assert.match(report, /30965142253/)
  assert.match(report, /c3ae10c4886637e4029687cc13cef519bac5f285/)
})

test('reviewed workspace async flows remain race-free and rejection-safe', () => {
  const capture = read('src/components/app/QuickCaptureWorkspaceLayer.tsx')
  assert.match(
    capture,
    /void workspace\s*\.\s*createNote\(title,\s*body\)[\s\S]{0,400}?\.catch\(\(error\) => reportCaptureFailure\(operation,\s*error\)\)/,
  )
  assert.doesNotMatch(capture, /workspace\.updateDraft\(/)
  assert.doesNotMatch(capture, /workspace\.saveActiveNoteNow\(/)

  const rename = read('src/components/app/WorkspaceRenameDialogs.tsx')
  assert.match(
    rename,
    /const runWorkspaceOperation = \([\s\S]{0,300}?\) => \{[\s\S]{0,300}?void promise[\s\S]{0,300}?\.catch\(\(error\) =>[\s\S]{0,300}?workspace\.logActivity\(\s*'error'/,
  )
  for (const mutation of [
    'previewTagRename',
    'applyTagRename',
    'previewBlockRename',
    'applyBlockRename',
    'previewSectionRename',
    'applySectionRename',
    'previewRename',
    'applyRename',
  ]) {
    assert.match(
      rename,
      new RegExp(`runWorkspaceOperation\\([\\s\\S]{0,500}?workspace\\.${mutation}\\(`),
      `${mutation} must be routed through runWorkspaceOperation`,
    )
  }
  assert.doesNotMatch(rename, /void workspace\./)
})

test('release workflows remain portable and install the complete browser runtime', () => {
  const release = read('.github/workflows/release.yml')
  assert.doesNotMatch(release, /\bmapfile\b/)
  assert.doesNotMatch(release, /echo ".*" >> "\$GITHUB_ENV"[\s\S]*echo ".*" >> "\$GITHUB_ENV"/)

  const ci = read('.github/workflows/ci.yml')
  assert.match(ci, /Install Playwright FFmpeg runtime/)
  assert.match(ci, /"playwright", "install", "ffmpeg"/)
})

test('MCP runtime types and Windows unsigned verification stay complete', () => {
  const runtime = read('packages/mcp/src/runtime.ts')
  assert.match(runtime, /import type \{[^}]*McpToolDescriptor[^}]*\} from/)
  assert.match(runtime, /import type \{[^}]*ExportProfile[^}]*\} from/)

  const security = read('docs/RELEASE-SECURITY.md')
  assert.match(security, /Windows.*unknown-publisher|unknown-publisher.*Windows/is)
})

test('hash mismatch fixture fails only the first qualifying save', () => {
  const bootstrap = read('src/e2e/bootstrap.ts')
  assert.match(
    bootstrap,
    /if\s*\(\s*window\.sessionStorage\.getItem\('e2e:hash-mismatch'\)\s*===\s*'1'\s*&&\s*body\.expectedContentHash\s*&&\s*!hashMismatchTriggered\s*\)\s*\{\s*hashMismatchTriggered\s*=\s*true[\s\S]{0,200}?throw new Error\(/,
  )
})
