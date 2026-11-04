#!/usr/bin/env node
/** Fail-closed, source-bound inventory for preview-only installers and unsigned trust records. */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const targets = [['windows', 'x86_64'], ['macos', 'aarch64'], ['linux', 'x86_64'], ['linux', 'aarch64']]
const requireThat = (ok, reason) => { if (!ok) throw new Error(reason) }

function expectedAssets(version) {
  const stem = 'scriptor-' + version + '-'
  return [
    stem + 'windows-x86_64.msi', stem + 'windows-x86_64-setup.exe',
    stem + 'macos-aarch64.dmg', stem + 'linux-x86_64.deb',
    stem + 'linux-x86_64.AppImage', stem + 'linux-aarch64.deb',
    stem + 'linux-aarch64.AppImage',
  ]
}

function sha256OfFile(file) {
  const digest = crypto.createHash('sha256')
  const chunk = Buffer.allocUnsafe(1024 * 1024)
  const fd = fs.openSync(file, 'r')
  try {
    let n
    while ((n = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) digest.update(chunk.subarray(0, n))
  } finally { fs.closeSync(fd) }
  return digest.digest('hex')
}

/** This checks bytes, identities, cardinality and truth claims; it does not run installed apps. */
export function auditPreviewInventory({ directory, version, sourceCommit }) {
  requireThat(typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version),
    'Invalid canonical release version')
  requireThat(typeof sourceCommit === 'string' && /^[0-9a-f]{40}$/i.test(sourceCommit),
    'Exact source commit SHA required')
  const root = path.resolve(directory)
  const expectedInstallers = expectedAssets(version)
  const expectedTrust = targets.map(([p, a]) => 'signing-evidence-' + p + '-' + a + '.json')
  const expectedNames = [...expectedInstallers, ...expectedTrust]
  const found = fs.readdirSync(root, { withFileTypes: true })
  requireThat(found.length === 11,
    'Preview artifact cardinality mismatch: expected 7 installers + 4 trust records, got ' + found.length)
  for (const entry of found) {
    requireThat(expectedNames.includes(entry.name), 'Unexpected release preview artifact: ' + entry.name)
    requireThat(entry.isFile() && !entry.isSymbolicLink(),
      'Preview artifact must be a regular non-symlink file: ' + entry.name)
  }

  function recordFor(name) {
    requireThat(found.some(item => item.name === name), 'Missing expected release preview artifact: ' + name)
    const file = path.join(root, name)
    const bytes = fs.statSync(file).size
    requireThat(bytes > 0, 'Empty release preview installer or trust record: ' + name)
    return { name, bytes, sha256: sha256OfFile(file) }
  }

  const installers = expectedInstallers.map(recordFor)
  const trustRecords = expectedTrust.map((name, i) => {
    const file = recordFor(name)
    const parsed = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))
    const [platform, architecture] = targets[i]
    requireThat(parsed.schemaVersion === 2 && parsed.platform === platform && parsed.architecture === architecture,
      'Invalid release preview target trust identity: ' + name)
    requireThat(parsed.sourceCommit === sourceCommit, 'Release preview trust source commit mismatch: ' + name)
    requireThat(parsed.channel === 'preview' && parsed.signed === false && parsed.notarized === false
      && parsed.signatureType === 'none', 'Release preview must carry truthful unsigned trust records: ' + name)
    requireThat(typeof parsed.verifier === 'string' && parsed.verifier.trim().length > 0,
      'Missing release preview trust verifier: ' + name)
    return { ...file, platform, architecture, signed: false, notarized: false, signatureType: 'none' }
  })
  return {
    schemaVersion: 1, scope: 'nonpublishing-preview-only', sourceCommit, version,
    installers, trustRecords, releasePublished: false,
    installedRuntimeVerified: false, attestationsVerified: false,
  }
}

function parseArgs(argv) {
  const opts = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]
    if (!['--assets', '--version', '--source-sha', '--output'].includes(key)
      || !argv[i + 1] || Object.hasOwn(opts, key)) throw new Error('Unexpected preview inventory argument: ' + key)
    opts[key] = argv[i + 1]
  }
  requireThat(opts['--assets'] && opts['--version'] && opts['--source-sha'] && opts['--output'],
    'Usage: preview-inventory.mjs --assets directory --version semver --source-sha commit --output filename')
  return opts
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const root = path.resolve(import.meta.dirname, '../..')
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  requireThat(head === opts['--source-sha'], 'Preview source commit does not match checked-out exact Git HEAD')
  const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim()
  requireThat(version === opts['--version'], 'Preview release version differs from canonical VERSION')
  const report = auditPreviewInventory({
    directory: opts['--assets'], version, sourceCommit: head,
  })
  const output = path.resolve(opts['--output'])
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
  process.stdout.write('Verified exactly seven preview installers and four unsigned trust records; no release or runtime acceptance.\n')
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main() } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
