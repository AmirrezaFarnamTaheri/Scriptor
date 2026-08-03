#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const cssFiles = []
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute)
    else if (entry.name.endsWith('.css')) cssFiles.push(absolute)
  }
}
walk(path.join(root, 'src'))
const declared = new Set()
const usages = []
for (const file of cssFiles) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(/(^|[;{]\s*)(--[A-Za-z0-9_-]+)\s*:/gm)) declared.add(match[2])
  for (const match of source.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)(\s*,[^)]*)?\)/g)) {
    usages.push({ file, name: match[1], hasFallback: Boolean(match[2]), index: match.index })
  }
}
const failures = []
for (const usage of usages) {
  if (declared.has(usage.name) || usage.hasFallback) continue
  const source = fs.readFileSync(usage.file, 'utf8')
  const line = source.slice(0, usage.index).split('\n').length
  failures.push(`${path.relative(root, usage.file).replaceAll('\\', '/')}:${line}: undefined CSS custom property ${usage.name}`)
}
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`CSS custom-property policy OK: ${cssFiles.length} file(s), ${declared.size} declarations, ${usages.length} uses.`)
