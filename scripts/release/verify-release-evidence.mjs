#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { getSourceIdentity } from './source-identity.mjs'
import {
  assertExactSubjectSet,
  collectSubjectFiles,
  parseSha256Sums,
} from './release-evidence-utils.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const subjectDir = path.resolve(process.argv[2] ?? path.join(root, 'release-artifacts'))
const evidenceDir = path.resolve(process.argv[3] ?? path.join(root, 'release-evidence'))
const receiptPath = path.join(evidenceDir, 'release-receipt.json')
const sbomPath = path.join(evidenceDir, 'scriptor.cyclonedx.json')
const sumsPath = path.join(evidenceDir, 'SHA256SUMS')
for (const required of [receiptPath, sbomPath, sumsPath]) {
  if (!fs.existsSync(required)) throw new Error(`missing release evidence: ${required}`)
}
if (!fs.existsSync(subjectDir) || !fs.statSync(subjectDir).isDirectory()) {
  throw new Error(`release subject directory does not exist: ${subjectDir}`)
}

const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
if (receipt.schemaVersion !== 2) throw new Error(`unsupported release receipt schema: ${receipt.schemaVersion}`)
const source = getSourceIdentity({
  root,
  expectedCommit: process.env.GITHUB_SHA || process.env.SCRIPTOR_SOURCE_COMMIT || undefined,
  requireGit: true,
  requireClean: true,
})
if (receipt.source?.schemaVersion !== 2) throw new Error(`unsupported source identity schema: ${receipt.source?.schemaVersion}`)
if (receipt.version !== fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim()) {
  throw new Error('receipt version does not match checkout')
}
if (receipt.source?.sourceCommit !== source.sourceCommit) throw new Error('receipt source commit does not match checkout')
if (receipt.source?.sourceTreeSha256 !== source.sourceTreeSha256) throw new Error('receipt source tree does not match checkout')

const expectedRoot = path.relative(root, subjectDir).replaceAll('\\', '/')
if (receipt.subjectRoot !== expectedRoot) throw new Error(`receipt subject root mismatch: expected ${expectedRoot}, found ${receipt.subjectRoot}`)

const sbom = JSON.parse(fs.readFileSync(sbomPath, 'utf8'))
if (sbom.bomFormat !== 'CycloneDX' || sbom.specVersion !== '1.6') throw new Error('unsupported SBOM format')
if (sbom.metadata?.component?.version !== receipt.version) throw new Error('SBOM version does not match receipt')
const properties = new Map((sbom.metadata?.properties ?? []).map((item) => [item.name, item.value]))
if (properties.get('scriptor:source-commit') !== source.sourceCommit) throw new Error('SBOM source commit does not match checkout')
if (properties.get('scriptor:source-tree-sha256') !== source.sourceTreeSha256) throw new Error('SBOM source tree does not match checkout')

const actualSubjects = collectSubjectFiles(subjectDir, { excludedDirectory: evidenceDir })
const expectedSubjects = assertExactSubjectSet(receipt.subjects, actualSubjects)
if (expectedSubjects.size === 0) throw new Error('release receipt has no subjects')

const sums = parseSha256Sums(fs.readFileSync(sumsPath, 'utf8'))
if (sums.size !== expectedSubjects.size) throw new Error('SHA256SUMS subject count does not match receipt')
for (const [relative, item] of expectedSubjects) {
  if (sums.get(relative) !== item.sha256) throw new Error(`SHA256SUMS mismatch: ${relative}`)
}

console.log(`Release evidence OK: ${expectedSubjects.size} subject(s), source ${source.sourceTreeSha256}.`)
