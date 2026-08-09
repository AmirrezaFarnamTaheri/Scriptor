import { invoke } from '@tauri-apps/api/core'

import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'

export type ResourceTargetStatus =
  | 'confirmed'
  | 'configured'
  | 'partial'
  | 'available'
  | 'conflicted'

export type ResourceSupportLevel = 'native' | 'compatible' | 'inventory_only'

export type ResourceEvidence =
  | {
      kind: 'executable'
      candidate: string
      path: string
      sha256: string | null
      version: string | null
      exitCode: number
    }
  | {
      kind: 'application'
      identity: string
      path: string
      sha256: string
    }
  | {
      kind: 'extension'
      host: string
      extensionId: string
      path: string
      version: string | null
      sha256: string | null
    }
  | {
      kind: 'config_root'
      path: string
      exists: boolean
      resourceCount: number
    }
  | {
      kind: 'probe_summary'
      message: string
    }

export interface ResourceInstallation {
  id: string
  identityKind: string
  path: string
  version: string | null
  sha256: string | null
}

export interface ResourceTarget {
  id: string
  label: string
  kind: 'registry' | 'cli' | 'ide' | 'extension' | 'universal'
  supportLevel: ResourceSupportLevel
  status: ResourceTargetStatus
  evidence: ResourceEvidence[]
  installations: ResourceInstallation[]
  resourceRoots: string[]
}

export interface ResourceInstance {
  id: string
  logicalId: string
  name: string
  kind: string
  targetId: string
  scope: string
  path: string
  manifestPath: string
  contentHash: string
  managed: boolean
  symlinked: boolean
  valid: boolean
  issues: string[]
}

export interface ResourceDuplicateGroup {
  logicalId: string
  kind: 'exact_mirror' | 'redundant' | 'diverged'
  instanceIds: string[]
  targetIds: string[]
  automaticRemovalAllowed: boolean
}

export interface ResourceInventory {
  generatedAtMs: number
  fingerprint: string
  targets: ResourceTarget[]
  resources: ResourceInstance[]
  duplicates: ResourceDuplicateGroup[]
}

export interface ResourcePlanOperation {
  id: string
  kind: 'install' | 'update' | 'noop' | 'quarantine_duplicate'
  targetId: string
  sourcePath: string
  destinationPath: string
  expectedSourceHash: string
  expectedDestinationHash: string | null
  summary: string
}

export interface ResourceSyncPlan {
  id: string
  createdAtMs: number
  expiresAtMs: number
  inventoryFingerprint: string
  sourceInstanceId: string
  operations: ResourcePlanOperation[]
  warnings: string[]
  planFingerprint: string
}

export interface ResourceApplyResult {
  planId: string
  status: 'completed' | 'partial' | 'failed'
  receipts: Array<{
    operationId: string
    targetId: string
    outcome: string
    destinationPath: string
    contentHash: string
    quarantinePath: string | null
  }>
  failures: Array<{
    operationId: string
    targetId: string
    category: string
    message: string
  }>
}

export async function resourceInventory(): Promise<ResourceInventory> {
  requireNative()
  return invoke<ResourceInventory>('resource_inventory')
}

export async function resourceCreatePlan(
  sourceInstanceId: string,
  targetIds: string[],
): Promise<ResourceSyncPlan> {
  requireNative()
  return invoke<ResourceSyncPlan>('resource_create_plan', {
    request: { sourceInstanceId, targetIds },
  })
}

export async function resourceCreateDedupPlan(
  canonicalInstanceId: string,
): Promise<ResourceSyncPlan> {
  requireNative()
  return invoke<ResourceSyncPlan>('resource_create_dedup_plan', { canonicalInstanceId })
}

export async function resourceApplyPlan(
  planId: string,
  maxParallel: number = 3,
): Promise<ResourceApplyResult> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('resource_sync', planId)
  return invoke<ResourceApplyResult>('resource_apply_plan', {
    planId,
    authorizationToken,
    maxParallel,
  })
}
