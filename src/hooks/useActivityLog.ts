export interface ActivityEntry {
  id: string
  ts: number
  kind: 'info' | 'success' | 'error' | 'job'
  message: string
  detail?: string
}

export function createActivityEntry(
  kind: ActivityEntry['kind'],
  message: string,
  detail?: string,
): ActivityEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    kind,
    message,
    detail,
  }
}
