import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('production release signing is fail-closed and publication verifies signing evidence', () => {
  const workflow = read('.github/workflows/release.yml')
  assert.match(workflow, /validate-signing-policy\.mjs/)
  assert.match(workflow, /write-signing-evidence\.mjs/)
  assert.match(workflow, /verify-signing-evidence\.mjs/)
  assert.doesNotMatch(workflow, /Signing is optional/)
  assert.doesNotMatch(workflow, /skipping (Linux package signing|macOS signature)/)
  assert.match(read('scripts/release/sign-installers.ps1'), /required for production releases/)
  assert.doesNotMatch(workflow, /skipping (?:Linux package signing|macOS signature\/notarization verification)/i)

  const signWindows = workflow.indexOf('name: Sign and verify Windows production installers')
  const writeWindowsManifest = workflow.indexOf('name: Write Windows release manifest')
  const verifyWindowsManifest = workflow.indexOf('name: Verify Windows release manifest')
  assert.ok(signWindows >= 0, 'Windows signing step is missing')
  assert.ok(writeWindowsManifest > signWindows, 'Windows manifest must be generated after signing')
  assert.ok(verifyWindowsManifest > writeWindowsManifest, 'Windows manifest must be verified after generation')
})

test('release receipt records and verifies platform signing state', () => {
  const receipt = read('scripts/release/create-receipt.mjs')
  const verifier = read('scripts/release/verify-release-evidence.mjs')
  assert.match(receipt, /collectSigningEvidence/)
  assert.match(receipt, /signing:/)
  assert.match(verifier, /assertSigningEvidence/)
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

test('MCP runtime types and Windows installer verification stay complete', () => {
  const runtime = read('packages/mcp/src/runtime.ts')
  assert.match(runtime, /import type \{[^}]*McpToolDescriptor[^}]*\} from/)
  assert.match(runtime, /import type \{[^}]*ExportProfile[^}]*\} from/)

  const security = read('docs/RELEASE-SECURITY.md')
  assert.match(security, /\*\.exe.*\*\.msi|\*\.msi.*\*\.exe/s)
})

test('hash mismatch fixture fails only the first qualifying save', () => {
  const bootstrap = read('src/e2e/bootstrap.ts')
  assert.match(
    bootstrap,
    /if\s*\(\s*window\.sessionStorage\.getItem\('e2e:hash-mismatch'\)\s*===\s*'1'\s*&&\s*body\.expectedContentHash\s*&&\s*!hashMismatchTriggered\s*\)\s*\{\s*hashMismatchTriggered\s*=\s*true[\s\S]{0,200}?throw new Error\(/,
  )
})
