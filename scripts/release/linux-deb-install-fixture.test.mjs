import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { inspectInstalledDebFixture, writeInstalledDebEvidence } from './linux-deb-install-fixture.mjs'

const linuxTest = process.platform === 'linux' ? test : test.skip
const architecture = process.arch === 'arm64' ? 'aarch64' : 'x86_64'
const debArch = architecture === 'aarch64' ? 'arm64' : 'amd64'
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
function fixture({ corruptedReceipt = false, badDaemonVersion = false, symlinkDesktop = false, maintainerScript = false } = {}) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-install-fixture-test-'))
  const root = path.join(scratch, 'repo')
  const packageRoot = path.join(scratch, 'package')
  const assets = path.join(scratch, 'assets')
  const temporaryRoots = path.join(scratch, 'temporary-roots')
  for (const dir of [root, assets, temporaryRoots, path.join(packageRoot, 'DEBIAN'),
    path.join(packageRoot, 'usr/bin'), path.join(packageRoot, 'usr/lib/Scriptor/binaries')]) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  fs.writeFileSync(path.join(root, 'VERSION'), '1.3.3\n')
  git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
  git('add', 'VERSION'); git('commit', '-qm', 'source fixture')
  const commit = git('rev-parse', 'HEAD')
  fs.writeFileSync(path.join(packageRoot, 'DEBIAN/control'),
    'Package: scriptor\nVersion: 1.3.3\nArchitecture: ' + debArch
    + '\nMaintainer: Test <noreply@example.invalid>\nDescription: isolated package fixture\n')
  if (maintainerScript) {
    const postinst = path.join(packageRoot, 'DEBIAN/postinst')
    fs.writeFileSync(postinst, '#!/bin/sh\nexit 0\n')
    fs.chmodSync(postinst, 0o755)
  }
  const desktop = path.join(packageRoot, 'usr/bin/scriptor-desktop')
  if (symlinkDesktop) fs.symlinkSync('/usr/bin/true', desktop)
  else fs.copyFileSync('/usr/bin/true', desktop)
  const daemon = path.join(packageRoot, 'usr/lib/Scriptor/binaries/scriptor-daemon')
  const source = path.join(scratch, 'daemon.c')
  fs.writeFileSync(source, '#include <stdio.h>\nint main(int argc, char **argv) { if (argc==2 && argv[1][0]==45 && argv[1][1]==45) { puts("scriptor-daemon '
    + (badDaemonVersion ? '9.9.9' : '1.3.3') + '"); return 0; } return 6; }\n')
  execFileSync('cc', [source, '-o', daemon]); fs.chmodSync(daemon, 0o755)
  fs.writeFileSync(daemon + '.staging-receipt.json', JSON.stringify({
    artifact: 'scriptor-daemon', source: 'local-build', checkoutVersion: '1.3.3',
    bytes: fs.statSync(daemon).size, sha256: corruptedReceipt ? 'f'.repeat(64) : digest(daemon),
  }))
  const packageFile = path.join(assets, 'scriptor-1.3.3-linux-' + architecture + '.deb')
  execFileSync('dpkg-deb', ['--build', '--root-owner-group', packageRoot, packageFile])
  return { scratch, root, assets, packageFile, temporaryRoots, commit,
    opts: { root, directory: assets, expectedCommit: commit, architecture, temporaryRoots },
    cleanup: () => fs.rmSync(scratch, { recursive: true, force: true }) }
}

linuxTest('isolated DEB fixture installs actual files, executes bundled daemon, and removes installed files', () => {
  const f = fixture()
  try {
    const result = inspectInstalledDebFixture(f.opts)
    assert.equal(result.sourceCommit, f.commit)
    assert.equal(result.version, '1.3.3')
    assert.equal(result.architecture, architecture)
    assert.equal(result.package.sha256, digest(f.packageFile))
    assert.match(result.installedDesktop.sha256, /^[a-f0-9]{64}$/)
    assert.match(result.installedDaemon.sha256, /^[a-f0-9]{64}$/)
    assert.equal(result.daemonOutput, 'scriptor-daemon 1.3.3')
    assert.equal(result.acceptance.isolatedPackageManagerInstall, true)
    assert.equal(result.acceptance.packageManagerLogConfined, true)
    assert.equal(result.acceptance.uninstallFilesRemoved, true)
    assert.equal(result.acceptance.hostSystemInstalled, false)
    assert.equal(result.acceptance.desktopProcessLaunched, false)
    assert.equal(result.acceptance.runtimeDependenciesChecked, false)
    assert.equal(result.acceptance.upgradeMigrationVerified, false)
    assert.equal(result.acceptance.releaseAuthorized, false)
    assert.deepEqual(fs.readdirSync(f.temporaryRoots), [], 'isolated install root was not cleaned')
    const output = path.join(f.scratch, 'receipt.json')
    writeInstalledDebEvidence(output, result)
    assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).sourceCommit, f.commit)
    assert.throws(() => writeInstalledDebEvidence(output, result), /exist|overwrite|refus/i)
  } finally { f.cleanup() }
})

linuxTest('isolated DEB fixture rejects incorrect commit, dirty VERSION and target architecture', () => {
  const f = fixture()
  try {
    assert.throws(() => inspectInstalledDebFixture({ ...f.opts, expectedCommit: 'f'.repeat(40) }), /source|commit/i)
    assert.throws(() => inspectInstalledDebFixture({ ...f.opts, architecture: architecture === 'x86_64' ? 'aarch64' : 'x86_64' }), /architecture|host/i)
    fs.writeFileSync(path.join(f.root, 'VERSION'), '1.3.4\n')
    assert.throws(() => inspectInstalledDebFixture(f.opts), /version|commit/i)
    assert.deepEqual(fs.readdirSync(f.temporaryRoots), [])
  } finally { f.cleanup() }
})

linuxTest('isolated DEB fixture rejects a forged sidecar receipt and still cleans temporary state', () => {
  const f = fixture({ corruptedReceipt: true })
  try {
    assert.throws(() => inspectInstalledDebFixture(f.opts), /receipt|hash|sha/i)
    assert.deepEqual(fs.readdirSync(f.temporaryRoots), [])
  } finally { f.cleanup() }
})

linuxTest('isolated DEB fixture rejects mismatched daemon output and installed desktop symlinks', () => {
  const wrongVersion = fixture({ badDaemonVersion: true })
  const symlinked = fixture({ symlinkDesktop: true })
  try {
    assert.throws(() => inspectInstalledDebFixture(wrongVersion.opts), /daemon|version/i)
    assert.throws(() => inspectInstalledDebFixture(symlinked.opts), /symlink|regular|desktop/i)
    assert.deepEqual(fs.readdirSync(wrongVersion.temporaryRoots), [])
    assert.deepEqual(fs.readdirSync(symlinked.temporaryRoots), [])
  } finally { wrongVersion.cleanup(); symlinked.cleanup() }
})

linuxTest('isolated DEB fixture refuses maintainer scripts before invoking the package manager', () => {
  const f = fixture({ maintainerScript: true })
  try {
    assert.throws(() => inspectInstalledDebFixture(f.opts), /Refusing to run Debian maintainer script/)
    assert.deepEqual(fs.readdirSync(f.temporaryRoots), [])
  } finally { f.cleanup() }
})
