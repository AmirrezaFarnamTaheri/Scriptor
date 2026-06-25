export interface EditorLintMessage {
  line: number
  column: number
  endLine?: number
  endColumn?: number
  message: string
  ruleId: string
  severity: 'error' | 'warning' | 'info'
  source: 'remark-lint' | 'link-reference' | 'editor'
}

const TRAILING_SPACE = /[ \t]+$/
const HEADING_EMPTY = /^(#{1,6})\s*$/
const HEADING_JUMP = /^(#{1,6})\s/

/** Remark-lint style rules without pulling the full remark-lint dependency tree. */
export function lintMarkdownDocument(markdown: string): EditorLintMessage[] {
  const messages: EditorLintMessage[] = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let lastHeadingLevel = 0
  let inFence = false

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1
    const line = lines[index] ?? ''
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      inFence = !inFence
    }
    if (inFence) continue

    if (TRAILING_SPACE.test(line) && line.trim().length > 0) {
      messages.push({
        line: lineNumber,
        column: line.search(TRAILING_SPACE) + 1,
        message: 'Trailing whitespace',
        ruleId: 'no-trailing-spaces',
        severity: 'warning',
        source: 'remark-lint',
      })
    }

    if (line.length > 120 && !trimmed.startsWith('```')) {
      messages.push({
        line: lineNumber,
        column: 121,
        message: 'Line exceeds 120 characters',
        ruleId: 'maximum-line-length',
        severity: 'warning',
        source: 'remark-lint',
      })
    }

    const heading = HEADING_EMPTY.exec(line) ?? HEADING_JUMP.exec(line)
    if (heading) {
      const level = heading[1]?.length ?? 0
      if (HEADING_EMPTY.test(line)) {
        messages.push({
          line: lineNumber,
          column: 1,
          message: 'Empty heading',
          ruleId: 'no-empty-heading',
          severity: 'error',
          source: 'remark-lint',
        })
      } else if (level > lastHeadingLevel + 1 && lastHeadingLevel > 0) {
        messages.push({
          line: lineNumber,
          column: 1,
          message: `Heading level jumps from H${lastHeadingLevel} to H${level}`,
          ruleId: 'heading-increment',
          severity: 'warning',
          source: 'remark-lint',
        })
      }
      lastHeadingLevel = level
    }
  }

  messages.push(...lintLinkReferences(markdown))
  return messages
}

const REF_DEF = /^\[([^\]]+)\]:\s+(\S+)/gm
const REF_USAGE = /\[([^\]]+)\](?!\()/g

function isFoamReferenceUsage(markdown: string, match: RegExpExecArray): boolean {
  const label = match[1]!
  if (label.startsWith('!') || label.startsWith('@')) return false
  const index = match.index
  if (index > 0 && markdown[index - 1] === '[') return false
  const after = index + match[0].length
  if (after < markdown.length && markdown[after] === ']') return false
  return true
}

export function lintLinkReferences(markdown: string): EditorLintMessage[] {
  const messages: EditorLintMessage[] = []
  const definitions = new Map<string, number>()
  let match: RegExpExecArray | null
  const defPattern = new RegExp(REF_DEF.source, REF_DEF.flags)
  while ((match = defPattern.exec(markdown)) !== null) {
    definitions.set(match[1]!.toLowerCase(), lineAt(markdown, match.index))
  }

  const usagePattern = new RegExp(REF_USAGE.source, REF_USAGE.flags)
  while ((match = usagePattern.exec(markdown)) !== null) {
    if (!isFoamReferenceUsage(markdown, match)) continue
    const label = match[1]!
    if (!definitions.has(label.toLowerCase())) {
      messages.push({
        line: lineAt(markdown, match.index),
        column: match.index - markdown.lastIndexOf('\n', match.index),
        message: `Missing link reference definition for [${label}]`,
        ruleId: 'foam-missing-reference',
        severity: 'warning',
        source: 'link-reference',
      })
    }
  }

  for (const [label, line] of definitions) {
    const usage = new RegExp(`\\[${escapeRegExp(label)}\\](?!\\()`, 'gi')
    if (!usage.test(markdown)) {
      messages.push({
        line,
        column: 1,
        message: `Unused link reference definition [${label}]`,
        ruleId: 'foam-unused-reference',
        severity: 'info',
        source: 'link-reference',
      })
    }
  }

  return messages
}

export function generateLinkReferenceDefinitions(markdown: string): string {
  const existing = new Set<string>()
  let match: RegExpExecArray | null
  const defPattern = new RegExp(REF_DEF.source, REF_DEF.flags)
  while ((match = defPattern.exec(markdown)) !== null) {
    existing.add(match[1]!.toLowerCase())
  }

  const additions: string[] = []
  const usagePattern = new RegExp(REF_USAGE.source, REF_USAGE.flags)
  while ((match = usagePattern.exec(markdown)) !== null) {
    const label = match[1]!
    if (label.startsWith('!') || existing.has(label.toLowerCase())) continue
    existing.add(label.toLowerCase())
    const slug = label.trim().toLowerCase().replace(/\s+/g, '-')
    additions.push(`[${label}]: ${slug}.md`)
  }

  if (additions.length === 0) return markdown
  const suffix = markdown.endsWith('\n') ? '' : '\n'
  return `${markdown}${suffix}\n${additions.join('\n')}\n`
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
