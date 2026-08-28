#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { collectSubjectFiles } from './release-evidence-utils.mjs'
import { verifyGithubAttestations } from './github-attestations.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const subjectDir = path.resolve(process.argv[2] ?? path.join(root, 'release-artifacts'))
const evidenceDir = path.resolve(process.argv[3] ?? path.join(root, 'release-evidence'))
const repository = process.env.GITHUB_REPOSITORY
const sourceDigest = process.env.GITHUB_SHA || process.env.SCRIPTOR_SOURCE_COMMIT
const sourceRef = process.env.GITHUB_REF
const signerWorkflow = process.env.SCRIPTOR_SIGNER_WORKFLOW || `${repository}/.github/workflows/release.yml`

if (!repository || !sourceDigest || !sourceRef) {
  throw new Error('GitHub attestation verification requires GITHUB_REPOSITORY, GITHUB_SHA/SCRIPTOR_SOURCE_COMMIT, and GITHUB_REF')
}
if (!fs.existsSync(subjectDir) || !fs.statSync(subjectDir).isDirectory()) {
  throw new Error(`release subject directory does not exist: ${subjectDir}`)
}
fs.mkdirSync(evidenceDir, { recursive: true })

const files = collectSubjectFiles(subjectDir, { excludedDirectory: evidenceDir })
if (files.length === 0) throw new Error('release subject directory is empty')
const subjects = files.map((file) => ({ path: path.join(subjectDir, file.path), sha256: file.sha256 }))
const evidence = verifyGithubAttestations({
  subjects,
  repository,
  sourceDigest,
  sourceRef,
  signerWorkflow,
  execute: (command) => execFileSync('gh', command.args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  }),
})
evidence.subjects = evidence.subjects.map((subject) => ({
  ...subject,
  path: path.relative(subjectDir, subject.path).replaceAll('\\', '/'),
}))
const outputPath = path.join(evidenceDir, 'attestation-verification.json')
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
console.log(outputPath)
