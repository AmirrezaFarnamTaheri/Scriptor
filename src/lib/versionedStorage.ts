import { expectRecord, parseJsonUnknown } from './runtimeSchema'

interface StorageEnvelope<T> {
  schemaVersion: number
  savedAt: string
  data: T
}

interface ReadOptions<T> {
  key: string
  schemaVersion: number
  fallback: T
  validate: (value: unknown) => T
}

export function readVersionedStorage<T>({
  key,
  schemaVersion,
  fallback,
  validate,
}: ReadOptions<T>): T {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    const parsed = parseJsonUnknown(raw, `localStorage ${key}`)
    const record = expectRecord(parsed, `localStorage ${key}`)
    if (typeof record.schemaVersion === 'number' && 'data' in record) {
      if (record.schemaVersion !== schemaVersion) {
        throw new Error(`unsupported schema version ${record.schemaVersion}`)
      }
      return validate(record.data)
    }
    throw new Error('storage value is missing the current schema envelope')
  } catch (error) {
    quarantineStorageValue(key, raw, error)
    return fallback
  }
}

export function writeVersionedStorage<T>(key: string, schemaVersion: number, data: T): void {
  const envelope: StorageEnvelope<T> = {
    schemaVersion,
    savedAt: new Date().toISOString(),
    data,
  }
  try {
    localStorage.setItem(key, JSON.stringify(envelope))
  } catch {
    // Storage may be unavailable or full; runtime state remains authoritative.
  }
}

function quarantineStorageValue(key: string, raw: string, error: unknown): void {
  const quarantineKey = `${key}:corrupt:${Date.now()}`
  try {
    localStorage.setItem(
      quarantineKey,
      JSON.stringify({
        sourceKey: key,
        quarantinedAt: new Date().toISOString(),
        reason: error instanceof Error ? error.message : String(error),
        raw,
      }),
    )
    localStorage.removeItem(key)
  } catch {
    // If storage itself is failing, avoid cascading into application startup.
  }
}
