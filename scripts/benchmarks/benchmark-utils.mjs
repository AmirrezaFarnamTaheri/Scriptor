import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export function parseBenchmarkReport(name, output) {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')
  if (start < 0 || end < start) {
    throw new Error(`could not find JSON benchmark report for ${name}`)
  }

  let report
  try {
    report = JSON.parse(output.slice(start, end + 1))
  } catch (error) {
    throw new Error(
      `could not parse benchmark report for ${name}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
  if (typeof report !== 'object' || report === null || Array.isArray(report)) {
    throw new Error(`benchmark report for ${name} must be an object`)
  }
  if (typeof report.mean_ms !== 'number' || !Number.isFinite(report.mean_ms)) {
    throw new Error(`benchmark report for ${name} has no finite mean_ms`)
  }
  return report
}

export function hashDirectory(root) {
  const absoluteRoot = path.resolve(root)
  const files = []

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) walk(absolute)
      else if (entry.isFile()) files.push(path.relative(absoluteRoot, absolute).replaceAll('\\', '/'))
    }
  }

  walk(absoluteRoot)
  files.sort((a, b) => a.localeCompare(b))
  const tree = crypto.createHash('sha256')
  for (const relative of files) {
    const contents = fs.readFileSync(path.join(absoluteRoot, relative))
    tree.update(relative)
    tree.update('\0')
    tree.update(String(contents.length))
    tree.update('\0')
    tree.update(crypto.createHash('sha256').update(contents).digest('hex'))
    tree.update('\0')
  }
  return { sha256: tree.digest('hex'), fileCount: files.length }
}
