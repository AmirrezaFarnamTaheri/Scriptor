#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { getSourceIdentity } from './source-identity.mjs'
import { collectSubjectFiles } from './release-evidence-utils.mjs'
import { assertSigningEvidence, collectSigningEvidence } from './signing-evidence.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const subjectDir = path.resolve(process.argv[2] ?? path.join(root, 'dist'))
const outDir = path.resolve(process.argv[3] ?? path.join(root, 'dist/release-evidence'))
const allowArchive = process.env.SCRIPTOR_ALLOW_ARCHIVE_RECEIPT === '1'

if (!fs.existsSync(subjectDir) || !fs.statSync(subjectDir).isDirectory()) {
  throw new Error(`release subject directory does not exist: ${subjectDir}`)
}
fs.mkdirSync(outDir, { recursive: true })

const files = collectSubjectFiles(subjectDir, { excludedDirectory: outDir })
if (files.length === 0) throw new Error(`release subject directory is empty: ${subjectDir}`)

const command = (cmd, args = []) => {
  try {
    return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}
const source = getSourceIdentity({
  root,
  expectedCommit: process.env.GITHUB_SHA || process.env.SCRIPTOR_SOURCE_COMMIT || undefined,
  requireGit: !allowArchive,
  requireClean: !allowArchive,
  allowArchive,
})
const signing = assertSigningEvidence(collectSigningEvidence(outDir), {
  channel: process.env.SCRIPTOR_RELEASE_CHANNEL ?? 'production',
  expectedSourceCommit: source.sourceCommit,
})
const createdAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString()
const receipt = {
  schemaVersion: 4,
  createdAt,
  version: fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim(),
  source,
  signing,
  platform: { os: os.platform(), arch: os.arch() },
  tools: {
    node: process.version,
    npm: command('npm', ['--version']),
    pnpm: command('pnpm', ['--version']),
    cargo: command('cargo', ['--version']),
    rustc: command('rustc', ['--version']),
  },
  subjectRoot: path.relative(root, subjectDir).replaceAll('\\', '/'),
  subjects: files,
}
const receiptPath = path.join(outDir, 'release-receipt.json')
fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
fs.writeFileSync(path.join(outDir, 'SHA256SUMS'), `${files.map((file) => `${file.sha256}  ${file.path}`).join('\n')}\n`)
console.log(receiptPath)
