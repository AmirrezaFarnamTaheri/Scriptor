export type JsonRecord = Record<string, unknown>

export function parseJsonUnknown(payload: string, context: string): unknown {
  try {
    return JSON.parse(payload) as unknown
  } catch (error) {
    throw new Error(`${context}: invalid JSON (${error instanceof Error ? error.message : String(error)})`, { cause: error })
  }
}

export function expectRecord(value: unknown, context: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${context}: expected an object`)
  }
  return value as JsonRecord
}

export function expectArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${context}: expected an array`)
  }
  return value
}

export function expectString(record: JsonRecord, key: string, context: string): string {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new Error(`${context}.${key}: expected a string`)
  }
  return value
}

export function expectNumber(record: JsonRecord, key: string, context: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context}.${key}: expected a finite number`)
  }
  return value
}

export function expectBoolean(record: JsonRecord, key: string, context: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') {
    throw new Error(`${context}.${key}: expected a boolean`)
  }
  return value
}

export function expectStringArray(value: unknown, context: string): string[] {
  return expectArray(value, context).map((item, index) => {
    if (typeof item !== 'string') {
      throw new Error(`${context}[${index}]: expected a string`)
    }
    return item
  })
}

export function parseArrayOf<T>(
  payload: string,
  context: string,
  parseItem: (value: unknown, context: string) => T,
): T[] {
  return expectArray(parseJsonUnknown(payload, context), context).map((value, index) =>
    parseItem(value, `${context}[${index}]`),
  )
}
