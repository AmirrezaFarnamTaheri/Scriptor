import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { assertExactSubjectSet, collectSubjectFiles, parseSha256Sums } from './release-evidence-utils.mjs'
import { assertSigningEvidence, collectSigningEvidence, signingEvidenceFilename } from './signing-evidence.mjs'

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function sourceMatches(left, right) {
  return left?.schemaVersion === 2
    && right?.schemaVersion === 2
    && left.sourceCommit === right.sourceCommit
    && left.sourceTreeSha256 === right.sourceTreeSha256
}

function sortedSubjects(subjects) {
  return [...subjects].sort((a, b) => a.path.localeCompare(b.path))
}

function assertSubjectMetadata(expected, actual, label) {
  const expectedMap = new Map(sortedSubjects(expected).map((item) => [item.path, item]))
  const actualMap = new Map(sortedSubjects(actual).map((item) => [item.path, item]))
  if (expectedMap.size !== actualMap.size) throw new Error(`${label} subject count mismatch`)
  for (const [relative, item] of expectedMap) {
    const found = actualMap.get(relative)
    if (!found || found.sha256 !== item.sha256 || (found.bytes !== undefined && item.bytes !== undefined && found.bytes !== item.bytes)) {
      throw new Error(`${label} subject mismatch: ${relative}`)
    }
  }
}

function sbomProperties(sbom) {
  return new Map((sbom?.metadata?.properties ?? []).map((item) => [item.name, item.value]))
}

function assertNodeSet(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) throw new Error('release evidence graph requires nodes')
  const ids = new Set()
  for (const node of nodes) {
    if (!node?.id || !node?.kind || !node?.path || !/^[a-f0-9]{64}$/.test(node?.sha256 ?? '')) {
      throw new Error(`invalid release evidence graph node: ${node?.id ?? '<missing>'}`)
    }
    if (ids.has(node.id)) throw new Error(`duplicate release evidence graph node: ${node.id}`)
    if (node.required !== true || node.status !== 'verified') throw new Error(`required release evidence node is not verified: ${node.id}`)
    ids.add(node.id)
  }
  return ids
}

export function createReleaseEvidenceGraph({
  version,
  channel,
  trustProfile,
  source,
  subjects,
  quality,
  performance,
  receipt,
  sbom,
  attestations,
  signing,
  nodes,
  createdAt = new Date().toISOString(),
}) {
  if (!String(version ?? '').trim()) throw new Error('release evidence graph requires version')
  if (!['preview', 'production'].includes(channel)) throw new Error(`unsupported release evidence channel: ${channel}`)
  if (!['unsigned', 'native-signed'].includes(trustProfile)) throw new Error(`unsupported release trust profile: ${trustProfile}`)
  if (source?.schemaVersion !== 2 || !source.sourceTreeSha256) throw new Error('release evidence graph requires source identity schema 2')
  if (!Array.isArray(subjects) || subjects.length === 0) throw new Error('release evidence graph requires installer subjects')

  if (quality?.schemaVersion !== 1 || quality.pass !== true) throw new Error('release quality evidence is not passing')
  if (quality.version !== version || !sourceMatches(source, quality.source)) throw new Error('release quality evidence source/version mismatch')
  if (!quality.requiredChecks?.includes('release-smoke')) throw new Error('release quality evidence does not require release-smoke')
  const checks = new Map((quality.checks ?? []).map((check) => [check.id, check.status]))
  for (const required of quality.requiredChecks) {
    if (checks.get(required) !== 'passed') throw new Error(`release quality check is not passing: ${required}`)
  }

  if (performance?.schemaVersion !== 3 || performance.pass !== true || !sourceMatches(source, performance.source)) {
    throw new Error('performance evidence is not passing or source-bound')
  }
  if (receipt?.schemaVersion !== 4 || receipt.version !== version || receipt.trustProfile !== trustProfile || !sourceMatches(source, receipt.source)) {
    throw new Error('release receipt does not match release identity')
  }
  assertSubjectMetadata(subjects, receipt.subjects ?? [], 'release receipt')

  const properties = sbomProperties(sbom)
  if (sbom?.bomFormat !== 'CycloneDX' || sbom?.specVersion !== '1.7' || sbom?.metadata?.component?.version !== version) {
    throw new Error('release SBOM is not CycloneDX 1.7 for this version')
  }
  if (properties.get('scriptor:source-commit') !== (source.sourceCommit ?? 'archive')
    || properties.get('scriptor:source-tree-sha256') !== source.sourceTreeSha256) {
    throw new Error('release SBOM source identity mismatch')
  }

  if (attestations?.schemaVersion !== 1 || attestations.pass !== true || attestations.sourceDigest !== source.sourceCommit) {
    throw new Error('GitHub attestation verification is not source-bound')
  }
  if ((attestations.subjects ?? []).some((item) => item.provenanceVerified !== true || item.sbomVerified !== true)) {
    throw new Error('not every installer has verified provenance and SBOM attestations')
  }
  assertSubjectMetadata(subjects, attestations.subjects ?? [], 'attestation verification')

  if (!Array.isArray(signing) || signing.length !== 4) throw new Error('release signing evidence target matrix is incomplete')
  const signingKeys = new Set(signing.map((record) => `${record.platform}/${record.architecture}`))
  if (signingKeys.size !== 4) throw new Error('release signing evidence contains duplicate targets')

  const nodeIds = assertNodeSet(nodes)
  const edges = []
  const addEdge = (from, to, relation) => {
    if (!nodeIds.has(from) || !nodeIds.has(to)) return
    edges.push({ from, to, relation })
  }
  for (const node of nodes.filter((item) => item.id.startsWith('installer:'))) {
    addEdge('evidence:receipt', node.id, 'receipts')
    addEdge('evidence:checksums', node.id, 'hashes')
    addEdge('evidence:attestations', node.id, 'attests')
    addEdge('evidence:sbom', node.id, 'describes')
    addEdge('evidence:signing', node.id, 'trusts')
  }
  for (const evidenceId of ['evidence:quality', 'evidence:performance', 'evidence:receipt', 'evidence:sbom', 'evidence:attestations', 'evidence:signing']) {
    addEdge('source:VERSION', evidenceId, 'binds-version')
  }
  edges.sort((a, b) => `${a.from}\0${a.to}\0${a.relation}`.localeCompare(`${b.from}\0${b.to}\0${b.relation}`))
  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id))
  const graphIdentity = crypto.createHash('sha256').update(JSON.stringify({
    version,
    channel,
    trustProfile,
    sourceCommit: source.sourceCommit,
    sourceTreeSha256: source.sourceTreeSha256,
    subjects: sortedSubjects(subjects).map(({ path: subjectPath, sha256 }) => ({ path: subjectPath, sha256 })),
    nodes: sortedNodes.map(({ id, sha256 }) => ({ id, sha256 })),
  })).digest('hex')

  return {
    schema: 'scriptor.release-evidence-graph.v1',
    schemaVersion: 1,
    graphId: `sha256:${graphIdentity}`,
    createdAt,
    version,
    channel,
    trustProfile,
    source,
    nodes: sortedNodes,
    edges,
    summary: {
      installerCount: subjects.length,
      requiredNodeCount: sortedNodes.length,
      verifiedNodeCount: sortedNodes.filter((node) => node.status === 'verified').length,
      qualityCheckCount: quality.requiredChecks.length,
      signingTargetCount: signing.length,
      attestedSubjectCount: attestations.subjects.length,
    },
    pass: true,
  }
}

function readJson(file, label) {
  if (!fs.existsSync(file)) throw new Error(`missing ${label}: ${file}`)
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch (error) { throw new Error(`invalid ${label}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }) }
}

function fileNode({ id, kind, file, base }) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`missing release evidence input: ${file}`)
  return {
    id,
    kind,
    path: path.relative(base, file).replaceAll('\\', '/'),
    bytes: fs.statSync(file).size,
    sha256: sha256File(file),
    required: true,
    status: 'verified',
  }
}

export function buildReleaseEvidenceGraph({ root, subjectDir, evidenceDir, source, channel, trustProfile, createdAt }) {
  const sourceRoot = path.resolve(root)
  const subjectsRoot = path.resolve(subjectDir)
  const evidenceRoot = path.resolve(evidenceDir)
  const version = fs.readFileSync(path.join(sourceRoot, 'VERSION'), 'utf8').trim()
  const qualityPath = path.join(evidenceRoot, 'release-quality-evidence.json')
  const performancePath = path.join(evidenceRoot, 'performance-evidence.json')
  const receiptPath = path.join(evidenceRoot, 'release-receipt.json')
  const sbomPath = path.join(evidenceRoot, 'scriptor.cyclonedx.json')
  const sumsPath = path.join(evidenceRoot, 'SHA256SUMS')
  const attestationsPath = path.join(evidenceRoot, 'attestation-verification.json')
  const quality = readJson(qualityPath, 'release quality evidence')
  const performance = readJson(performancePath, 'performance evidence')
  const receipt = readJson(receiptPath, 'release receipt')
  const sbom = readJson(sbomPath, 'SBOM')
  const attestations = readJson(attestationsPath, 'attestation verification')

  const subjects = collectSubjectFiles(subjectsRoot, { excludedDirectory: evidenceRoot })
  assertExactSubjectSet(receipt.subjects ?? [], subjects)
  const sums = parseSha256Sums(fs.readFileSync(sumsPath, 'utf8'))
  if (sums.size !== subjects.length || subjects.some((subject) => sums.get(subject.path) !== subject.sha256)) {
    throw new Error('SHA256SUMS does not exactly match release subjects')
  }
  const signing = assertSigningEvidence(collectSigningEvidence(evidenceRoot), {
    channel,
    expectedSourceCommit: source.sourceCommit,
    expectedTrustProfile: trustProfile,
  })

  const nodes = [
    fileNode({ id: 'source:VERSION', kind: 'source-input', file: path.join(sourceRoot, 'VERSION'), base: sourceRoot }),
    fileNode({ id: 'source:Cargo.lock', kind: 'source-input', file: path.join(sourceRoot, 'Cargo.lock'), base: sourceRoot }),
    fileNode({ id: 'source:pnpm-lock.yaml', kind: 'source-input', file: path.join(sourceRoot, 'pnpm-lock.yaml'), base: sourceRoot }),
    fileNode({ id: 'source:rust-toolchain.toml', kind: 'toolchain-input', file: path.join(sourceRoot, 'rust-toolchain.toml'), base: sourceRoot }),
    fileNode({ id: 'source:package.json', kind: 'toolchain-input', file: path.join(sourceRoot, 'package.json'), base: sourceRoot }),
    fileNode({ id: 'evidence:quality', kind: 'quality-evidence', file: qualityPath, base: evidenceRoot }),
    fileNode({ id: 'evidence:performance', kind: 'performance-evidence', file: performancePath, base: evidenceRoot }),
    fileNode({ id: 'evidence:receipt', kind: 'release-receipt', file: receiptPath, base: evidenceRoot }),
    fileNode({ id: 'evidence:sbom', kind: 'sbom', file: sbomPath, base: evidenceRoot }),
    fileNode({ id: 'evidence:checksums', kind: 'checksums', file: sumsPath, base: evidenceRoot }),
    fileNode({ id: 'evidence:attestations', kind: 'attestation-verification', file: attestationsPath, base: evidenceRoot }),
  ]
  const signingNodes = signing.map((record) => fileNode({
    id: `evidence:signing:${record.platform}/${record.architecture}`,
    kind: 'signing-evidence',
    file: path.join(evidenceRoot, signingEvidenceFilename(record.platform, record.architecture)),
    base: evidenceRoot,
  }))
  nodes.push(...signingNodes)
  const signingSetDigest = crypto.createHash('sha256')
  for (const node of [...signingNodes].sort((a, b) => a.id.localeCompare(b.id))) signingSetDigest.update(`${node.id}\0${node.sha256}\0`)
  nodes.push({
    id: 'evidence:signing',
    kind: 'signing-evidence-set',
    path: 'signing-evidence-set',
    bytes: signingNodes.reduce((sum, node) => sum + node.bytes, 0),
    sha256: signingSetDigest.digest('hex'),
    required: true,
    status: 'verified',
  })
  for (const subject of subjects) {
    nodes.push(fileNode({
      id: `installer:${subject.path}`,
      kind: 'installer',
      file: path.join(subjectsRoot, subject.path),
      base: subjectsRoot,
    }))
  }

  return createReleaseEvidenceGraph({
    version, channel, trustProfile, source, subjects, quality, performance, receipt, sbom, attestations, signing, nodes, createdAt,
  })
}
