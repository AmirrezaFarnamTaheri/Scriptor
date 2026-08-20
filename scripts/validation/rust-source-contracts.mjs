#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const ignoredDirectories = new Set(['.git', 'target', 'node_modules', 'dist', 'build'])
const rustFiles = []

function walk(directory) {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute)
    else if (entry.name.endsWith('.rs')) rustFiles.push(absolute)
  }
}

for (const directory of ['crates', 'apps']) walk(path.join(root, directory))

const failures = []
const relative = (file) => path.relative(root, file).replaceAll(path.sep, '/')
const processInventoryPath = path.join(root, 'scripts/validation/process-launch-inventory.json')
const processInventory = JSON.parse(fs.readFileSync(processInventoryPath, 'utf8'))
if (processInventory.schemaVersion !== 1 || !Array.isArray(processInventory.entries)) {
  throw new Error('process-launch-inventory.json must use schemaVersion 1 with an entries array')
}
const processEntries = new Map()
for (const entry of processInventory.entries) {
  if (!entry || typeof entry.id !== 'string' || !/^[a-z0-9-]+$/.test(entry.id)) {
    failures.push(`invalid process launch inventory id: ${entry?.id ?? '<missing>'}`)
    continue
  }
  if (processEntries.has(entry.id)) {
    failures.push(`duplicate process launch inventory entry: ${entry.id}`)
    continue
  }
  processEntries.set(entry.id, entry)
}
const usedProcessEntries = new Set()

function stripRustLiteralsAndComments(source) {
  let output = ''
  let index = 0
  let blockDepth = 0
  let mode = 'code'
  let rawHashes = 0
  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]
    if (mode === 'line-comment') {
      if (char === '\n') {
        mode = 'code'
        output += '\n'
      } else output += ' '
      index += 1
      continue
    }
    if (mode === 'block-comment') {
      if (char === '/' && next === '*') {
        blockDepth += 1
        output += '  '
        index += 2
      } else if (char === '*' && next === '/') {
        blockDepth -= 1
        output += '  '
        index += 2
        if (blockDepth === 0) mode = 'code'
      } else {
        output += char === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }
    if (mode === 'string' || mode === 'char') {
      if (char === '\\') {
        output += '  '
        index += 2
      } else if ((mode === 'string' && char === '"') || (mode === 'char' && char === "'")) {
        output += ' '
        index += 1
        mode = 'code'
      } else {
        output += char === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }
    if (mode === 'raw-string') {
      if (char === '"' && source.slice(index + 1, index + 1 + rawHashes) === '#'.repeat(rawHashes)) {
        output += ' '.repeat(rawHashes + 1)
        index += rawHashes + 1
        mode = 'code'
      } else {
        output += char === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }
    if (char === '/' && next === '/') {
      mode = 'line-comment'
      output += '  '
      index += 2
      continue
    }
    if (char === '/' && next === '*') {
      mode = 'block-comment'
      blockDepth = 1
      output += '  '
      index += 2
      continue
    }
    if (char === 'r') {
      const raw = source.slice(index).match(/^r(#+)?"/)
      if (raw) {
        rawHashes = (raw[1] ?? '').length
        mode = 'raw-string'
        output += ' '.repeat(raw[0].length)
        index += raw[0].length
        continue
      }
    }
    if (char === '"') mode = 'string'
    else if (char === "'" && /^'(?:\\.|[^'\\])'/.test(source.slice(index))) mode = 'char'
    output += mode === 'code' ? char : ' '
    index += 1
  }
  return output
}

function checkDelimiters(file, source) {
  const sanitized = stripRustLiteralsAndComments(source)
  const stack = []
  const opening = new Set(['(', '[', '{'])
  const expected = new Map([[')', '('], [']', '['], ['}', '{']])
  let line = 1
  for (const char of sanitized) {
    if (char === '\n') line += 1
    else if (opening.has(char)) stack.push({ char, line })
    else if (expected.has(char)) {
      const top = stack.pop()
      if (!top || top.char !== expected.get(char)) {
        failures.push(`${relative(file)}:${line}: mismatched delimiter ${char}`)
        return
      }
    }
  }
  if (stack.length) {
    const top = stack.at(-1)
    failures.push(`${relative(file)}:${top.line}: unclosed delimiter ${top.char}`)
  }
}

function checkInnerDocs(file, source) {
  let seenItem = false
  for (const [offset, line] of source.split('\n').entries()) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#!') || trimmed.startsWith('//') && !trimmed.startsWith('//!')) continue
    if (trimmed.startsWith('//!') && seenItem) {
      failures.push(`${relative(file)}:${offset + 1}: inner doc comment appears after an item`)
    } else if (!trimmed.startsWith('//!')) {
      seenItem = true
    }
  }
}

function moduleDirectory(file) {
  const basename = path.basename(file, '.rs')
  return ['lib', 'main', 'mod'].includes(basename)
    ? path.dirname(file)
    : path.join(path.dirname(file), basename)
}

function checkModules(file, source) {
  const sanitized = stripRustLiteralsAndComments(source)
  for (const match of sanitized.matchAll(/(?:^|\n)\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)) {
    const name = match[1]
    const base = moduleDirectory(file)
    const candidates = [path.join(base, `${name}.rs`), path.join(base, name, 'mod.rs')]
    if (!candidates.some(fs.existsSync)) {
      const line = sanitized.slice(0, match.index).split('\n').length
      failures.push(`${relative(file)}:${line}: module ${name} has no ${relative(candidates[0])} or ${relative(candidates[1])}`)
    }
  }
}

const processBrokerAllowlist = [
  /^crates\/system-bridge\/src\/process\.rs$/,
  /^crates\/native-git\//,
  /^crates\/xtask\//,
  /\/tests\//,
]

function checkProcessBoundary(file, source) {
  const fileName = relative(file)
  const launches = [...source.matchAll(/(?:std::process::|tokio::process::)?Command::new\s*\(/g)]
  if (launches.length === 0 || processBrokerAllowlist.some((pattern) => pattern.test(fileName))) return
  if (source.includes('PROCESS_BROKER_EXCEPTION:')) {
    failures.push(`${fileName}: blanket PROCESS_BROKER_EXCEPTION markers are forbidden`)
  }
  const lines = source.split('\n')
  for (const launch of launches) {
    const line = source.slice(0, launch.index).split('\n').length
    const context = lines.slice(Math.max(0, line - 4), line).join('\n')
    const marker = context.match(/PROCESS_BROKER_EXCEPTION\(([a-z0-9-]+)\)/)
    if (!marker) {
      failures.push(`${fileName}:${line}: direct process launch lacks a per-launch PROCESS_BROKER_EXCEPTION(id) marker`)
      continue
    }
    const id = marker[1]
    const entry = processEntries.get(id)
    if (!entry) {
      failures.push(`${fileName}:${line}: process exception ${id} is missing from process-launch-inventory.json`)
      continue
    }
    if (entry.file !== fileName) {
      failures.push(`${fileName}:${line}: process exception ${id} belongs to ${entry.file}`)
      continue
    }
    for (const field of ['owner', 'executableSource', 'argumentPolicy', 'timeoutCancellation', 'outputBounds', 'reviewExpires']) {
      if (typeof entry[field] !== 'string' || entry[field].trim() === '') {
        failures.push(`${fileName}:${line}: process exception ${id} is missing ${field}`)
      }
    }
    if (entry.reviewExpires !== 'test-only') {
      const expires = /^\d{4}-\d{2}-\d{2}$/.test(entry.reviewExpires ?? '')
        ? Date.parse(`${entry.reviewExpires}T23:59:59Z`)
        : Number.NaN
      if (!Number.isFinite(expires)) failures.push(`${fileName}:${line}: process exception ${id} has invalid reviewExpires`)
      else if (expires < Date.now()) failures.push(`${fileName}:${line}: process exception ${id} review expired on ${entry.reviewExpires}`)
    }
    if (!Array.isArray(entry.negativeTests) || entry.negativeTests.length === 0 || entry.negativeTests.some((value) => typeof value !== 'string' || value.trim() === '')) {
      failures.push(`${fileName}:${line}: process exception ${id} has no valid negativeTests`)
    }
    if (usedProcessEntries.has(id)) failures.push(`${fileName}:${line}: process exception ${id} is reused`)
    usedProcessEntries.add(id)
  }
}

function checkUnsafeDocumentation(file, source) {
  const fileName = relative(file)
  const lines = source.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    if (!/\bunsafe\s*\{/.test(lines[index])) continue
    const context = lines.slice(Math.max(0, index - 4), index).join('\n')
    if (!context.includes('SAFETY:')) {
      failures.push(`${fileName}:${index + 1}: unsafe block requires a nearby SAFETY comment`)
    }
  }
}

for (const file of rustFiles) {
  const source = fs.readFileSync(file, 'utf8')
  checkDelimiters(file, source)
  checkInnerDocs(file, source)
  checkModules(file, source)
  checkProcessBoundary(file, source)
  checkUnsafeDocumentation(file, source)
}

for (const id of processEntries.keys()) {
  if (!usedProcessEntries.has(id)) failures.push(`unused process launch inventory entry: ${id}`)
}

{
  const search = fs.readFileSync(path.join(root, 'crates/indexer/src/search.rs'), 'utf8')
  const dql = fs.readFileSync(path.join(root, 'crates/indexer/src/dql.rs'), 'utf8')
  for (const [name, source] of [['search.rs', search], ['dql.rs', dql]]) {
    if (!source.includes("snippet(note_fts, 4, '[[', ']]', '...', 32)")) {
      failures.push(`crates/indexer/src/${name}: FTS snippets must read the body column (index 4)`)
    }
    if (!source.includes('bm25(note_fts, 0.0, 10.0, 5.0, 3.0, 1.0)')) {
      failures.push(`crates/indexer/src/${name}: BM25 weights must include the UNINDEXED note_id column`)
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Rust source contracts OK: ${rustFiles.length} files, balanced syntax, resolvable modules, governed process launches, and documented unsafe blocks.`)
