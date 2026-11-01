/** MAT-022: index eight automated evidence gates without promoting support. */
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const nonblank = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 500
const relativePath = path => typeof path === 'string' && path.length <= 500 && path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !path.includes(':') && path.split('/').every(p => p !== '' && p !== '.' && p !== '..')
const SHA = /^[a-f\d]{40}$/i
const GATES = ['positive', 'negative', 'restart', 'cancellation', 'recovery']
const SOURCE_REPO_RUN = /^\/AmirrezaFarnamTaheri\/Scriptor\/actions\/runs\/[1-9]\d*(?:\/.*)?$/i
function goodProof(p, head) {
  if (!isObject(p) || p.result !== 'passed' || p.sha !== head || !nonblank(p.caseId)) return false
  if (!nonblank(p.url)) return false
  try {
    const u = new URL(p.url)
    return u.protocol === 'https:' && u.hostname === 'github.com' &&
      !u.username && !u.password && !u.port && SOURCE_REPO_RUN.test(u.pathname)
  } catch { return false }
}
/** An evidence-index completeness check, not an attestation or a release decision. */
export function assessCapabilityEvidence(packet) {
  if (!isObject(packet) || packet.schemaVersion !== 1) throw new Error('Unsupported capability evidence schema')
  if (!nonblank(packet.capabilityId) || !/^[a-z0-9_-]+$/.test(packet.capabilityId)) throw new Error('Invalid capability identity')
  if (typeof packet.sourceHead !== 'string' || !SHA.test(packet.sourceHead)) throw new Error('Invalid exact source head commit')
  for (const p of [packet.contract?.path, packet.docs?.user, packet.docs?.operator, packet.changelog]) {
    if (!relativePath(p)) throw new Error('Invalid capability evidence document path')
  }
  const missing = []
  const usedCaseIds = new Set()
  const requireIndependentProof = (proof, name) => {
    if (!goodProof(proof, packet.sourceHead) || usedCaseIds.has(proof.caseId)) {
      missing.push(name)
      return
    }
    usedCaseIds.add(proof.caseId)
  }
  for (const [name, value] of [['owner', packet.owner], ['supportWindow', packet.supportWindow], ['contract.schemaPolicy', packet.contract?.schemaPolicy], ['authorization.model', packet.authorization?.model]]) {
    if (!nonblank(value)) missing.push(name)
  }
  for (const name of GATES) requireIndependentProof(packet.tests?.[name], 'tests.' + name)
  requireIndependentProof(packet.authorization?.privacyReview, 'authorization.privacyReview')
  requireIndependentProof(packet.performance, 'performance')
  requireIndependentProof(packet.release?.inclusion, 'release.inclusion')
  requireIndependentProof(packet.release?.artifactSmoke, 'release.artifactSmoke')
  return { evidenceIndexComplete: missing.length === 0, missing }
}
