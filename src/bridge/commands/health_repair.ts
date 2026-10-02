import { invoke } from '@tauri-apps/api/core'
import { requireNative } from '../native'
import { authorizeSensitiveOperation } from './authorization'
import {
  parseHealthRepairPlan, parseHealthRepairReceipt,
  type HealthRepairPlan, type HealthRepairReceipt, type HealthRepairRequest,
} from '../../lib/healthRepair'

export async function healthRepairPlan(vaultId: string, request: HealthRepairRequest): Promise<HealthRepairPlan> {
  requireNative()
  const plan = parseHealthRepairPlan(await invoke('health_repair_plan', { expectedVaultId: vaultId, request }))
  if (plan.vault_id !== vaultId || plan.request.path !== request.path || plan.request.kind !== request.kind) throw new Error('Repair preview belongs to another request. Review it again.')
  return plan
}

export async function healthRepairApply(plan: HealthRepairPlan): Promise<HealthRepairReceipt> {
  requireNative()
  const reviewed = parseHealthRepairPlan(plan)
  const authorizationToken = await authorizeSensitiveOperation('apply_bulk_fix', reviewed.fingerprint)
  const receipt = parseHealthRepairReceipt(await invoke('health_repair_apply', {
    expectedVaultId: reviewed.vault_id, request: reviewed.request,
    expectedFingerprint: reviewed.fingerprint, authorizationToken,
  }))
  if (receipt.vault_id !== reviewed.vault_id || receipt.path !== reviewed.request.path) throw new Error('Repair receipt belongs to another request. Refresh recovery history.')
  return receipt
}

export async function healthRepairReceipts(vaultId: string): Promise<HealthRepairReceipt[]> {
  requireNative()
  const payload: unknown = await invoke('health_repair_receipts', { expectedVaultId: vaultId })
  if (!Array.isArray(payload) || payload.length > 200) throw new Error('Invalid recovery history.')
  return payload.map(value => {
    const receipt = parseHealthRepairReceipt(value)
    if (receipt.vault_id !== vaultId) throw new Error('Recovery history belongs to another vault.')
    return receipt
  })
}

export async function healthRepairRestore(receipt: HealthRepairReceipt): Promise<void> {
  requireNative()
  const reviewed = parseHealthRepairReceipt(receipt)
  if (!reviewed.after_hash || !reviewed.kind) throw new Error('Recovery receipt lacks source verification. Reload recovery history before restoring.')
  const authorizationToken = await authorizeSensitiveOperation('restore_history', reviewed.id)
  await invoke('health_repair_restore', { expectedVaultId: reviewed.vault_id, receiptId: reviewed.id, expectedReceipt: reviewed, authorizationToken })
}
