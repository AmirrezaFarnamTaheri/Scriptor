import { assessCapabilityEvidence } from './capability-evidence.mjs'

/**
 * MAT-022: verifies that every referenced GitHub Actions run exists at the
 * recorded source commit and contains a successful, explicitly named case step.
 * This does NOT attest artifact bytes, native consent, real-provider semantics,
 * or capability support status. No automatic support label is written.
 */
const REPOSITORY = 'AmirrezaFarnamTaheri/Scriptor'
const RUN_PATH = /^\/AmirrezaFarnamTaheri\/Scriptor\/actions\/runs\/([1-9]\d*)(?:\/attempts\/([1-9]\d*))?\/?$/i
const CASE_PATHS = Object.freeze([
  'tests.positive', 'tests.negative', 'tests.restart',
  'tests.cancellation', 'tests.recovery',
  'authorization.privacyReview', 'performance',
  'release.inclusion', 'release.artifactSmoke',
])
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

function readProof(packet, name) {
  return name.split('.').reduce((value, key) => value?.[key], packet)
}

function runReferenceFromUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' ||
      parsed.username || parsed.password || parsed.port) return null
    const match = RUN_PATH.exec(parsed.pathname)
    if (!match) return null
    const id = Number(match[1])
    const attempt = match[2] === undefined ? null : Number(match[2])
    return Number.isSafeInteger(id) && id > 0 &&
      (attempt === null || (Number.isSafeInteger(attempt) && attempt > 0)) ? { id, attempt } : null
  } catch {
    return null
  }
}

function isExpectedSuccessfulRun(run, reference, sourceHead) {
  if (!isObject(run) || !reference) return false
  const canonicalUrl = runReferenceFromUrl(run.html_url)
  return run.id === reference.id &&
    typeof run.repository?.full_name === 'string' &&
    run.repository.full_name.toLowerCase() === REPOSITORY.toLowerCase() &&
    run.head_sha === sourceHead &&
    run.status === 'completed' && run.conclusion === 'success' &&
    Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0 &&
    canonicalUrl?.id === reference.id && canonicalUrl.attempt === null &&
    (reference.attempt === null || run.run_attempt === reference.attempt)
}

function hasPassingNamedStep(jobs, caseId, run) {
  return isObject(jobs) && Array.isArray(jobs.jobs) &&
    jobs.jobs.some(job => isObject(job) &&
      job.run_id === run.id && job.run_attempt === run.run_attempt &&
      job.status === 'completed' && job.conclusion === 'success' &&
      Array.isArray(job.steps) && job.steps.some(step =>
        isObject(step) && step.name === caseId &&
        step.status === 'completed' && step.conclusion === 'success'))
}

/**
 * getRun(id): return GitHub GET /actions/runs/{id} response.
 * getJobs(id): return GitHub GET /actions/runs/{id}/jobs response.
 * Missing, failed or unauthenticated APIs are unverified, never a pass.
 */
export async function verifyCapabilityWorkflowMetadata(packet, provider) {
  const index = assessCapabilityEvidence(packet)
  const base = {
    evidenceIndexComplete: index.evidenceIndexComplete,
    runMetadataVerified: false,
    verifiedCases: 0,
    unverified: [...index.missing],
    artifactProvenanceVerified: false,
    supportGraduated: false,
  }
  if (!index.evidenceIndexComplete) return base
  if (typeof provider?.getRun !== 'function' || typeof provider?.getJobs !== 'function') {
    throw new Error('GitHub workflow metadata provider is required')
  }

  const runCache = new Map()
  const jobCache = new Map()
  const readCached = async (cache, id, loader) => {
    if (!cache.has(id)) {
      cache.set(id, Promise.resolve().then(() => loader(id)).catch(() => null))
    }
    return cache.get(id)
  }
  const unverified = []
  let verifiedCases = 0
  for (const name of CASE_PATHS) {
    const proof = readProof(packet, name)
    const reference = runReferenceFromUrl(proof?.url)
    if (reference === null) {
      unverified.push(name)
      continue
    }
    const run = await readCached(runCache, reference.id, provider.getRun)
    if (!isExpectedSuccessfulRun(run, reference, packet.sourceHead)) {
      unverified.push(name)
      continue
    }
    const jobs = await readCached(jobCache, reference.id, provider.getJobs)
    if (!hasPassingNamedStep(jobs, proof.caseId, run)) {
      unverified.push(name)
      continue
    }
    verifiedCases += 1
  }
  return {
    ...base, runMetadataVerified: unverified.length === 0,
    verifiedCases, unverified,
  }
}
