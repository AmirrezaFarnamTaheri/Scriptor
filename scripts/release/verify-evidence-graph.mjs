#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { getSourceIdentity } from './source-identity.mjs'
import { buildReleaseEvidenceGraph } from './evidence-graph.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const subjectDir = path.resolve(process.argv[2] ?? path.join(root, 'release-artifacts'))
const evidenceDir = path.resolve(process.argv[3] ?? path.join(root, 'release-evidence'))
const graphPath = path.join(evidenceDir, 'release-evidence-graph.json')
if (!fs.existsSync(graphPath)) throw new Error(`missing release evidence graph: ${graphPath}`)
const recorded = JSON.parse(fs.readFileSync(graphPath, 'utf8'))
if (recorded.schema !== 'scriptor.release-evidence-graph.v1' || recorded.schemaVersion !== 1 || recorded.pass !== true) {
  throw new Error('release evidence graph schema/status is invalid')
}
const source = getSourceIdentity({
  root,
  expectedCommit: process.env.GITHUB_SHA || process.env.SCRIPTOR_SOURCE_COMMIT || undefined,
  requireGit: true,
  requireClean: true,
})
const current = buildReleaseEvidenceGraph({
  root,
  subjectDir,
  evidenceDir,
  source,
  channel: process.env.SCRIPTOR_RELEASE_CHANNEL ?? 'production',
  trustProfile: process.env.SCRIPTOR_TRUST_PROFILE ?? 'unsigned',
  createdAt: recorded.createdAt,
})
if (JSON.stringify(current) !== JSON.stringify(recorded)) {
  throw new Error('release evidence graph does not match current source/evidence/artifacts')
}
console.log(`Release evidence graph OK: ${recorded.graphId}`)
