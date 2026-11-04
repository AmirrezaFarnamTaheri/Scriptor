#!/usr/bin/env node
/** CI-built DEB install/remove in a disposable fakeroot+dpkg root. Never host installation. */
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const assert = (condition, message) => { if (!condition) throw new Error(message) }
const archToMachine = { x86_64: 62, aarch64: 183 }
const archToDeb = { x86_64: 'amd64', aarch64: 'arm64' }
const hostArch = process.arch === 'x64' ? 'x86_64' : process.arch === 'arm64' ? 'aarch64' : null
function hashFile(file) {
  const hash = crypto.createHash('sha256')
  const chunk = Buffer.allocUnsafe(1024 * 1024)
  const fd = fs.openSync(file, 'r')
  try {
    let bytes
    while ((bytes = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) hash.update(chunk.subarray(0, bytes))
  } finally { fs.closeSync(fd) }
  return hash.digest('hex')
}
function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, {
    encoding: 'utf8', timeout: 30000, maxBuffer: 256 * 1024,
    windowsHide: true, ...options,
  }).trim()
}
function installedFile(root, relative) {
  const base = fs.realpathSync(root)
  const file = path.join(base, relative)
  const stat = fs.lstatSync(file)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0,
    'Missing, empty, or symlinked installed file: ' + relative)
  assert(fs.realpathSync(file).startsWith(base + path.sep), 'Installed file escapes isolated root: ' + relative)
  return { file, bytes: stat.size, sha256: hashFile(file) }
}
function assertElf(file, architecture) {
  const fd = fs.openSync(file, 'r')
  const header = Buffer.alloc(20)
  try { assert(fs.readSync(fd, header, 0, header.length, 0) === 20, 'Truncated native ELF header') }
  finally { fs.closeSync(fd) }
  assert(header.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70]))
    && header[4] === 2 && header[5] === 1 && header.readUInt16LE(18) === archToMachine[architecture],
  'Installed executable ELF architecture mismatch')
}
export function inspectInstalledDebFixture({ root, directory, expectedCommit, architecture, temporaryRoots }) {
  assert(process.platform === 'linux', 'Isolated dpkg installation requires Linux')
  assert(Object.hasOwn(archToMachine, architecture) && hostArch === architecture,
    'Isolated dpkg target architecture differs from runner host architecture')
  assert(typeof expectedCommit === 'string' && /^[0-9a-f]{40}$/i.test(expectedCommit),
    'Exact source commit SHA required')
  const sourceRoot = fs.realpathSync(root)
  const sourceCommit = run('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot })
  assert(sourceCommit.toLowerCase() === expectedCommit.toLowerCase(), 'Exact checkout source commit mismatch')
  const version = fs.readFileSync(path.join(sourceRoot, 'VERSION'), 'utf8').trim()
  assert(version === run('git', ['show', 'HEAD:VERSION'], { cwd: sourceRoot }),
    'Canonical VERSION changed from committed source')
  assert(/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version), 'Invalid canonical VERSION')
  const assetsRoot = fs.realpathSync(directory)
  const packageName = 'scriptor-' + version + '-linux-' + architecture + '.deb'
  const packageFile = path.join(assetsRoot, packageName)
  const packageStat = fs.lstatSync(packageFile)
  assert(packageStat.isFile() && !packageStat.isSymbolicLink() && packageStat.size > 0,
    'Required DEB is empty, missing, or symlinked')
  assert(run('dpkg-deb', ['--field', packageFile, 'Package']) === 'scriptor', 'Unexpected package name')
  assert(run('dpkg-deb', ['--field', packageFile, 'Version']) === version, 'DEB/source version mismatch')
  assert(run('dpkg-deb', ['--field', packageFile, 'Architecture']) === archToDeb[architecture],
    'DEB target architecture mismatch')

  const parent = fs.realpathSync(temporaryRoots || os.tmpdir())
  const isolatedRoot = fs.mkdtempSync(path.join(parent, 'scriptor-isolated-dpkg-'))
  try {
    fs.mkdirSync(path.join(isolatedRoot, 'var/lib/dpkg'), { recursive: true })
    fs.writeFileSync(path.join(isolatedRoot, 'var/lib/dpkg/status'), '')
    const rootArg = '--root=' + isolatedRoot
    const logFile = path.join(isolatedRoot, 'dpkg-operations.log')
    const logArg = '--log=' + logFile
    // fakeroot and --root prevent any system package install; --force-depends
    // intentionally bypasses dependencies (not runtime dependency acceptance).
    run('fakeroot', ['--', 'dpkg', rootArg, logArg, '--force-depends', '--install', packageFile],
      { timeout: 60000 })
    const status = run('dpkg', [rootArg, '--status', 'scriptor'])
    assert(/^Status: install ok installed$/m.test(status), 'Package manager did not record installed status')
    assert(status.split('\n').includes('Version: ' + version), 'Package-manager version mismatch')
    assert(status.split('\n').includes('Architecture: ' + archToDeb[architecture]),
      'Package manager reports incorrect architecture')
    const desktop = installedFile(isolatedRoot, 'usr/bin/scriptor-desktop')
    const daemon = installedFile(isolatedRoot, 'usr/lib/Scriptor/binaries/scriptor-daemon')
    const receipt = installedFile(isolatedRoot, 'usr/lib/Scriptor/binaries/scriptor-daemon.staging-receipt.json')
    assertElf(desktop.file, architecture)
    assertElf(daemon.file, architecture)
    const receiptData = JSON.parse(fs.readFileSync(receipt.file, 'utf8'))
    assert(receiptData.artifact === 'scriptor-daemon' && receiptData.source === 'local-build'
      && receiptData.checkoutVersion === version && receiptData.bytes === daemon.bytes
      && typeof receiptData.sha256 === 'string' && receiptData.sha256 === daemon.sha256,
    'Packaged installed daemon staging receipt SHA256/version/size mismatch')
    const daemonOutput = run(daemon.file, ['--version'], {
      timeout: 10000, maxBuffer: 4096,
      env: { ...process.env, HOME: isolatedRoot, XDG_CONFIG_HOME: isolatedRoot, XDG_DATA_HOME: isolatedRoot },
    })
    assert(daemonOutput === 'scriptor-daemon ' + version, 'Installed daemon version output mismatch')
    run('fakeroot', ['--', 'dpkg', rootArg, logArg, '--remove', 'scriptor'], { timeout: 60000 })
    assert(fs.statSync(logFile).size > 0, 'Confined package-manager log was not created')
    assert(!fs.existsSync(desktop.file) && !fs.existsSync(daemon.file) && !fs.existsSync(receipt.file),
      'Uninstall left installed executables or receipt behind')
    return {
      schemaVersion: 1, scope: 'isolated-dpkg-install-remove-only',
      sourceCommit, version, platform: 'linux', architecture,
      package: { name: packageName, bytes: packageStat.size, sha256: hashFile(packageFile) },
      installedDesktop: { path: 'usr/bin/scriptor-desktop', bytes: desktop.bytes, sha256: desktop.sha256 },
      installedDaemon: { path: 'usr/lib/Scriptor/binaries/scriptor-daemon', bytes: daemon.bytes, sha256: daemon.sha256 },
      stagingReceiptSha256: receipt.sha256, daemonOutput,
      acceptance: {
        isolatedPackageManagerInstall: true, uninstallFilesRemoved: true, packageManagerLogConfined: true,
        hostSystemInstalled: false, desktopProcessLaunched: false, runtimeDependenciesChecked: false,
        upgradeMigrationVerified: false, releaseAuthorized: false,
      },
    }
  } finally { fs.rmSync(isolatedRoot, { recursive: true, force: true }) }
}
export function writeInstalledDebEvidence(output, report) {
  const file = path.resolve(output)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n',
    { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  return file
}
function main() {
  const argv = process.argv.slice(2)
  const opts = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]
    assert(['--assets', '--source-sha', '--architecture', '--output'].includes(key)
      && argv[i + 1] && !Object.hasOwn(opts, key), 'Unexpected or repeated argument: ' + key)
    opts[key] = argv[i + 1]
  }
  assert(opts['--assets'] && opts['--source-sha'] && opts['--architecture'] && opts['--output'],
    'Usage: linux-deb-install-fixture.mjs --assets dir --source-sha sha --architecture arch --output file')
  const report = inspectInstalledDebFixture({
    root: path.resolve(import.meta.dirname, '../..'), directory: opts['--assets'],
    expectedCommit: opts['--source-sha'], architecture: opts['--architecture'],
  })
  writeInstalledDebEvidence(opts['--output'], report)
  process.stdout.write('Verified isolated dpkg install/remove and daemon; no host install/GUI/upgrade acceptance.\n')
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main() } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
}
