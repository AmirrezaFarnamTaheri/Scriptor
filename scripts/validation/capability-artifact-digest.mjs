import { createHash } from 'node:crypto'

/** Verifies downloaded archive bytes, not merely Actions metadata or labels. */
const REPOSITORY = 'AmirrezaFarnamTaheri/Scriptor'
const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const validId = value => Number.isSafeInteger(value) && value > 0
const validHead = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
const validDigest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const validName = value => typeof value === 'string' && value !== '.' && value !== '..' &&
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
const base = Object.freeze({ artifactDigestVerified: false, verifiedBytes: 0, supportGraduated: false })

/**
 * Requires three read-only provider methods. The caller must use the official
 * repository API to load run and artifact metadata and stream the ZIP bytes.
 * The returned success does not assert that this archive was executed or that
 * the tests inside a job actually exercised a claimed capability.
 */
export async function verifyGithubArtifactProvenance(proof, provider) {
  if (!isObject(proof) || !validHead(proof.sourceHead) || !validId(proof.runId) ||
    !validId(proof.artifactId) || !validName(proof.artifactName) || !validDigest(proof.sha256) ||
    typeof provider?.getRun !== 'function' || typeof provider?.getArtifact !== 'function' ||
    typeof provider?.downloadArchive !== 'function') return base

  try {
    const run = await provider.getRun(proof.runId)
    if (!isObject(run) || run.id !== proof.runId || run.status !== 'completed' ||
      run.conclusion !== 'success' || run.head_sha !== proof.sourceHead ||
      typeof run.repository?.full_name !== 'string' ||
      run.repository.full_name.toLowerCase() !== REPOSITORY.toLowerCase() ||
      run.html_url !== `https://github.com/${REPOSITORY}/actions/runs/${proof.runId}`) return base

    const artifact = await provider.getArtifact(proof.artifactId)
    if (!isObject(artifact) || artifact.id !== proof.artifactId ||
      artifact.name !== proof.artifactName || artifact.expired !== false ||
      !Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes < 1 ||
      artifact.size_in_bytes > MAX_ARCHIVE_BYTES ||
      artifact.url !== `https://api.github.com/repos/${REPOSITORY}/actions/artifacts/${proof.artifactId}` ||
      artifact.archive_download_url !== `https://api.github.com/repos/${REPOSITORY}/actions/artifacts/${proof.artifactId}/zip` ||
      !isObject(artifact.workflow_run) || artifact.workflow_run.id !== proof.runId ||
      artifact.workflow_run.head_sha !== proof.sourceHead ||
      artifact.digest !== `sha256:${proof.sha256}`) return base

    let bytes = 0
    const digest = createHash('sha256')
    const chunks = await provider.downloadArchive(proof.artifactId)
    for await (const chunk of chunks) {
      if (!(chunk instanceof Uint8Array)) return base
      bytes += chunk.byteLength
      if (bytes > MAX_ARCHIVE_BYTES || bytes > artifact.size_in_bytes) return base
      digest.update(chunk)
    }
    if (bytes !== artifact.size_in_bytes || digest.digest('hex') !== proof.sha256) return base
    return { artifactDigestVerified: true, verifiedBytes: bytes, supportGraduated: false }
  } catch {
    // A missing, revoked, rate-limited or interrupted provider is unverified.
    return base
  }
}
