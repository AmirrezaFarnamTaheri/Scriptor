// Dependency-free, profile-driven lightweight Scriptor source archive builder.
//
// Node port of the former scripts/zip-lite.py (the repository's only Python
// dependency). Improvements over the Python original:
// - excluded directory trees (node_modules, .git, target, dist, ...) are
//   PRUNED during traversal instead of enumerated and filtered afterwards;
// - fixed DOS timestamps make output archives byte-for-byte reproducible
//   for identical repository content;
// - no external runtime requirement beyond Node (>= 22.12, already enforced
//   by package.json engines).
//
// ZIP writer: local file headers + central directory + EOCD, method 8
// (deflate via zlib.deflateRawSync), UTF-8 name flag, no data descriptors
// (sizes are known before header write).
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { deflateRawSync, crc32 } from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitWorkspaceFiles } from '../lib/workspace-files.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DEFAULT_OUTPUT = path.join(path.dirname(REPO_ROOT), 'Scriptor-lite.zip')

const COMMON_EXCLUDE_DIR_NAMES = new Set([
  'node_modules', 'target', 'dist', 'dist-e2e', 'playwright-report', 'test-results',
  '.playwright-mcp', 'coverage', '.nyc_output', '.cache', '.turbo', '.next',
  '.git', '.serena', '.claude', 'gen', 'binaries', 'cache',
])
const RUNTIME_LITE_EXTRA_DIR_NAMES = new Set([
  'synthetic-1k', 'synthetic-5k', 'synthetic-25k', 'screenshots.spec.ts-snapshots',
])
const COMMON_EXCLUDE_FILES = new Set([
  '.DS_Store', 'Thumbs.db', 'npm-debug.log', 'yarn-debug.log', 'yarn-error.log',
  'pnpm-debug.log', 'lerna-debug.log',
])
const COMMON_EXCLUDE_GLOBS = ['*.wasm', '*.map', '*.log', '*.tmp', '*.bak', '*.orig', '*.tsbuildinfo', '*~']
const PROFILE_REQUIRED_MANIFEST = path.join(REPO_ROOT, 'scripts/packaging/source-review-required.json')

// Fixed MS-DOS timestamp (1980-01-01 00:00:00) — the ZIP epoch minimum — so
// archive bytes depend only on file content and names, never on checkout mtimes.
const DOS_TIME = 0
const DOS_DATE = 0x21
const ZIP32_MAX_ENTRIES = 0xffff
const ZIP32_MAX_SIZE = 0xffffffff
const ARCHIVE_ROOT = 'Scriptor'

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`)
}

const EXCLUDE_GLOB_RES = COMMON_EXCLUDE_GLOBS.map(globToRegExp)

function profileRules(profile) {
  assert.ok(profile === 'source-review' || profile === 'runtime-lite', `unknown profile: ${profile}`)
  const dirs = profile === 'runtime-lite'
    ? new Set([...COMMON_EXCLUDE_DIR_NAMES, ...RUNTIME_LITE_EXTRA_DIR_NAMES])
    : COMMON_EXCLUDE_DIR_NAMES
  return { dirs, files: COMMON_EXCLUDE_FILES, globs: EXCLUDE_GLOB_RES }
}

function shouldSkip(relParts, fileName, rules) {
  if (relParts.length === 0) return true
  if (relParts.some((part) => rules.dirs.has(part))) return true
  if (rules.files.has(fileName)) return true
  return rules.globs.some((re) => re.test(fileName))
}

// Pruned, symlink-safe recursive walk. Excluded directory names are never
// entered, so oversized dependency/build trees cost zero traversal time.
function collectFiles(root, rules, out, includedPaths) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue
    const full = path.join(root, entry.name)
    if (includedPaths && !includedPaths.has(full)) continue
    if (entry.isDirectory()) {
      if (rules.dirs.has(entry.name)) continue
      collectFiles(full, rules, out, includedPaths)
    } else if (entry.isFile()) {
      out.push(full)
    }
  }
}

function sourceReviewRequiredPaths() {
  const raw = JSON.parse(fs.readFileSync(PROFILE_REQUIRED_MANIFEST, 'utf8'))
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.requiredPaths)) {
    throw new Error(`invalid packaging manifest: ${PROFILE_REQUIRED_MANIFEST}`)
  }
  return raw.requiredPaths.map(String)
}

function validateProfileInputs(repo, profile) {
  if (profile !== 'source-review') return []
  const required = sourceReviewRequiredPaths()
  const missing = required.filter((relative) => !fs.statSync(path.join(repo, relative), { throwIfNoEntry: false })?.isFile())
  if (missing.length > 0) {
    throw new Error('source-review profile is missing required inputs: ' + missing.join(', '))
  }
  return required
}

function dosHeaderFields() {
  const time = Buffer.alloc(4)
  time.writeUInt16LE(DOS_TIME, 0)
  time.writeUInt16LE(DOS_DATE, 2)
  return time
}

function zipEntry(nameBuffer, contents) {
  const deflated = deflateRawSync(contents, { level: 5 })
  const compressed = deflated.length < contents.length ? deflated : contents
  const method = deflated.length < contents.length ? 8 : 0
  const crc = crc32(contents) >>> 0
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4) // version needed
  header.writeUInt16LE(0x0800, 6) // flags: UTF-8 names
  header.writeUInt16LE(method, 8)
  dosHeaderFields().copy(header, 10)
  header.writeUInt32LE(crc, 14)
  header.writeUInt32LE(compressed.length, 18)
  header.writeUInt32LE(contents.length, 22)
  header.writeUInt16LE(nameBuffer.length, 26)
  header.writeUInt16LE(0, 28) // extra length
  return { header, nameBuffer, compressed, crc, method, compressedSize: compressed.length, uncompressedSize: contents.length }
}

function centralDirectoryEntry(entry, offset) {
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4) // version made by
  central.writeUInt16LE(20, 6) // version needed
  central.writeUInt16LE(0x0800, 8) // flags: UTF-8 names
  central.writeUInt16LE(entry.method, 10)
  dosHeaderFields().copy(central, 12)
  central.writeUInt32LE(entry.crc, 16)
  central.writeUInt32LE(entry.compressedSize, 20)
  central.writeUInt32LE(entry.uncompressedSize, 24)
  central.writeUInt16LE(entry.nameBuffer.length, 28)
  central.writeUInt32LE(0, 38) // disk number start, internal attrs
  central.writeUInt32LE(offset, 42) // relative offset of local header
  return central
}

export function assembleZip(entries) {
  if (entries.length > ZIP32_MAX_ENTRIES) {
    throw new Error(`archive has ${entries.length} entries; ZIP64 support is required above ${ZIP32_MAX_ENTRIES}`)
  }
  const chunks = []
  const offsets = []
  let offset = 0
  for (const entry of entries) {
    offsets.push(offset)
    const local = Buffer.concat([entry.header, entry.nameBuffer, entry.compressed])
    chunks.push(local)
    offset += local.length
    if (offset > ZIP32_MAX_SIZE) {
      throw new Error('archive exceeds 4 GiB; ZIP64 support is required')
    }
  }
  const centralStart = offset
  let centralSize = 0
  for (let i = 0; i < entries.length; i += 1) {
    const central = Buffer.concat([centralDirectoryEntry(entries[i], offsets[i]), entries[i].nameBuffer])
    chunks.push(central)
    centralSize += central.length
    if (centralSize > ZIP32_MAX_SIZE || centralStart + centralSize > ZIP32_MAX_SIZE) {
      throw new Error('archive central directory exceeds 4 GiB; ZIP64 support is required')
    }
  }
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralSize, 12)
  eocd.writeUInt32LE(centralStart, 16)
  eocd.writeUInt16LE(0, 20)
  chunks.push(eocd)
  return Buffer.concat(chunks)
}

export function buildZip(repo, output, profile = 'source-review') {
  repo = path.resolve(repo)
  const rules = profileRules(profile)
  const required = validateProfileInputs(repo, profile)
  fs.mkdirSync(path.dirname(output), { recursive: true })

  const files = []
  const workspaceFiles = gitWorkspaceFiles(repo)
  const includedPaths = workspaceFiles ? new Set() : null
  for (const file of workspaceFiles ?? []) {
    let current = file
    while (current !== repo && current !== path.dirname(current)) {
      includedPaths.add(current)
      current = path.dirname(current)
    }
  }
  collectFiles(repo, rules, files, includedPaths)
  const outResolved = path.resolve(output)
  const candidates = files
    .filter((file) => path.resolve(file) !== outResolved)
    .sort()

  const entries = []
  let totalBytes = 0
  // Archive identity is independent of the checkout folder name. Release and
  // review receipts refer to a canonical `Scriptor/...` root so the same tree
  // produces the same entry names and bytes in `Scriptor`, `Scriptor-main`, a
  // CI worktree, or any other physical checkout location.
  for (const file of candidates) {
    const rel = path.relative(repo, file)
    const relParts = rel.split(path.sep)
    // Full relative parts (Python parity): the empty-parts guard skips the
    // repo root itself, while root-level FILES have a one-element path and
    // are retained.
    if (shouldSkip(relParts, path.basename(file), rules)) continue
    const arcname = ARCHIVE_ROOT + '/' + rel.split(path.sep).join('/')
    const contents = fs.readFileSync(file)
    entries.push(zipEntry(Buffer.from(arcname, 'utf8'), contents))
    totalBytes += contents.length
  }

  const profileRecord = {
    schemaVersion: 1,
    profile,
    requiredValidationInputs: required,
    excludesReconstructableBuildState: true,
  }
  entries.push(zipEntry(Buffer.from('Scriptor/PACKAGING_PROFILE.json', 'utf8'), Buffer.from(JSON.stringify(profileRecord, null, 2) + '\n', 'utf8')))

  const temporaryOutput = path.join(
    path.dirname(output),
    `.${path.basename(output)}.${process.pid}.${randomUUID()}.tmp`,
  )
  try {
    fs.writeFileSync(temporaryOutput, assembleZip(entries))
    fs.renameSync(temporaryOutput, output)
  } finally {
    if (fs.existsSync(temporaryOutput)) fs.unlinkSync(temporaryOutput)
  }
  return { count: entries.length, totalBytes }
}

export function listZip(archive) {
  const buffer = Buffer.isBuffer(archive) ? archive : fs.readFileSync(archive)
  const eocdSig = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  assert.ok(eocdSig !== -1, 'not a ZIP archive: missing end-of-central-directory record')
  const entryCount = buffer.readUInt16LE(eocdSig + 10)
  let offset = buffer.readUInt32LE(eocdSig + 16)
  const names = []
  for (let i = 0; i < entryCount; i += 1) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50, 'corrupt central directory')
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    names.push(buffer.toString('utf8', offset + 46, offset + 46 + nameLength))
    offset += 46 + nameLength + extraLength + commentLength
  }
  return names
}

export function main(argv = process.argv.slice(2)) {
  let positional = null
  let output = null
  let profile = 'source-review'
  try {
    for (let i = 0; i < argv.length; i += 1) {
      const arg = argv[i]
      if (arg === '--profile') {
        profile = argv[i + 1]
        if (!profile || profile.startsWith('--')) throw new Error('--profile requires a value')
        i += 1
        assert.ok(profile === 'source-review' || profile === 'runtime-lite', `invalid --profile: ${profile}`)
      } else if (arg === '--output') {
        output = argv[i + 1]
        if (!output || output.startsWith('--')) throw new Error('--output requires a path')
        i += 1
      } else if (arg === '--help' || arg === '-h') {
        console.log('Usage: node scripts/packaging/zip-lite.mjs [--profile source-review|runtime-lite] [--output path]')
        return 0
      } else {
        if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`)
        if (positional !== null) throw new Error('use either positional output or --output, not both')
        positional = arg
      }
    }
    if (output && positional) throw new Error('use either positional output or --output, not both')
    const resolved = path.resolve(output ?? positional ?? DEFAULT_OUTPUT)
    const { count, totalBytes } = buildZip(REPO_ROOT, resolved, profile)
    const outBytes = fs.statSync(resolved).size
    console.log(`Profile: ${profile}`)
    console.log(`Repo: ${REPO_ROOT}`)
    console.log(`Output: ${resolved}`)
    console.log(`Files added: ${count}`)
    console.log(`Uncompressed source bytes: ${totalBytes.toLocaleString('en-US')}`)
    console.log(`Zip size: ${outBytes.toLocaleString('en-US')} (${(outBytes / 1024 / 1024).toFixed(2)} MiB)`)
    return 0
  } catch (error) {
    console.error(`Packaging failed: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main()
}
