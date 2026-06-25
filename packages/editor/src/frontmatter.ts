export interface FrontmatterAnalysis {
  valid: boolean
  error?: string
  /** 1-based line numbers to highlight in the gutter */
  warningLines: number[]
}

/** Mirrors `crates/indexer/src/parse.rs` frontmatter validation for live editor feedback. */
export function analyzeFrontmatter(markdown: string): FrontmatterAnalysis {
  if (!markdown.startsWith('---\n') && !markdown.startsWith('---\r\n')) {
    return { valid: true, warningLines: [] }
  }

  const lines = markdown.split(/\r?\n/)
  if (lines.length < 2) {
    return { valid: false, error: 'unterminated frontmatter', warningLines: [1] }
  }

  let endIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') {
      endIndex = index
      break
    }
  }

  if (endIndex === -1) {
    return { valid: false, error: 'unterminated frontmatter', warningLines: [1] }
  }

  const warningLines: number[] = []
  for (let index = 1; index < endIndex; index += 1) {
    const trimmed = lines[index].trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue
    }
    if (!trimmed.includes(':')) {
      warningLines.push(index + 1)
    }
  }

  if (warningLines.length > 0) {
    return { valid: false, error: 'invalid frontmatter syntax', warningLines }
  }

  return { valid: true, warningLines: [] }
}
