#!/usr/bin/env node
/** Non-publishing, source-bound smoke of real Linux DEB payload; not desktop GUI acceptance. */
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const requireThat = (condition, message) => { if (!condition) throw new Error(message) }
const machines = { x86_64: 62, aarch64: 183 }
const debArches = { x86_64: 'amd64', aarch64: 'arm64' }
const hostArch = process.arch === 'x64' ? 'x86_64' : process.arch === 'arm64' ? 'aarch64' : null
const hex40 = /^[0-9a-f]{40}$/i
const hex64 = /^[0-9a-f]{64}$/i

function sha256File(file) {
  const digest = crypto.createHash('sha256')
  const chunk = Buffer.allocUnsafe(1024 * 1024)
  const fd = fs.openSync(file, 'r')
  try {
    let bytes
    while ((bytes = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) {
      digest.update(chunk.subarray(0, bytes))
    }
  } finally { fs.closeSync(fd) }
  return digest.digest('hex')
}

function regularFileWithin(root, relative) {
  const abs = path.join(root, relative)
  const stat = fs.lstatSync(abs)
  requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0,
    'Missing, empty, or non-regular packaged executable/receipt: ' + relative)
  requireThat(fs.realpathSync(abs).startsWith(fs.realpathSync(root) + path.sep),
    'Packaged artifact escapes the extraction root: ' + relative)
  return { abs, stat }
}

function checkElf(file, architecture) {
  const fd = fs.openSync(file, 'r')
  const header = Buffer.alloc(20)
  try { requireThat(fs.readSync(fd, header, 0, 20, 0) === 20, 'Truncated native ELF header') }
  finally { fs.closeSync(fd) }
  requireThat(header.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70]))
    && header[4] === 2 && header[5] === 1, 'Packaged executable is not ELF64 little-endian')
  requireThat(header.readUInt16LE(18) === machines[architecture],
    'Packaged executable architecture does not match target ' + architecture)
}

export function verifyPackagedDeb({ root, directory, expectedCommit, architecture }) {
  requireThat(process.platform === 'linux', 'Linux DEB native smoke requires a Linux runner')
  requireThat(architecture && Object.hasOwn(machines, architecture) && architecture === hostArch,
    'DEB smoke target architecture must match the actual runner host')
  requireThat(typeof expectedCommit === 'string' && hex40.test(expectedCommit),
    'Expected an exact 40-character source commit SHA')
  const sourceRoot = fs.realpathSync(root)
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim()
  requireThat(sourceCommit.toLowerCase() === expectedCommit.toLowerCase(), 'Exact source commit mismatch')
  const version = fs.readFileSync(path.join(sourceRoot, 'VERSION'), 'utf8').trim()
  const committedVersion = execFileSync('git', ['show', 'HEAD:VERSION'], { cwd: sourceRoot, encoding: 'utf8' }).trim()
  requireThat(version === committedVersion, 'Canonical VERSION differs from committed source VERSION')
  requireThat(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version), 'Invalid canonical VERSION')
  const stagedRoot = fs.realpathSync(directory)
  const packageName = 'scriptor-' + version + '-linux-' + architecture + '.deb'
  const debFile = path.join(stagedRoot, packageName)
  const stat = fs.lstatSync(debFile)
  requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0, 'Missing or symlinked expected DEB')
  const packageIdentity = field => execFileSync('dpkg-deb', ['--field', debFile, field], {
    encoding: 'utf8', timeout: 15000,
  }).trim()
  requireThat(packageIdentity('Package') === 'scriptor', 'Unexpected Debian package name')
  requireThat(packageIdentity('Version') === version, 'Debian version differs from checkout VERSION')
  requireThat(packageIdentity('Architecture') === debArches[architecture], 'Debian architecture mismatch')
  const extractRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-deb-payload-'))
  try {
    execFileSync('dpkg-deb', ['--extract', debFile, extractRoot], { timeout: 120000, maxBuffer: 1024 * 1024 })
    const desktop = regularFileWithin(extractRoot, 'usr/bin/scriptor-desktop')
    const daemon = regularFileWithin(extractRoot, 'usr/lib/Scriptor/binaries/scriptor-daemon')
    const receiptPath = regularFileWithin(extractRoot,
      'usr/lib/Scriptor/binaries/scriptor-daemon.staging-receipt.json')
    checkElf(desktop.abs, architecture)
    checkElf(daemon.abs, architecture)
    const receipt = JSON.parse(fs.readFileSync(receiptPath.abs, 'utf8'))
    const daemonDigest = sha256File(daemon.abs)
    requireThat(receipt.artifact === 'scriptor-daemon' && receipt.source === 'local-build'
      && receipt.checkoutVersion === version && receipt.bytes === daemon.stat.size
      && typeof receipt.sha256 === 'string' && hex64.test(receipt.sha256)
      && receipt.sha256 === daemonDigest, 'Packaged daemon staging receipt SHA256/size/version mismatch')
    const execution = spawnSync(daemon.abs, ['--version'], {
      encoding: 'utf8', timeout: 10000, maxBuffer: 4096, windowsHide: true,
      env: { ...process.env, HOME: extractRoot, XDG_CONFIG_HOME: extractRoot, XDG_DATA_HOME: extractRoot },
    })
    requireThat(!execution.error && execution.status === 0,
      'Packaged daemon native --version failed: ' + String(execution.error?.message || execution.stderr).slice(0, 180))
    const reported = String(execution.stdout ?? '').trim()
    requireThat(reported === 'scriptor-daemon ' + version, 'Packaged daemon version mismatch: ' + reported.slice(0, 180))
    return {
      schemaVersion: 1, scope: 'deb-packaged-daemon-smoke-only',
      sourceCommit, version, platform: 'linux', architecture,
      runner: { os: process.platform, arch: process.arch, node: process.version },
      package: { name: packageName, bytes: stat.size, sha256: sha256File(debFile) },
      desktop: { path: 'usr/bin/scriptor-desktop', bytes: desktop.stat.size, sha256: sha256File(desktop.abs) },
      daemon: { path: 'usr/lib/Scriptor/binaries/scriptor-daemon', bytes: daemon.stat.size, sha256: daemonDigest },
      sidecarReceiptSha256: sha256File(receiptPath.abs),
      daemonVersionOutput: reported,
      acceptance: {
        daemonExecutableProbed: true, desktopExecutableLaunched: false,
        installedDesktopVerified: false, upgradeRollbackVerified: false,
        signatureVerified: false, releaseAuthorized: false,
      },
    }
  } finally { fs.rmSync(extractRoot, { recursive: true, force: true }) }
}

export function writePackagedDebReceipt(output, report) {
  const target = path.resolve(output)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  return target
}

function cli() {
  const argv = process.argv.slice(2)
  const options = {}
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]
    requireThat(['--assets', '--source-sha', '--architecture', '--output'].includes(name)
      && argv[i + 1] && !Object.hasOwn(options, name), 'Unrecognized or duplicate smoke argument: ' + name)
    options[name] = argv[i + 1]
  }
  requireThat(options['--assets'] && options['--source-sha'] && options['--architecture'] && options['--output'],
    'Usage: linux-deb-smoke.mjs --assets release-output --source-sha <exact-sha> --architecture <arch> --output <json>')
  const report = verifyPackagedDeb({
    root: path.resolve(import.meta.dirname, '../..'), directory: options['--assets'],
    expectedCommit: options['--source-sha'], architecture: options['--architecture'],
  })
  const target = writePackagedDebReceipt(options['--output'], report)
  process.stdout.write('Verified packaged Linux ' + report.architecture
    + ' daemon native runtime and payload hashes: ' + target + '; desktop GUI not launched.\n')
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { cli() } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
}
