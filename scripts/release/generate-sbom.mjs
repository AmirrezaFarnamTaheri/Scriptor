#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { getSourceIdentity } from './source-identity.mjs'
import { parseCargoLockPackages, parsePnpmLockPackages } from './sbom-utils.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const outDir = path.resolve(process.argv[2] ?? path.join(root, 'dist/release-evidence'))
const allowArchive = process.env.SCRIPTOR_ALLOW_ARCHIVE_RECEIPT === '1'
fs.mkdirSync(outDir, { recursive: true })
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim()
const source = getSourceIdentity({
  root,
  expectedCommit: process.env.GITHUB_SHA || process.env.SCRIPTOR_SOURCE_COMMIT || undefined,
  requireGit: !allowArchive,
  requireClean: !allowArchive,
  allowArchive,
})
const npmComponents = parsePnpmLockPackages(fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'))
const cargoComponents = parseCargoLockPackages(fs.readFileSync(path.join(root, 'Cargo.lock'), 'utf8'))
const components = [...npmComponents, ...cargoComponents]
components.sort((a, b) => `${a.purl}`.localeCompare(`${b.purl}`))

const deterministicId = crypto
  .createHash('sha256')
  .update(`${version}\0${source.sourceTreeSha256}`)
  .digest('hex')
const uuid = `${deterministicId.slice(0, 8)}-${deterministicId.slice(8, 12)}-5${deterministicId.slice(13, 16)}-a${deterministicId.slice(17, 20)}-${deterministicId.slice(20, 32)}`
const timestamp = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString()
const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  serialNumber: `urn:uuid:${uuid}`,
  version: 1,
  metadata: {
    timestamp,
    component: { type: 'application', name: 'Scriptor', version },
    properties: [
      { name: 'scriptor:source-commit', value: source.sourceCommit ?? 'archive' },
      { name: 'scriptor:source-tree-sha256', value: source.sourceTreeSha256 },
      { name: 'scriptor:npm-component-count', value: String(npmComponents.length) },
      { name: 'scriptor:cargo-component-count', value: String(cargoComponents.length) },
    ],
  },
  components,
}
const sbomPath = path.join(outDir, 'scriptor.cyclonedx.json')
fs.writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`)
console.log(sbomPath)
