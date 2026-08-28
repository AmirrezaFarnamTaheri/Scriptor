#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { getSourceIdentity } from './source-identity.mjs'
import { buildReleaseEvidenceGraph } from './evidence-graph.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const subjectDir = path.resolve(process.argv[2] ?? path.join(root, 'release-artifacts'))
const evidenceDir = path.resolve(process.argv[3] ?? path.join(root, 'release-evidence'))
const source = getSourceIdentity({
  root,
  expectedCommit: process.env.GITHUB_SHA || process.env.SCRIPTOR_SOURCE_COMMIT || undefined,
  requireGit: true,
  requireClean: true,
})
const createdAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString()
const graph = buildReleaseEvidenceGraph({
  root,
  subjectDir,
  evidenceDir,
  source,
  channel: process.env.SCRIPTOR_RELEASE_CHANNEL ?? 'production',
  trustProfile: process.env.SCRIPTOR_TRUST_PROFILE ?? 'unsigned',
  createdAt,
})
const outputPath = path.join(evidenceDir, 'release-evidence-graph.json')
fs.writeFileSync(outputPath, `${JSON.stringify(graph, null, 2)}\n`)
console.log(outputPath)
