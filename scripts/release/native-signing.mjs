import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

import { normalizeReleasePlatform } from './signing-policy.mjs'

function listFiles(directory) {
  if (!fs.existsSync(directory)) return []
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(absolute))
    else if (entry.isFile()) files.push(absolute)
  }
  return files
}

function defaultExecute(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? result.error?.message ?? '',
  }
}

function requireSuccess(execute, command, args, label) {
  const result = execute(command, args)
  if (result?.status !== 0) {
    const detail = String(result?.stderr || result?.stdout || '').trim()
    throw new Error(`${label} failed${detail ? `: ${detail}` : ''}`)
  }
}

function exactlyOne(files, description) {
  if (files.length !== 1) {
    throw new Error(`missing ${description}: expected exactly one, found ${files.length}`)
  }
  return files[0]
}

function exactlyOneDirectory(directory, suffix, description) {
  if (!fs.existsSync(directory)) {
    throw new Error(`missing ${description}: directory does not exist: ${directory}`)
  }
  const matches = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(suffix))
    .map((entry) => path.join(directory, entry.name))
  return exactlyOne(matches, description)
}

export function verifyNativeSigning({ platform, bundleRoot, execute = defaultExecute }) {
  const normalizedPlatform = normalizeReleasePlatform(platform)
  const root = path.resolve(bundleRoot)

  if (normalizedPlatform === 'linux') {
    return {
      signed: false,
      notarized: false,
      signatureType: 'none',
      verifier: 'unsigned Linux package; verify SHA-256 and GitHub provenance/SBOM attestations',
    }
  }

  if (normalizedPlatform === 'windows') {
    const msi = exactlyOne(
      listFiles(path.join(root, 'msi')).filter((file) => file.toLowerCase().endsWith('.msi')),
      'Windows installer (.msi)',
    )
    const exe = exactlyOne(
      listFiles(path.join(root, 'nsis')).filter((file) => file.toLowerCase().endsWith('.exe')),
      'Windows installer (.exe)',
    )
    for (const installer of [msi, exe]) {
      requireSuccess(execute, 'signtool', ['verify', '/pa', '/all', '/v', installer], `Authenticode verification for ${path.basename(installer)}`)
    }
    return {
      signed: true,
      notarized: false,
      signatureType: 'authenticode',
      verifier: 'signtool verify /pa /all for staged MSI and NSIS installers',
    }
  }

  const app = exactlyOneDirectory(path.join(root, 'macos'), '.app', 'macOS application bundle (.app)')
  const dmg = exactlyOne(
    listFiles(path.join(root, 'dmg')).filter((file) => file.toLowerCase().endsWith('.dmg')),
    'macOS disk image (.dmg)',
  )
  requireSuccess(execute, 'codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], 'Developer ID signature verification')
  requireSuccess(execute, 'spctl', ['--assess', '--type', 'execute', '--verbose=4', app], 'Gatekeeper assessment')
  requireSuccess(execute, 'xcrun', ['stapler', 'validate', dmg], 'notarization ticket validation')
  return {
    signed: true,
    notarized: true,
    signatureType: 'developer-id',
    verifier: 'codesign --verify + spctl --assess + xcrun stapler validate',
  }
}
