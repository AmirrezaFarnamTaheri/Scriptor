import { offsetLocalDate, parseLocalDate } from '@scriptor/core/date'

export function offsetIsoDate(iso: string, dayOffset: number): string {
  return offsetLocalDate(iso, dayOffset)
}

export function previewDailyTokens(format: string, isoDate: string): string {
  const date = parseLocalDate(isoDate)
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' })
  return format
    .replaceAll('{iso}', `${year}-${month}-${day}`)
    .replaceAll('{year}', year)
    .replaceAll('{month}', month)
    .replaceAll('{day}', day)
    .replaceAll('{weekday}', weekday)
}
