export type Clock = () => Date

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatLocalDate(date: Date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDate(isoDate: string): Date {
  const match = ISO_DATE.exec(isoDate)
  if (!match) throw new Error(`Invalid local ISO date: ${isoDate}`)
  const [, rawYear, rawMonth, rawDay] = match
  const year = Number(rawYear)
  const month = Number(rawMonth)
  const day = Number(rawDay)
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`Invalid local ISO date: ${isoDate}`)
  }
  return date
}

export function offsetLocalDate(isoDate: string, dayOffset: number): string {
  if (!Number.isInteger(dayOffset)) throw new Error(`dayOffset must be an integer: ${dayOffset}`)
  const date = parseLocalDate(isoDate)
  date.setDate(date.getDate() + dayOffset)
  return formatLocalDate(date)
}

export function millisecondsUntilNextLocalDate(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 25)
  return Math.max(1, next.getTime() - now.getTime())
}
