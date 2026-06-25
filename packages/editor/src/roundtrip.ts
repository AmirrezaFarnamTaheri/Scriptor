export function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n').replace(/\s+$/gm, '').trimEnd()
}

export function roundTripEqual(before: string, after: string): boolean {
  return normalizeMarkdown(before) === normalizeMarkdown(after)
}
