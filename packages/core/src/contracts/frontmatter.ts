export interface FrontmatterAnalysis {
  valid: boolean
  error?: string
  /** 1-based line numbers to highlight in the gutter */
  warningLines: number[]
}

/**
 * Checks if markdown begins with a valid YAML frontmatter block delimiter.
 */
export function hasFrontmatter(markdown: string): boolean {
  const source = markdown.replace(/^\uFEFF/, '')
  return source.startsWith('---\n') || source.startsWith('---\r\n')
}

/**
 * Extracts raw YAML text between frontmatter delimiters `---` if present.
 */
export function extractFrontmatterYaml(markdown: string): string | null {
  const match = markdown.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return match ? match[1] : null
}

/**
 * Parses scalar key-value frontmatter fields used for inspector previews and metadata cards.
 */
export function parseSimpleFrontmatter(markdown: string): Record<string, string> {
  const yaml = extractFrontmatterYaml(markdown)
  if (!yaml) return {}
  const fields: Record<string, string> = {}
  for (const line of yaml.split('\n')) {
    const keyValue = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (keyValue) {
      fields[keyValue[1]] = keyValue[2].trim()
    }
  }
  return fields
}

/**
 * Analyzes frontmatter syntax and reports 1-based line numbers with invalid syntax.
 * Mirrors `crates/indexer/src/parse.rs` frontmatter validation for live editor feedback.
 */
export function analyzeFrontmatter(markdown: string): FrontmatterAnalysis {
  const source = markdown.replace(/^\uFEFF/, '')
  if (!source.startsWith('---\n') && !source.startsWith('---\r\n')) {
    return { valid: true, warningLines: [] }
  }

  const lines = source.split(/\r?\n/)
  if (lines.length < 2) {
    return { valid: false, error: 'unterminated frontmatter', warningLines: [1] }
  }

  let endIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      endIndex = index
      break
    }
  }

  if (endIndex === -1) {
    return { valid: false, error: 'unterminated frontmatter', warningLines: [1] }
  }

  const warningLines: number[] = []
  for (let index = 1; index < endIndex; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue
    }
    // Block-sequence items (`- item`) and indented continuation lines are
    // valid YAML without a `key:` separator.
    if (/^\s*-(\s|$)/.test(line) || /^\s/.test(line)) {
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
