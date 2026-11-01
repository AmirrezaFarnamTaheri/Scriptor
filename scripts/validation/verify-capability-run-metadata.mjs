#!/usr/bin/env node
/**
 * Usage: GITHUB_TOKEN=... node scripts/validation/verify-capability-run-metadata.mjs packet.json
 * Exit 0: named step and run metadata matches the exact SHA (NOT graduation).
 * Exit 1: incomplete, failing or unverified metadata.
 * Exit 2: unable to perform the check.
 */
import { readFileSync } from 'node:fs'
import { createGithubRunProvider } from './capability-run-github.mjs'
import { verifyCapabilityWorkflowMetadata } from './capability-run-metadata.mjs'

async function main() {
  if (process.argv.length !== 3) {
    throw new Error('Expected one capability evidence JSON filename')
  }
  const packet = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  const provider = createGithubRunProvider(process.env.GITHUB_TOKEN)
  const result = await verifyCapabilityWorkflowMetadata(packet, provider)
  console.log(JSON.stringify({
    sourceHead: packet.sourceHead,
    capabilityId: packet.capabilityId,
    ...result,
    limitation: 'Run and named-step metadata only; no artifact byte provenance, real-provider or support-graduation proof.',
  }, null, 2))
  if (!result.runMetadataVerified) process.exitCode = 1
}

main().catch(error => {
  console.error('MAT-022 workflow metadata verification unavailable: ' +
    (error instanceof Error ? error.message : String(error)))
  process.exitCode = 2
})
