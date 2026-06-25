export function offsetIsoDate(iso: string, dayOffset: number): string {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + dayOffset)
  return date.toISOString().slice(0, 10)
}

export function previewDailyTokens(format: string, isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`)
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
