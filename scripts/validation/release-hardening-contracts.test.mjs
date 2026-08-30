import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('unsigned release remains the secret-free default while native signing is explicitly gated', () => {
  const workflow = read('.github/workflows/release.yml')
  const signingPolicy = read('scripts/release/signing-policy.mjs')
  const staging = read('scripts/release/stage-release-assets.mjs')

  const dispatchStart = workflow.indexOf('  workflow_dispatch:')
  const concurrencyStart = workflow.indexOf('concurrency:', dispatchStart)
  const dispatch = workflow.slice(dispatchStart, concurrencyStart)
  assert.match(dispatch, /trust_profile:[\s\S]*default:\s*unsigned/)
  assert.match(dispatch, /native-signed/)

  const windowsImportStart = workflow.indexOf('- name: Import Windows publisher certificate')
  const macImportStart = workflow.indexOf('- name: Import macOS Developer ID certificate')
  const buildStart = workflow.indexOf('- name: Build Tauri bundles', macImportStart)
  assert.ok(windowsImportStart > 0 && macImportStart > windowsImportStart && buildStart > macImportStart)
  const windowsImport = workflow.slice(windowsImportStart, macImportStart)
  const macImport = workflow.slice(macImportStart, buildStart)
  assert.match(windowsImport, /if: inputs\.trust_profile == 'native-signed'/)
  assert.match(windowsImport, /secrets\.WINDOWS_CERTIFICATE/)
  assert.match(macImport, /if: inputs\.trust_profile == 'native-signed'/)
  assert.match(macImport, /secrets\.APPLE_CERTIFICATE/)

  for (const line of workflow.split(/\r?\n/).filter((value) => /secrets\./.test(value))) {
    const inlineGated = /inputs\.trust_profile == 'native-signed'/.test(line)
    const inWindowsImport = workflow.indexOf(line) >= windowsImportStart && workflow.indexOf(line) < macImportStart
    const inMacImport = workflow.indexOf(line) >= macImportStart && workflow.indexOf(line) < buildStart
    assert.ok(inlineGated || inWindowsImport || inMacImport, `ungated release secret reference: ${line.trim()}`)
  }

  assert.match(signingPolicy, /trustProfile = 'unsigned'/)
  assert.match(signingPolicy, /requiredProductionInputs/)
  assert.match(signingPolicy, /WINDOWS_CERTIFICATE/)
  assert.match(signingPolicy, /APPLE_CERTIFICATE/)
  assert.doesNotMatch(signingPolicy, /LINUX_SIGNING_KEY/)
  assert.match(workflow, /architecture:\s*x86_64/)
  assert.match(workflow, /architecture:\s*aarch64/)
  assert.match(workflow, /ubuntu-24\.04-arm/)
  assert.match(workflow, /verify-runner-architecture\.mjs/)
  assert.match(workflow, /stage-release-assets\.mjs/)
  assert.match(staging, /expected exactly one/)
  assert.doesNotMatch(workflow, /target\/release\/bundle\/\*\*\/\*/)
  assert.equal(fs.existsSync(path.join(root, '.github/workflows/release-arms.yml')), false)
  assert.equal(fs.existsSync(path.join(root, '.github/workflows/prepare-release-version.yml')), false)
  assert.equal(fs.existsSync(path.join(root, 'scripts/release/sign-installers.ps1')), false)
})

test('manual release dispatch builds canonical VERSION and production requires an immutable v* tag', () => {
  const workflow = read('.github/workflows/release.yml')
  const kickoff = read('.github/workflows/release-kickoff.yml')
  const versionScript = read('scripts/release/version.mjs')
  const dispatchStart = workflow.indexOf('  workflow_dispatch:')
  const concurrencyStart = workflow.indexOf('concurrency:', dispatchStart)
  assert.ok(
    dispatchStart >= 0 && concurrencyStart > dispatchStart,
    'release workflow dispatch block is missing',
  )
  const dispatch = workflow.slice(dispatchStart, concurrencyStart)
  assert.match(dispatch, /publish:/)
  assert.match(dispatch, /default:\s*false/)
  assert.doesNotMatch(dispatch, /\bversion:/)
  assert.match(workflow, /Get-Content -LiteralPath VERSION -Raw/)
  assert.match(workflow, /SCRIPTOR_RELEASE_VERSION=v\$canonicalVersion/)

  const productionGuard = /inputs\.publish[\s\S]{0,120}?startsWith\(github\.ref,\s*'refs\/tags\/v'\)/
  assert.match(workflow, productionGuard)
  assert.doesNotMatch(workflow, /\n\s+push:\s*\n/)
  assert.doesNotMatch(workflow, /environment:\s*release-production/)
  assert.match(kickoff, /workflow_dispatch:/)
  assert.doesNotMatch(kickoff, /\n\s+push:\s*\n/)
  assert.doesNotMatch(kickoff, /environment:\s*release-production/)
  assert.match(kickoff, /git tag -a/)
  assert.match(kickoff, /gh workflow run release\.yml/)
  assert.match(kickoff, /--ref "\$\{\{ steps\.tag\.outputs\.tag \}\}"/)
  assert.doesNotMatch(kickoff, /-f version=/)
  assert.match(kickoff, /refusing to move or reuse it/)
  assert.match(versionScript, /const versionTag = \/\^v/)
  assert.match(versionScript, /versionTag\.test\(refName\)/)
})

test('release kickoff only tags the default-branch commit after CI succeeds for that exact SHA', () => {
  const kickoff = read('.github/workflows/release-kickoff.yml')

  assert.match(kickoff, /EXPECTED_BRANCH:\s*\$\{\{ github\.event\.repository\.default_branch \}\}/)
  assert.match(kickoff, /test "\$GITHUB_REF_NAME" = "\$EXPECTED_BRANCH"/)
  assert.match(kickoff, /actions\/runs\?head_sha=\$GITHUB_SHA&event=push&status=completed/)
  assert.match(kickoff, /\.name == "CI" and \.conclusion == "success"/)
  assert.match(kickoff, /test "\$successful_ci_runs" -gt 0/)
})

test('release receipt separates installer subjects from architecture trust metadata', () => {
  const workflow = read('.github/workflows/release.yml')
  const receipt = read('scripts/release/create-receipt.mjs')
  const verifier = read('scripts/release/verify-release-evidence.mjs')
  const signing = read('scripts/release/signing-evidence.mjs')

  assert.match(receipt, /schemaVersion:\s*4/)
  assert.match(verifier, /receipt\.schemaVersion !== 4/)
  assert.match(receipt, /collectSigningEvidence\(outDir\)/)
  assert.match(verifier, /collectSigningEvidence\(evidenceDir\)/)
  assert.match(receipt, /signing,/)
  assert.match(verifier, /assertSigningEvidence/)
  assert.match(signing, /architecture:/)
  assert.match(signing, /DEFAULT_RELEASE_TARGETS/)
  assert.doesNotMatch(signing, /production .* artifact is unsigned/)

  assert.match(workflow, /Separate installer subjects from trust metadata/)
  assert.match(workflow, /mv "\$\{evidence\[@\]\}" release-evidence\//)
  assert.match(workflow, /test "\$\{#installers\[@\]\}" -eq 7/)
  assert.match(workflow, /test "\$\{#evidence\[@\]\}" -eq 4/)
  assert.match(workflow, /verify-signing-evidence\.mjs release-evidence/)
  assert.match(workflow, /subject-path:\s*release-artifacts\/\*/)
  assert.doesNotMatch(workflow, /subject-path:\s*release-evidence/)
})

test('toolbar popovers escape scroll clipping without a React positioning loop', () => {
  const portal = read('src/components/ToolbarPopover.tsx')
  const css = read('src/styles/components/toolbar-popover.css')
  const appCss = read('src/App.css')
  const e2e = read('e2e/toolbar-popovers.spec.ts')

  assert.match(portal, /createPortal\(/)
  assert.match(portal, /document\.body/)
  assert.match(portal, /addEventListener\('scroll', updatePosition, true\)/)
  assert.match(portal, /ResizeObserver/)
  assert.match(portal, /event\.key !== 'Escape'/)
  assert.match(portal, /event\.key === 'Tab'/)
  assert.match(portal, /panel\.style\.top/)
  assert.match(portal, /data-positioned="false"/)
  assert.doesNotMatch(portal, /\buseState\b|setPosition/)
  assert.match(css, /position:\s*fixed/)
  assert.match(css, /z-index:\s*10000/)
  assert.match(css, /data-positioned='false'/)
  assert.match(appCss, /toolbar-popover\.css/)
  assert.match(e2e, /parentElement === document\.body/)
  assert.match(e2e, /press\('Tab'\)/)

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

test('v1 baseline excludes superseded audit packets', () => {
  assert.equal(fs.existsSync(path.join(root, 'docs/reports/AI_SLOP_CLEANUP.md')), false)
  const baseline = read('docs/FINAL-REMEDIATION-REPORT.md')
  assert.match(baseline, /one current source, API, and persisted-state schema/i)
  assert.match(baseline, /exact source head/i)
})

test('binary review uses the declared Cargo binary names', () => {
  const reviewScript = read('scripts/release/review-binaries.ps1')
  const cliManifest = read('crates/cli/Cargo.toml')
  const daemonManifest = read('crates/daemon/Cargo.toml')

  assert.match(cliManifest, /\[\[bin\]\][\s\S]*?name\s*=\s*"scriptor"/)
  assert.match(daemonManifest, /\[\[bin\]\][\s\S]*?name\s*=\s*"scriptor-daemon"/)
  assert.match(reviewScript, /target\/release\/scriptor\$suffix/)
  assert.match(reviewScript, /target\/release\/scriptor-daemon\$suffix/)
  assert.doesNotMatch(reviewScript, /target\/release\/scriptor-cli\$suffix/)
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
  assert.match(
    ci,
    /- name: Verify hosted ChromeDriver for axe[\s\S]*?CHROMEWEBDRIVER is required for the axe audit[\s\S]*?- name: Run axe-core WCAG audit/,
  )
})

test('MCP runtime types and Windows unsigned verification stay complete', () => {
  const runtime = read('packages/mcp/src/runtime.ts')
  assert.match(runtime, /import type \{[^}]*McpToolDescriptor[^}]*\} from/)
  assert.match(runtime, /import type \{[^}]*ExportProfile[^}]*\} from/)

  const security = read('docs/RELEASE-SECURITY.md')
  assert.match(security, /Windows.*unknown-publisher|unknown-publisher.*Windows/is)
  assert.match(security, /seven installer subjects only/i)
})

test('hash mismatch fixture fails only the first qualifying save', () => {
  const bootstrap = read('src/e2e/bootstrap.ts')
  assert.match(
    bootstrap,
    /if\s*\(\s*window\.sessionStorage\.getItem\('e2e:hash-mismatch'\)\s*===\s*'1'\s*&&\s*body\.expectedContentHash\s*&&\s*!hashMismatchTriggered\s*\)\s*\{\s*hashMismatchTriggered\s*=\s*true[\s\S]{0,200}?throw new Error\(/,
  )
})
