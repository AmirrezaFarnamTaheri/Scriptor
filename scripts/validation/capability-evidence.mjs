/** MAT-022: review the 8 capability gates without automatically promoting labels. */
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
  for (const [name, value] of [['owner', packet.owner], ['supportWindow', packet.supportWindow], ['contract.schemaPolicy', packet.contract?.schemaPolicy], ['authorization.model', packet.authorization?.model]]) {
    if (!nonblank(value)) missing.push(name)
  }
  for (const name of GATES) if (!goodProof(packet.tests?.[name], packet.sourceHead)) missing.push('tests.' + name)
  if (!goodProof(packet.authorization?.privacyReview, packet.sourceHead)) missing.push('authorization.privacyReview')
  if (!goodProof(packet.performance, packet.sourceHead)) missing.push('performance')
  if (!goodProof(packet.release?.inclusion, packet.sourceHead)) missing.push('release.inclusion')
  if (!goodProof(packet.release?.installed, packet.sourceHead)) missing.push('release.installed')
  return { readyForHumanReview: missing.length === 0, missing }
}
