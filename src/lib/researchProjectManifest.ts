/** MAT-014: read-only manifest/evidence comparison, never a build or grant. */
export type ResearchManifestReview = {
  status: 'current' | 'stale' | 'unverified'
  changed: string[]
  missing: string[]
  unverified: string[]
  executionAuthorized: false
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const sha = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 255
function path(v: unknown): string {
  if (!text(v) || v.startsWith('/') || v.includes('\\') || v.includes(':') || v.includes('\0') || v.split('/').some(x => !x || x === '.' || x === '..')) {
    throw new Error('Unsafe vault-relative path in research manifest')
  }
  return v
}
function identity(v: unknown): string {
  if (!text(v) || !/^[a-zA-Z0-9_-]+$/.test(v)) throw new Error('Invalid research identity')
  return v
}
export function reviewResearchProjectManifest(manifest: unknown, observed: unknown): ResearchManifestReview {
  if (!object(manifest) || manifest.schemaVersion !== 1) throw new Error('Unsupported research project manifest schema')
  const vaultId = identity(manifest.vaultId)
  identity(manifest.projectId)
  if (!Array.isArray(manifest.inputs) || manifest.inputs.length === 0 || manifest.inputs.length > 500) throw new Error('Invalid research inputs')
  const entries: { path: string; sha256: string }[] = []
  // Cross-platform project evidence must not claim two independent files
  // where a case-insensitive or canonically normalized filesystem can only
  // represent one. Keep exact original paths for native reads and receipts;
  // this comparison key is not a substitute for native filesystem ownership.
  const used = new Set<string>()
  const assertDisjointPath = (filename: string): void => {
    const portable = filename.normalize('NFC').toLowerCase()
    for (const previous of used) {
      if (previous === portable || previous.startsWith(portable + '/') || portable.startsWith(previous + '/')) {
        throw new Error('Duplicate or overlapping research manifest paths')
      }
    }
    used.add(portable)
  }
  for (const row of manifest.inputs) {
    if (!object(row) || !['note', 'bibliography', 'source'].includes(row.kind as string) || !sha(row.sha256)) throw new Error('Invalid research input sha256 or kind')
    const filename = path(row.path)
    assertDisjointPath(filename)
    entries.push({ path: filename, sha256: row.sha256 })
  }
  if (!object(manifest.output) || !text(manifest.output.profile) || !sha(manifest.output.sha256)) throw new Error('Invalid research output sha256 or profile')
  const output = path(manifest.output.path)
  assertDisjointPath(output)
  entries.push({ path: output, sha256: manifest.output.sha256 })
  if (!Array.isArray(manifest.tools) || manifest.tools.length > 32) throw new Error('Invalid research tools')
  const names = new Set<string>()
  for (const tool of manifest.tools) {
    if (!object(tool) || !text(tool.name) || !text(tool.version) || tool.authorization !== 'review-required') {
      throw new Error('Every research tool requires a version and review-required authorization')
    }
    if (names.has(tool.name)) throw new Error('Duplicate research tool name')
    names.add(tool.name)
  }
  const changed: string[] = [], missing: string[] = [], unverified: string[] = []
  if (!object(observed) || observed.vaultId !== vaultId) {
    return { status: 'unverified', changed, missing, unverified: [...entries.map(e => e.path), ...[...names].map(n => 'tool:' + n)], executionAuthorized: false }
  }
  if (!Array.isArray(observed.reads) || observed.reads.length > 1000 || !Array.isArray(observed.tools) || observed.tools.length > 128) {
    throw new Error('Malformed research evidence')
  }
  const byPath = new Map<string, Record<string, unknown>>()
  // Read receipts are observations, not proof that case- or Unicode-aliasing
  // filesystem paths represent independent source files. Keep exact authored
  // paths for matching the manifest and native evidence, but reject aliases.
  const observedPortablePaths = new Set<string>()
  for (const row of observed.reads) {
    if (!object(row)) throw new Error('Invalid research read evidence')
    const name = path(row.path)
    if (byPath.has(name)) throw new Error('Duplicate research read evidence')
    const portable = name.normalize('NFC').toLowerCase()
    for (const previous of observedPortablePaths) {
      if (previous === portable || previous.startsWith(portable + '/') || portable.startsWith(previous + '/')) {
        throw new Error('Duplicate or overlapping research read evidence')
      }
    }
    observedPortablePaths.add(portable)
    if (!['present', 'missing', 'unavailable'].includes(row.state as string)) throw new Error('Invalid research read state')
    if (row.state === 'present' && !sha(row.sha256)) throw new Error('Invalid research evidence sha256')
    byPath.set(name, row)
  }
  const byTool = new Map<string, Record<string, unknown>>()
  for (const tool of observed.tools) {
    if (!object(tool) || !text(tool.name) || !['available', 'unavailable'].includes(tool.state as string)) throw new Error('Invalid tool evidence')
    if (byTool.has(tool.name)) throw new Error('Duplicate research tool evidence')
    if (tool.state === 'available' && !text(tool.version)) throw new Error('Missing tool version')
    byTool.set(tool.name, tool)
  }
  for (const entry of entries) {
    const found = byPath.get(entry.path)
    if (found?.state === 'missing') missing.push(entry.path)
    else if (found?.state === 'present') { if ((found.sha256 as string).toLowerCase() !== entry.sha256.toLowerCase()) changed.push(entry.path) }
    else unverified.push(entry.path)
  }
  for (const tool of manifest.tools) {
    const found = byTool.get(tool.name)
    if (!found || found.state !== 'available' || found.version !== tool.version) unverified.push('tool:' + tool.name)
  }
  return {
    status: changed.length || missing.length ? 'stale' : unverified.length ? 'unverified' : 'current',
    changed, missing, unverified, executionAuthorized: false,
  }
}
