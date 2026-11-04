#!/usr/bin/env node
/** Non-publishing, source-bound CLI/daemon executable evidence. Not installed-desktop acceptance. */
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const requireThat = (condition, message) => { if (!condition) throw new Error(message) }
const platformNames = { win32: 'windows', darwin: 'macos', linux: 'linux' }
const archNames = { x64: 'x86_64', arm64: 'aarch64' }
const probeNames = ['cli-version', 'daemon-version', 'cli-system-info']
const probeArgs = [['--version'], ['--version'], ['system-info']]
const hex40 = /^[0-9a-f]{40}$/i
const hex64 = /^[0-9a-f]{64}$/i

function sourceIdentity({ root, expectedCommit, platform, architecture }) {
  requireThat(typeof expectedCommit === 'string' && hex40.test(expectedCommit), 'Exact source commit SHA required')
  const sourceRoot = fs.realpathSync(root)
  const actualCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim()
  requireThat(actualCommit.toLowerCase() === expectedCommit.toLowerCase(), 'Source commit mismatch: expected exact HEAD')
  const hostPlatform = platformNames[process.platform]
  const hostArchitecture = archNames[os.arch()]
  requireThat(hostPlatform && hostArchitecture && platform === hostPlatform && architecture === hostArchitecture,
    'Binary-review host platform or architecture mismatch')
  const version = fs.readFileSync(path.join(sourceRoot, 'VERSION'), 'utf8').trim()
  requireThat(/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version), 'Invalid canonical release VERSION')
  return { sourceRoot, actualCommit, version, hostPlatform, hostArchitecture }
}

function binaryReceipt(sourceRoot, name) {
  const relative = 'target/release/' + name
  const absolute = path.join(sourceRoot, 'target', 'release', name)
  const stat = fs.lstatSync(absolute)
  requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0, 'Invalid or missing native binary: ' + relative)
  requireThat(fs.realpathSync(absolute).startsWith(sourceRoot + path.sep), 'Binary path escapes source: ' + relative)
  const bytes = fs.readFileSync(absolute)
  return { name, path: relative, bytes: bytes.length, sha256: sha(bytes) }
}

function executableProbe(sourceRoot, name, args, id, version) {
  const started = process.hrtime.bigint()
  const result = spawnSync(path.join(sourceRoot, 'target', 'release', name), args, {
    timeout: 15000, maxBuffer: 1024 * 1024, encoding: 'utf8', windowsHide: true,
  })
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6
  requireThat(!result.error && result.status === 0,
    'Native ' + id + ' probe failed (exit ' + String(result.status) + '): ' + String(result.error?.message || result.stderr).slice(0, 200))
  const stdout = String(result.stdout ?? '').trim()
  requireThat(stdout.length > 0 && stdout.length <= 16384, 'Native ' + id + ' probe produced invalid output')
  if (id.endsWith('-version')) {
    const expected = (id === 'cli-version' ? 'scriptor' : 'scriptor-daemon') + ' ' + version
    requireThat(stdout === expected, 'Native ' + id + ' version mismatch: ' + stdout.slice(0, 100))
  }
  return {
    id, argv: args, exitCode: 0, elapsedMs, outputSha256: sha(Buffer.from(stdout, 'utf8')),
    ...(id.endsWith('-version') ? { output: stdout } : {}),
  }
}

export function collectBinaryReview(params) {
  const src = sourceIdentity(params)
  const suffix = src.hostPlatform === 'windows' ? '.exe' : ''
  const cli = 'scriptor' + suffix
  const daemon = 'scriptor-daemon' + suffix
  const binaries = [binaryReceipt(src.sourceRoot, cli), binaryReceipt(src.sourceRoot, daemon)]
  const probes = [
    executableProbe(src.sourceRoot, cli, probeArgs[0], probeNames[0], src.version),
    executableProbe(src.sourceRoot, daemon, probeArgs[1], probeNames[1], src.version),
    executableProbe(src.sourceRoot, cli, probeArgs[2], probeNames[2], src.version),
  ]
  return {
    schemaVersion: 2, scope: 'cli-daemon-smoke-only', sourceCommit: src.actualCommit,
    version: src.version, platform: src.hostPlatform, architecture: src.hostArchitecture,
    node: process.version, generatedAt: new Date().toISOString(), binaries, probes,
    acceptance: {
      executablesProbed: true, installedDesktopVerified: false, upgradeRollbackVerified: false,
      installerTrustVerified: false, publishAuthorized: false,
    },
  }
}

export function verifyBinaryReview({ root, expectedCommit, platform, architecture, manifest }) {
  requireThat(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'Missing binary review manifest')
  const src = sourceIdentity({ root, expectedCommit, platform, architecture })
  requireThat(manifest.schemaVersion === 2 && manifest.scope === 'cli-daemon-smoke-only', 'Invalid binary review schema/scope')
  requireThat(manifest.sourceCommit === src.actualCommit, 'Binary review source commit mismatch')
  requireThat(manifest.version === src.version, 'Binary review version mismatch')
  requireThat(manifest.platform === src.hostPlatform && manifest.architecture === src.hostArchitecture,
    'Binary review platform/architecture mismatch')
  requireThat(manifest.node === process.version, 'Binary review Node toolchain mismatch')
  requireThat(typeof manifest.generatedAt === 'string' && !Number.isNaN(Date.parse(manifest.generatedAt)),
    'Missing evidence timestamp')
  requireThat(Array.isArray(manifest.binaries) && manifest.binaries.length === 2,
    'Expected exactly two native review binaries')
  const suffix = src.hostPlatform === 'windows' ? '.exe' : ''
  const expected = ['scriptor' + suffix, 'scriptor-daemon' + suffix]
  for (let i = 0; i < expected.length; i++) {
    const observed = manifest.binaries[i]
    const actual = binaryReceipt(src.sourceRoot, expected[i])
    requireThat(observed?.name === actual.name && observed.path === actual.path,
      'Invalid or deceptive review binary path for ' + expected[i])
    requireThat(observed.bytes === actual.bytes && typeof observed.sha256 === 'string'
      && hex64.test(observed.sha256) && observed.sha256 === actual.sha256,
      'Binary review bytes/SHA256 hash mismatch for ' + expected[i])
  }
  requireThat(Array.isArray(manifest.probes) && manifest.probes.length === 3,
    'Expected exactly three native executable probes')
  for (let i = 0; i < 3; i++) {
    const observed = manifest.probes[i]
    requireThat(observed?.id === probeNames[i] && observed.exitCode === 0
      && JSON.stringify(observed.argv) === JSON.stringify(probeArgs[i])
      && Number.isFinite(observed.elapsedMs) && observed.elapsedMs >= 0
      && typeof observed.outputSha256 === 'string' && hex64.test(observed.outputSha256),
      'Invalid/native executable probe receipt for ' + probeNames[i])
    if (i < 2) {
      const expectedOutput = (i === 0 ? 'scriptor' : 'scriptor-daemon') + ' ' + src.version
      requireThat(observed.output === expectedOutput && observed.outputSha256 === sha(Buffer.from(expectedOutput)),
        'Binary review version probe mismatch for ' + probeNames[i])
    } else requireThat(!Object.hasOwn(observed, 'output'), 'System-info probe must not disclose host details')
  }
  const a = manifest.acceptance
  requireThat(a?.executablesProbed === true && a.installedDesktopVerified === false
    && a.upgradeRollbackVerified === false && a.installerTrustVerified === false
    && a.publishAuthorized === false, 'Binary review improperly claims installed or release acceptance')
  // Saved probe status is only a claim: execute the native binaries again.
  const live = collectBinaryReview({ root, expectedCommit, platform, architecture })
  for (let i = 0; i < 2; i++) {
    requireThat(live.probes[i].outputSha256 === manifest.probes[i].outputSha256,
      'Live version probe differs from saved receipt for ' + probeNames[i])
  }
  return { verifiedBinaries: 2, verifiedLiveProbes: 3, sourceCommit: src.actualCommit,
    scope: 'cli-daemon-smoke-only' }
}

export function writeBinaryReview(output, manifest) {
  const target = path.resolve(output)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  requireThat(!fs.existsSync(target), 'Refusing to overwrite existing binary review evidence')
  const temporary = target + '.' + process.pid + '.' + crypto.randomBytes(6).toString('hex') + '.tmp'
  try {
    const fd = fs.openSync(temporary, 'wx', 0o600)
    try {
      fs.writeFileSync(fd, JSON.stringify(manifest, null, 2) + '\n')
      fs.fsyncSync(fd)
    } finally { fs.closeSync(fd) }
    fs.linkSync(temporary, target)
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
  return target
}

function parseArguments(argv) {
  const values = {}
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]
    if (!['--root', '--source-sha', '--platform', '--architecture', '--output', '--input'].includes(name)
      || !argv[i + 1] || Object.hasOwn(values, name)) {
      throw new Error('Unknown, repeated or missing binary-review argument: ' + name)
    }
    values[name] = argv[i + 1]
  }
  requireThat(values['--source-sha'] && values['--platform'] && values['--architecture'],
    'Expected --source-sha, --platform and --architecture arguments')
  return values
}

function main() {
  const [command, ...rest] = process.argv.slice(2)
  const options = parseArguments(rest)
  const params = {
    root: options['--root'] || path.resolve(import.meta.dirname, '../..'),
    expectedCommit: options['--source-sha'],
    platform: options['--platform'],
    architecture: options['--architecture'],
  }
  if (command === 'collect') {
    requireThat(options['--output'] && !options['--input'], 'Collect requires --output only')
    const manifest = collectBinaryReview(params)
    const dest = writeBinaryReview(options['--output'], manifest)
    const checked = verifyBinaryReview({ ...params, manifest })
    process.stdout.write('Collected binary review: ' + dest + '; ' + checked.verifiedLiveProbes
      + ' live probes. Not installed desktop or release acceptance.\n')
  } else if (command === 'verify') {
    requireThat(options['--input'] && !options['--output'], 'Verify requires --input only')
    const manifest = JSON.parse(fs.readFileSync(path.resolve(options['--input']), 'utf8'))
    const result = verifyBinaryReview({ ...params, manifest })
    process.stdout.write(JSON.stringify(result) + '\n')
  } else throw new Error('Expected collect|verify command')
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main() } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
