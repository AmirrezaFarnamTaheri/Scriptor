#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const TRANSIENT_DIRECTORIES = new Set([
  '.git',
  '.pnpm-store',
  'node_modules',
  'dist',
  'dist-ssr',
  'target',
  'artifacts',
  'ci-logs',
  'coverage',
  'test-results',
  'playwright-report',
  'blob-report',
])

function run(command, args, cwd) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return null
  }
}

function gitDiffStatus(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr.trim() || `Git command failed: git ${args.join(' ')}`)
  }
  return result.status
}

function gitSourceDirty(root) {
  const staged = gitDiffStatus(['diff', '--cached', '--quiet', '--ignore-submodules=none', '--'], root)
  const unstaged = gitDiffStatus(['diff', '--quiet', '--ignore-submodules=none', '--'], root)
  const untracked = runBuffer('git', ['ls-files', '-z', '--others', '--exclude-standard'], root)
  if (untracked === null) throw new Error('unable to enumerate untracked source files')
  return staged === 1 || unstaged === 1 || untracked.length > 0
}

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function normalizedRelative(root, absolute) {
  return path.relative(root, absolute).replaceAll('\\', '/')
}

function walkArchive(root, current = root, files = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory() && TRANSIENT_DIRECTORIES.has(entry.name)) continue
    const absolute = path.join(current, entry.name)
    if (entry.isDirectory()) walkArchive(root, absolute, files)
    else if (entry.isFile()) files.push(normalizedRelative(root, absolute))
  }
  return files
}

function runBuffer(command, args, cwd) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: null,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 128 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

function gitTreeEntries(root) {
  const raw = runBuffer('git', ['ls-tree', '-r', '-z', '--full-tree', 'HEAD'], root)
  if (raw === null) return null
  const entries = []
  for (const record of raw.toString('utf8').split('\0').filter(Boolean)) {
    const tab = record.indexOf('\t')
    if (tab < 0) throw new Error(`invalid Git tree record: ${record}`)
    const [mode, type, oid] = record.slice(0, tab).split(' ')
    const relative = record.slice(tab + 1)
    if (type !== 'blob') throw new Error(`unsupported Git tree entry ${type}: ${relative}`)
    entries.push({ path: relative, mode, oid })
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

function readGitBlobs(root, entries) {
  const oids = [...new Set(entries.map((entry) => entry.oid))]
  const result = spawnSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: `${oids.join('\n')}\n`,
    encoding: null,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 512 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr?.toString('utf8').trim() || 'unable to read Git source blobs')
  }

  const blobs = new Map()
  let offset = 0
  for (const expectedOid of oids) {
    const newline = result.stdout.indexOf(0x0a, offset)
    if (newline < 0) throw new Error(`truncated Git blob header: ${expectedOid}`)
    const header = result.stdout.subarray(offset, newline).toString('utf8')
    const [actualOid, type, sizeText] = header.split(' ')
    const size = Number(sizeText)
    if (actualOid !== expectedOid || type !== 'blob' || !Number.isSafeInteger(size) || size < 0) {
      throw new Error(`invalid Git blob header for ${expectedOid}: ${header}`)
    }
    const start = newline + 1
    const end = start + size
    if (end >= result.stdout.length || result.stdout[end] !== 0x0a) {
      throw new Error(`truncated Git blob content: ${expectedOid}`)
    }
    blobs.set(expectedOid, Buffer.from(result.stdout.subarray(start, end)))
    offset = end + 1
  }
  return blobs
}

function archiveEntries(root) {
  return walkArchive(root)
    .sort((a, b) => a.localeCompare(b))
    .map((relative) => {
      const stat = fs.statSync(path.join(root, relative))
      return { path: relative, mode: stat.mode & 0o111 ? '100755' : '100644' }
    })
}

function computeTreeIdentity(entries, readContents) {
  const treeHash = crypto.createHash('sha256')
  let totalBytes = 0
  const files = []

  for (const entry of entries) {
    const contents = readContents(entry)
    const hash = sha256Buffer(contents)
    totalBytes += contents.length
    treeHash.update(entry.path)
    treeHash.update('\0')
    treeHash.update(entry.mode)
    treeHash.update('\0')
    treeHash.update(String(contents.length))
    treeHash.update('\0')
    treeHash.update(hash)
    treeHash.update('\0')
    files.push({ path: entry.path, mode: entry.mode, bytes: contents.length, sha256: hash })
  }

  return {
    sourceTreeSha256: treeHash.digest('hex'),
    sourceFileCount: files.length,
    sourceBytes: totalBytes,
    files,
  }
}

export function getSourceIdentity({
  root,
  expectedCommit = process.env.GITHUB_SHA || process.env.SCRIPTOR_SOURCE_COMMIT || null,
  requireGit = false,
  requireClean = false,
  includeFiles = false,
  allowArchive = false,
} = {}) {
  const sourceRoot = path.resolve(root ?? path.resolve(import.meta.dirname, '../..'))
  const gitCommit = run('git', ['rev-parse', 'HEAD'], sourceRoot)
  const treeEntries = gitCommit ? gitTreeEntries(sourceRoot) : null
  const hasGitIdentity = Boolean(gitCommit && treeEntries)

  if (!hasGitIdentity && (requireGit || !allowArchive)) {
    throw new Error('release source identity requires a canonical Git checkout')
  }
  if (expectedCommit && gitCommit !== expectedCommit) {
    throw new Error(`source commit mismatch: expected ${expectedCommit}, found ${gitCommit ?? 'none'}`)
  }

  const sourceDirty = hasGitIdentity ? gitSourceDirty(sourceRoot) : null
  if (requireClean && sourceDirty) {
    throw new Error('release source checkout contains uncommitted or untracked changes')
  }

  const entries = hasGitIdentity ? treeEntries : archiveEntries(sourceRoot)
  const gitBlobs = hasGitIdentity ? readGitBlobs(sourceRoot, entries) : null
  const tree = computeTreeIdentity(entries, (entry) => {
    if (hasGitIdentity) {
      const contents = gitBlobs.get(entry.oid)
      if (!contents) throw new Error(`unable to read Git blob: ${entry.path}`)
      return contents
    }
    const absolute = path.join(sourceRoot, entry.path)
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      throw new Error(`archive source file is missing: ${entry.path}`)
    }
    return fs.readFileSync(absolute)
  })
  const identity = {
    schemaVersion: 2,
    sourceMode: hasGitIdentity ? 'git' : 'archive',
    sourceCommit: gitCommit,
    expectedCommit,
    sourceDirty,
    sourceTreeSha256: tree.sourceTreeSha256,
    sourceFileCount: tree.sourceFileCount,
    sourceBytes: tree.sourceBytes,
  }
  if (includeFiles) identity.files = tree.files
  return identity
}

function parseArgs(argv) {
  const result = {
    root: undefined,
    expectedCommit: undefined,
    requireGit: false,
    requireClean: false,
    includeFiles: false,
    allowArchive: false,
    output: undefined,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--root') result.root = argv[++index]
    else if (arg === '--expected-commit') result.expectedCommit = argv[++index]
    else if (arg === '--require-git') result.requireGit = true
    else if (arg === '--require-clean') result.requireClean = true
    else if (arg === '--include-files') result.includeFiles = true
    else if (arg === '--allow-archive') result.allowArchive = true
    else if (arg === '--output') result.output = argv[++index]
    else throw new Error(`unknown argument: ${arg}`)
  }
  return result
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const identity = getSourceIdentity(options)
    const serialized = `${JSON.stringify(identity, null, 2)}\n`
    if (options.output) {
      const output = path.resolve(options.output)
      fs.mkdirSync(path.dirname(output), { recursive: true })
      fs.writeFileSync(output, serialized)
      console.log(output)
    } else {
      process.stdout.write(serialized)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
