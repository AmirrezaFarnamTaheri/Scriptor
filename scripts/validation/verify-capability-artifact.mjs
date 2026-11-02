#!/usr/bin/env node
/**
 * Read-only source-bound Actions archive verification.
 * GITHUB_TOKEN=<read-actions-token> node scripts/validation/verify-capability-artifact.mjs proof.json
 * Exit 0: exact archive ZIP byte digest verified (NOT capability graduation).
 * Exit 1: proof is incomplete, stale, expired or mismatched.
 * Exit 2: invocation/credential error prevents verification.
 */
import { readFileSync } from 'node:fs'
import { createGithubArtifactProvider } from './capability-artifact-github.mjs'
import { verifyGithubArtifactProvenance } from './capability-artifact-digest.mjs'

async function main() {
  if (process.argv.length !== 3) throw new Error('Expected one artifact proof JSON filename')
  const proof = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  const provider = createGithubArtifactProvider(process.env.GITHUB_TOKEN)
  const result = await verifyGithubArtifactProvenance(proof, provider)
  console.log(JSON.stringify({
    sourceHead: proof.sourceHead, runId: proof.runId,
    artifactId: proof.artifactId, artifactName: proof.artifactName,
    ...result,
    limitation: 'ZIP byte integrity only, not artifact execution, native consent, runtime behavior or capability graduation.',
  }, null, 2))
  if (!result.artifactDigestVerified) process.exitCode = 1
}

main().catch(error => {
  console.error('MAT-022 artifact integrity verification unavailable: ' +
    (error instanceof Error ? error.message : String(error)))
  process.exitCode = 2
})
