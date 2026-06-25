export interface OutlineHeading {
  label: string
  level: number
  line: number
}

export function extractOutline(markdown: string): OutlineHeading[] {
  return markdown
    .split('\n')
    .map((line, index) => {
      const match = line.match(/^(#+)\s+(.*)$/)
      if (!match) return null
      return {
        level: match[1].length,
        label: match[2].trim(),
        line: index + 1,
      }
    })
    .filter((entry): entry is OutlineHeading => entry !== null)
}
