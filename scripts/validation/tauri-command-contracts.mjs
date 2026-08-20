#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const bridgeRoot = path.join(root, 'src/bridge')
const libPath = path.join(root, 'apps/desktop/src-tauri/src/lib.rs')
const failures = []

function walk(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walk(absolute))
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(absolute)
  }
  return files
}

const lib = fs.readFileSync(libPath, 'utf8')
const handler = lib.match(/generate_handler!\s*\[([\s\S]*?)\]\s*\)/)
if (!handler) throw new Error('apps/desktop/src-tauri/src/lib.rs has no tauri::generate_handler! list')
const registered = new Set(
  handler[1]
    .replace(/\/\/.*$/gm, '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split('::').at(-1))
    .filter((entry) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(entry)),
)

const invokePattern = /\b(?:invoke|nativeInvoke)(?:<[^;\n(]+>)?\(\s*['"]([^'"]+)['"]/g
const invoked = new Map()
for (const file of walk(bridgeRoot)) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(invokePattern)) {
    const command = match[1]
    const relative = path.relative(root, file).replaceAll(path.sep, '/')
    if (!invoked.has(command)) invoked.set(command, [])
    invoked.get(command).push(relative)
  }
}

for (const [command, files] of invoked) {
  if (!registered.has(command)) {
    failures.push(`frontend bridge invokes unregistered Tauri command ${command} (${[...new Set(files)].join(', ')})`)
  }
}

if (failures.length) {
  console.error('Tauri command contract validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Tauri command contracts OK: ${invoked.size} bridged commands resolve to ${registered.size} registered native handlers.`)
