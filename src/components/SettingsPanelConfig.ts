import type { VaultConfig } from '../types/vault'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function mergeEditedValue(current: unknown, baseline: unknown, edited: unknown): unknown {
  if (valuesEqual(edited, baseline)) return current
  if (!isPlainRecord(current) || !isPlainRecord(baseline) || !isPlainRecord(edited)) return edited

  const next: Record<string, unknown> = { ...current }
  for (const key of Object.keys(edited)) {
    next[key] = mergeEditedValue(current[key], baseline[key], edited[key])
  }
  return next
}

export function mergeEditedVaultConfig(current: VaultConfig, baseline: VaultConfig, edited: VaultConfig): VaultConfig {
  return mergeEditedValue(current, baseline, edited) as VaultConfig
}
