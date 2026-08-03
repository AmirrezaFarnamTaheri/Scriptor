import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export function normalizedRelative(root, absolute) {
  return path.relative(root, absolute).replaceAll('\\', '/')
}

export function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

export function isSafeSubjectPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\\')) return false
  if (path.posix.isAbsolute(value)) return false
  const normalized = path.posix.normalize(value)
  return normalized === value && normalized !== '..' && !normalized.startsWith('../')
}

export function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file))
}

export function collectSubjectFiles(subjectDir, { excludedDirectory } = {}) {
  const root = path.resolve(subjectDir)
  const excluded = excludedDirectory ? path.resolve(excludedDirectory) : null
  const files = []

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name)
      if (excluded && (absolute === excluded || isPathInside(excluded, absolute))) continue
      if (entry.isDirectory()) {
        walk(absolute)
      } else if (entry.isFile()) {
        const relative = normalizedRelative(root, absolute)
        if (!isSafeSubjectPath(relative)) throw new Error(`unsafe release subject path: ${relative}`)
        const contents = fs.readFileSync(absolute)
        files.push({ path: relative, bytes: contents.length, sha256: sha256Buffer(contents) })
      } else if (entry.isSymbolicLink()) {
        throw new Error(`release subjects may not contain symbolic links: ${normalizedRelative(root, absolute)}`)
      }
    }
  }

  walk(root)
  files.sort((a, b) => a.path.localeCompare(b.path))
  return files
}

export function parseSha256Sums(contents) {
  const entries = new Map()
  const text = contents.trim()
  if (!text) return entries

  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const match = line.match(/^([a-f0-9]{64}) {2}(.+)$/)
    if (!match) throw new Error(`invalid SHA256SUMS line ${index + 1}`)
    const [, hash, relative] = match
    if (!isSafeSubjectPath(relative)) throw new Error(`unsafe SHA256SUMS path: ${relative}`)
    if (entries.has(relative)) throw new Error(`duplicate SHA256SUMS path: ${relative}`)
    entries.set(relative, hash)
  }
  return entries
}

export function assertExactSubjectSet(expectedItems, actualItems) {
  const expected = new Map()
  for (const item of expectedItems) {
    if (!item || !isSafeSubjectPath(item.path)) throw new Error(`unsafe receipt subject path: ${item?.path ?? '<missing>'}`)
    if (!Number.isSafeInteger(item.bytes) || item.bytes < 0) throw new Error(`invalid receipt subject size: ${item.path}`)
    if (!/^[a-f0-9]{64}$/.test(item.sha256 ?? '')) throw new Error(`invalid receipt subject hash: ${item.path}`)
    if (expected.has(item.path)) throw new Error(`duplicate receipt subject path: ${item.path}`)
    expected.set(item.path, item)
  }

  const actual = new Map(actualItems.map((item) => [item.path, item]))
  const missing = [...expected.keys()].filter((relative) => !actual.has(relative))
  const extra = [...actual.keys()].filter((relative) => !expected.has(relative))
  if (missing.length || extra.length) {
    const details = [
      missing.length ? `missing: ${missing.join(', ')}` : null,
      extra.length ? `unreceipted: ${extra.join(', ')}` : null,
    ].filter(Boolean).join('; ')
    throw new Error(`release subject set does not match receipt (${details})`)
  }

  for (const [relative, expectedItem] of expected) {
    const actualItem = actual.get(relative)
    if (actualItem.bytes !== expectedItem.bytes || actualItem.sha256 !== expectedItem.sha256) {
      throw new Error(`receipt subject mismatch: ${relative}`)
    }
  }

  return expected
}
