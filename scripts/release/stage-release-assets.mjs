#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

import {
  normalizeReleaseArchitecture,
  normalizeReleasePlatform,
} from './signing-policy.mjs'
import { signingEvidenceFilename } from './signing-evidence.mjs'

const root = path.resolve(import.meta.dirname, '../..')

function readArgument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`missing value for --${name}`)
  return value
}

function listFiles(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(absolute))
    else if (entry.isFile()) files.push(absolute)
  }
  return files
}

const platform = normalizeReleasePlatform(readArgument('platform', process.env.SCRIPTOR_PLATFORM))
const architecture = normalizeReleaseArchitecture(
  readArgument('architecture', process.env.SCRIPTOR_ARCHITECTURE),
)
const bundleRoot = path.resolve(readArgument('bundle-root', path.join(root, 'target/release/bundle')))
const outputDir = path.resolve(readArgument('output-dir', path.join(root, 'release-output')))
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim()
const descriptors = {
  windows: [
    { directory: 'msi', extension: '.msi', suffix: '' },
    { directory: 'nsis', extension: '.exe', suffix: '-setup' },
  ],
  macos: [{ directory: 'dmg', extension: '.dmg', suffix: '' }],
  linux: [
    { directory: 'deb', extension: '.deb', suffix: '' },
    { directory: 'appimage', extension: '.AppImage', suffix: '' },
  ],
}[platform]

if (!fs.existsSync(bundleRoot)) throw new Error(`bundle root does not exist: ${bundleRoot}`)
fs.rmSync(outputDir, { recursive: true, force: true })
fs.mkdirSync(outputDir, { recursive: true })

const staged = []
for (const descriptor of descriptors) {
  const directory = path.join(bundleRoot, descriptor.directory)
  if (!fs.existsSync(directory)) throw new Error(`missing ${platform} bundle directory: ${directory}`)
  const candidates = listFiles(directory).filter((file) => file.endsWith(descriptor.extension))
  if (candidates.length !== 1) {
    throw new Error(
      `expected exactly one ${descriptor.extension} in ${directory}, found ${candidates.length}`,
    )
  }
  const outputName = `scriptor-${version}-${platform}-${architecture}${descriptor.suffix}${descriptor.extension}`
  const outputPath = path.join(outputDir, outputName)
  fs.copyFileSync(candidates[0], outputPath)
  staged.push(outputPath)
}

const evidenceName = signingEvidenceFilename(platform, architecture)
const evidencePath = path.join(bundleRoot, evidenceName)
if (!fs.existsSync(evidencePath)) throw new Error(`missing signing status evidence: ${evidencePath}`)
const stagedEvidence = path.join(outputDir, evidenceName)
fs.copyFileSync(evidencePath, stagedEvidence)
staged.push(stagedEvidence)

console.log(`Staged ${staged.length} release file(s) for ${platform}/${architecture}:`)
for (const file of staged) console.log(`- ${path.basename(file)}`)
