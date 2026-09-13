export function nextFootnoteId(markdown: string): string {
  const used = new Set<string>()
  for (const match of markdown.matchAll(/\[\^([^\]]+)\]/g)) {
    used.add(match[1] ?? '')
  }
  let index = 1
  while (used.has(String(index))) {
    index += 1
  }
  return String(index)
}

export function insertFootnoteIntoMarkdown(
  markdown: string,
  selectionStart: number,
  selectionEnd: number,
): { markdown: string; cursor: number } {
  const id = nextFootnoteId(markdown)
  const ref = `[^${id}]`
  const definition = `\n\n[^${id}]: `
  const hasDefinition = markdown.includes(`[^${id}]:`)
  const before = markdown.slice(0, selectionStart)
  const after = markdown.slice(selectionEnd)
  const nextMarkdown = hasDefinition ? `${before}${ref}${after}` : `${before}${ref}${after}${definition}`
  return { markdown: nextMarkdown, cursor: selectionStart + ref.length }
}
