/** Find an unused default name even when users delete or rename existing entries. */
export function nextAvailableSnippetName(snippets: readonly { name: string }[]): string {
  const existing = new Set(snippets.map(({ name }) => name.trim().toLowerCase()))
  let index = 1
  while (existing.has(`snippet-${index}`)) index += 1
  return `snippet-${index}`
}

/** Names are case-insensitive and are trimmed by the native vault reader. */
export function snippetNameTaken(
  snippets: readonly { name: string }[],
  currentName: string | null,
  candidate: string,
): boolean {
  const normalized = candidate.trim().toLowerCase()
  return normalized.length > 0 && snippets.some(({ name }) =>
    name !== currentName && name.trim().toLowerCase() === normalized,
  )
}
