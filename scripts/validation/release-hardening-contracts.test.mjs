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
  const skipped = files.flatMap((name) => {
    const source = read(`e2e/${name}`)
    return source.includes('test.skip') ? [name] : []
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
