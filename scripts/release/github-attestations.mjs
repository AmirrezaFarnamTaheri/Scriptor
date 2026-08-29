export const PROVENANCE_PREDICATE_TYPE = 'https://slsa.dev/provenance/v1'
export const CYCLONEDX_PREDICATE_TYPE = 'https://cyclonedx.org/bom'

export function buildAttestationVerifyCommands({ subjects, repository, sourceDigest, sourceRef, signerWorkflow }) {
  if (!Array.isArray(subjects) || subjects.length === 0) throw new Error('attestation verification requires subjects')
  for (const [name, value] of Object.entries({ repository, sourceDigest, sourceRef, signerWorkflow })) {
    if (!String(value ?? '').trim()) throw new Error(`attestation verification requires ${name}`)
  }
  return subjects.flatMap((subject) => [PROVENANCE_PREDICATE_TYPE, CYCLONEDX_PREDICATE_TYPE].map((predicateType) => ({
    subject,
    predicateType,
    args: [
      'attestation', 'verify', subject,
      '--repo', repository,
      '--predicate-type', predicateType,
      '--source-digest', sourceDigest,
      '--source-ref', sourceRef,
      '--signer-workflow', signerWorkflow,
      '--deny-self-hosted-runners',
      '--format', 'json',
    ],
  })))
}

function normalizedSubjectDigest(entry) {
  const subjects = entry?.verificationResult?.statement?.subject
  if (!Array.isArray(subjects)) return []
  return subjects.map((subject) => String(subject?.digest?.sha256 ?? '').toLowerCase()).filter(Boolean)
}

export function verifyGithubAttestations({ subjects, repository, sourceDigest, sourceRef, signerWorkflow, execute }) {
  if (typeof execute !== 'function') throw new Error('attestation verification requires an executor')
  const commands = buildAttestationVerifyCommands({
    subjects: subjects.map((subject) => subject.path),
    repository,
    sourceDigest,
    sourceRef,
    signerWorkflow,
  })
  const byPath = new Map(subjects.map((subject) => [subject.path, {
    path: subject.path,
    sha256: subject.sha256,
    provenanceVerified: false,
    sbomVerified: false,
  }]))

  for (const command of commands) {
    let parsed
    try {
      parsed = JSON.parse(execute(command))
    } catch (error) {
      throw new Error(`invalid attestation verification output for ${command.subject}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(`no verified attestations for ${command.subject} (${command.predicateType})`)
    }
    const expected = byPath.get(command.subject)
    if (!expected) throw new Error(`unexpected attestation subject: ${command.subject}`)
    const matching = parsed.filter((entry) => entry?.verificationResult?.statement?.predicateType === command.predicateType)
    if (matching.length === 0) throw new Error(`verified attestation predicate mismatch for ${command.subject}`)
    if (matching.every((entry) => !normalizedSubjectDigest(entry).includes(expected.sha256.toLowerCase()))) {
      throw new Error(`verified attestation digest mismatch for ${command.subject}`)
    }
    if (command.predicateType === PROVENANCE_PREDICATE_TYPE) expected.provenanceVerified = true
    if (command.predicateType === CYCLONEDX_PREDICATE_TYPE) expected.sbomVerified = true
  }

  const results = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))
  if (results.some((result) => !result.provenanceVerified || !result.sbomVerified)) {
    throw new Error('not every release subject has both verified provenance and SBOM attestations')
  }
  return {
    schemaVersion: 1,
    repository,
    sourceDigest,
    sourceRef,
    signerWorkflow,
    subjects: results,
    pass: true,
  }
}
