import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { verifyPackagedDeb, writePackagedDebReceipt } from './linux-deb-smoke.mjs'

const digest = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64'
const debArch = arch === 'aarch64' ? 'arm64' : 'amd64'

function makeFixture({ version = '1.3.3', daemonVersion = version, corruptReceipt = false,
  missingReceipt = false, linkedDesktop = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-deb-smoke-test-'))
  const repo = path.join(root, 'repo')
  const staged = path.join(root, 'debroot')
  const assets = path.join(root, 'assets')
  for (const dir of [repo, assets, path.join(staged, 'DEBIAN'), path.join(staged, 'usr/bin'),
    path.join(staged, 'usr/lib/Scriptor/binaries')]) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(repo, 'VERSION'), version + '\n')
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
  git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
  git('add', 'VERSION'); git('commit', '-qm', 'fixture')
  const sha = git('rev-parse', 'HEAD')
  fs.writeFileSync(path.join(staged, 'DEBIAN/control'),
    'Package: scriptor\nVersion: ' + version + '\nArchitecture: ' + debArch
    + '\nMaintainer: Scriptor <noreply@example.invalid>\nDescription: fixture only\n')
  const desktop = path.join(staged, 'usr/bin/scriptor-desktop')
  if (linkedDesktop) fs.symlinkSync('/usr/bin/true', desktop)
  else fs.copyFileSync('/usr/bin/true', desktop)
  const daemon = path.join(staged, 'usr/lib/Scriptor/binaries/scriptor-daemon')
  const src = path.join(root, 'daemon.c')
  fs.writeFileSync(src, '#include <stdio.h>\nint main(int argc,char**argv){ if (argc==2 && argv[1][0]=='
    + "'-'" + ' && argv[1][1]==' + "'-'" + ') {puts("scriptor-daemon ' + daemonVersion
    + '");return 0;} return 7;}\n')
  execFileSync('cc', [src, '-o', daemon])
  if (!missingReceipt) fs.writeFileSync(daemon + '.staging-receipt.json', JSON.stringify({
    artifact: 'scriptor-daemon', sha256: corruptReceipt ? '0'.repeat(64) : digest(daemon),
    bytes: fs.statSync(daemon).size, source: 'local-build', checkoutVersion: version,
  }))
  const deb = path.join(assets, 'scriptor-' + version + '-linux-' + arch + '.deb')
  execFileSync('dpkg-deb', ['--build', '--root-owner-group', staged, deb])
  return { root, repo, assets, sha, deb,
    opts: { root: repo, directory: assets, expectedCommit: sha, architecture: arch },
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }) }
}

test('packaged Linux DEB: inspect actual ELF, execute bundled daemon, and bind version/hash/source', () => {
  const f = makeFixture()
  try {
    const report = verifyPackagedDeb(f.opts)
    assert.equal(report.scope, 'deb-packaged-daemon-smoke-only')
    assert.equal(report.sourceCommit, f.sha)
    assert.equal(report.version, '1.3.3')
    assert.equal(report.platform, 'linux')
    assert.equal(report.architecture, arch)
    assert.equal(report.package.sha256, digest(f.deb))
    assert.equal(report.daemonVersionOutput, 'scriptor-daemon 1.3.3')
    assert.match(report.daemon.sha256, /^[a-f0-9]{64}$/)
    assert.equal(report.acceptance.desktopExecutableLaunched, false)
    assert.equal(report.acceptance.installedDesktopVerified, false)
    assert.equal(report.acceptance.releaseAuthorized, false)
    const out = path.join(f.root, 'evidence/result.json')
    writePackagedDebReceipt(out, report)
    assert.equal(JSON.parse(fs.readFileSync(out, 'utf8')).sourceCommit, f.sha)
    assert.throws(() => writePackagedDebReceipt(out, report), /overwrite|exists|refus/i)
  } finally { f.cleanup() }
})

test('packaged Linux DEB: fail closed on forged source, wrong version, and wrong target architecture', () => {
  const f = makeFixture()
  try {
    assert.throws(() => verifyPackagedDeb({ ...f.opts, expectedCommit: 'f'.repeat(40) }), /source|commit/i)
    assert.throws(() => verifyPackagedDeb({ ...f.opts, architecture: arch === 'x86_64' ? 'aarch64' : 'x86_64' }), /architecture|host/i)
    fs.writeFileSync(path.join(f.repo, 'VERSION'), '1.3.4\n')
    assert.throws(() => verifyPackagedDeb(f.opts), /version|source/i)
  } finally { f.cleanup() }
})

test('packaged Linux DEB: reject mismatched embedded receipt and wrong daemon version', () => {
  const corrupted = makeFixture({ corruptReceipt: true })
  const badVersion = makeFixture({ daemonVersion: '0.0.0' })
  try {
    assert.throws(() => verifyPackagedDeb(corrupted.opts), /hash|sha|receipt|mismatch/i)
    assert.throws(() => verifyPackagedDeb(badVersion.opts), /daemon|version/i)
  } finally { corrupted.cleanup(); badVersion.cleanup() }
})

test('packaged Linux DEB: reject missing receipt and symlinked executable', () => {
  const missing = makeFixture({ missingReceipt: true })
  const linked = makeFixture({ linkedDesktop: true })
  try {
    assert.throws(() => verifyPackagedDeb(missing.opts), /missing|receipt/i)
    assert.throws(() => verifyPackagedDeb(linked.opts), /symlink|regular|executable/i)
  } finally { missing.cleanup(); linked.cleanup() }
})
