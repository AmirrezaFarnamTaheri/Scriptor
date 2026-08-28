#!/usr/bin/env node
import path from 'node:path'

import { assertSigningEvidence, collectSigningEvidence } from './signing-evidence.mjs'

const subjectDir = path.resolve(process.argv[2] ?? 'release-artifacts')
const channel = process.argv[3] ?? process.env.SCRIPTOR_RELEASE_CHANNEL ?? 'production'
const trustProfile = process.argv[4] ?? process.env.SCRIPTOR_TRUST_PROFILE ?? 'unsigned'
const records = collectSigningEvidence(subjectDir)
const verified = assertSigningEvidence(records, {
  channel,
  expectedTrustProfile: trustProfile,
  expectedSourceCommit: process.env.GITHUB_SHA || process.env.SCRIPTOR_SOURCE_COMMIT || undefined,
})
console.log(
  `Signing status evidence OK (${trustProfile}): ${verified
    .map((record) => `${record.platform}/${record.architecture}:${record.signatureType}${record.notarized ? '+notarized' : ''}`)
    .join(', ')}`,
)
