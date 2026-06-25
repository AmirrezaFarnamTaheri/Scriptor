#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const bundleRoot = join(root, 'target/release/bundle')
const platform = process.argv[2] ?? process.env.SCRIPTOR_PLATFORM ?? 'unknown'

const expectedKinds = {
  windows: ['msi', 'nsis'],
  macos: ['dmg', 'macos'],
  linux: ['deb', 'appimage'],
}

function listFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isFile()) {
      files.push(path)
    } else if (entry.isDirectory()) {
      files.push(...listFiles(path))
    }
  }
  return files
}

if (!existsSync(bundleRoot)) {
  console.error(`Bundle root missing: ${bundleRoot}`)
  process.exit(1)
}

const files = listFiles(bundleRoot)
if (files.length === 0) {
  console.error(`No files found under ${bundleRoot}`)
  process.exit(1)
}

const kinds = expectedKinds[platform] ?? []
if (kinds.length > 0) {
  const matched = kinds.filter((kind) => existsSync(join(bundleRoot, kind)))
  if (matched.length === 0) {
    console.error(`Expected bundle kinds for ${platform}: ${kinds.join(', ')}`)
    console.error(`Found: ${readdirSync(bundleRoot).join(', ')}`)
    process.exit(1)
  }
}

console.log(`Bundle verification passed for ${platform} (${files.length} file(s))`)
for (const file of files) {
  console.log(`  ${file.replace(root + '/', '').replace(root + '\\', '')}`)
}
