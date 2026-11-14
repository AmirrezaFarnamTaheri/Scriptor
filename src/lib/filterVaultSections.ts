/** Empty matches for a nonempty query never reveal the entire vault. */
export function filterVaultSections<T extends { notes: string[]; count: number }>(
  sections: T[], query: string, results: Array<{ path: string }>,
): T[] {
  if (!query.trim()) return sections
  const paths = new Set(results.map((hit) => hit.path))
  return sections.map((section) => {
    const notes = section.notes.filter((note) => paths.has(note))
    return { ...section, notes, count: notes.length }
  }).filter((section) => section.count > 0)
}
