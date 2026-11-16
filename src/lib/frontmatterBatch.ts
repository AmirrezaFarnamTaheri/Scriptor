/** Build one atomic note update from simple frontmatter edits. Never rewrite the body. */
export function applyFrontmatterChanges(markdown: string, updates: Record<string, string>): string {
  const changed = Object.entries(updates)
  if (changed.length === 0) return markdown
  const eol = markdown.includes('\r\n') ? '\r\n' : '\n'
  const lines = markdown.split(/\r?\n/)
  if (lines[0] !== '---') throw new Error('The note has no simple frontmatter block. Edit its source instead.')
  const end = lines.findIndex((line, index) => index > 0 && (line === '---' || line === '...'))
  if (end < 0) throw new Error('Close the frontmatter delimiter in the source editor first.')
  for (const [field, value] of changed) {
    if (!/^[\p{L}\p{N}_-]{1,128}$/u.test(field) || value.length > 65_536 || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error(`Invalid single-line frontmatter value for ${field}.`)
    }
    const matches: number[] = []
    for (let i = 1; i < end; i += 1) {
      const line = lines[i]!
      if (line.startsWith(`${field}:`)) matches.push(i)
      else if (line.split(':', 1)[0]?.trim() === field) {
        throw new Error(`${field} uses complex YAML key syntax. Edit the source instead.`)
      }
    }
    if (matches.length !== 1) throw new Error(`${field} has a missing or duplicate YAML key. Edit its source instead.`)
    const index = matches[0]!
    const existing = lines[index]!.slice(field.length + 1).trim()
    if (/^[|>]/.test(existing) || (index + 1 < end && /^[ \t]+\S/.test(lines[index + 1]!))) {
      throw new Error(`${field} has a structured value. Edit the source instead.`)
    }
    const scalar = /^[\p{L}\p{N}_./-]+$/u.test(value) ? value : JSON.stringify(value)
    lines[index] = `${field}: ${scalar}`
  }
  return lines.join(eol)
}
