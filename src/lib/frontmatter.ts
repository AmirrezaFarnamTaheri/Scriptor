/** Parse the simple scalar frontmatter fields used by the inspector preview. */
export function parseSimpleFrontmatter(markdown: string): Record<string, string> {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const fields: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const keyValue = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (keyValue) fields[keyValue[1]] = keyValue[2]
  }
  return fields
}
