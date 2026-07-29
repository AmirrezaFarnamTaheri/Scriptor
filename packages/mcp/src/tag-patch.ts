const TAG_PATTERN = /(?:^|\s)#([\p{L}\p{N}_/-]+)/gu

/** Character ranges of fenced code blocks (delimiters included). */
function fencedRanges(markdown: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = []
  let offset = 0
  let fenceStart = -1
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      if (fenceStart < 0) {
        fenceStart = offset
      } else {
        ranges.push({ from: fenceStart, to: offset + line.length })
        fenceStart = -1
      }
    }
    offset += line.length + 1
  }
  if (fenceStart >= 0) {
    ranges.push({ from: fenceStart, to: markdown.length })
  }
  return ranges
}

function inFencedRange(ranges: Array<{ from: number; to: number }>, index: number): boolean {
  return ranges.some((range) => index >= range.from && index < range.to)
}

export function extractHashtags(markdown: string): string[] {
  const tags = new Set<string>()
  const fences = fencedRanges(markdown)
  for (const match of markdown.matchAll(TAG_PATTERN)) {
    if (inFencedRange(fences, match.index ?? 0)) continue
    const tag = match[1]?.trim()
    if (tag) tags.add(tag)
  }
  return [...tags].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Remove every standalone `#tag` occurrence outside fenced code, cleaning up
 * only the whitespace adjacent to each removed tag — never the rest of the
 * document (code-block indentation and table alignment must survive).
 */
function removeTagOccurrences(markdown: string, tag: string): string {
  const pattern = new RegExp(`(^|\\s)#${escapeRegExp(tag)}(?=\\s|$)`, 'gm')
  const fences = fencedRanges(markdown)
  let result = ''
  let cursor = 0
  for (const match of markdown.matchAll(pattern)) {
    const matchStart = match.index ?? 0
    const prefix = match[1] ?? ''
    const tagStart = matchStart + prefix.length
    if (inFencedRange(fences, tagStart)) continue
    const start = Math.max(matchStart, cursor)
    result += markdown.slice(cursor, start)
    let end = matchStart + match[0].length
    const inlinePrefix = prefix === ' ' || prefix === '\t'
    if (inlinePrefix) {
      // Drop the single leading space; any trailing whitespace still separates
      // the surrounding words.
    } else {
      // Line start: keep the prefix (newline or nothing) and swallow the
      // spaces that followed the tag so lines do not gain leading whitespace.
      result += markdown.slice(start, tagStart)
      while (end < markdown.length && (markdown[end] === ' ' || markdown[end] === '\t')) {
        end += 1
      }
    }
    cursor = end
  }
  result += markdown.slice(cursor)
  return result
}

export function applyTagPatch(
  markdown: string,
  add: string[] = [],
  remove: string[] = [],
): { markdown: string; tags: string[] } {
  const normalizedAdd = add.map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean)
  const normalizedRemove = new Set(remove.map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean))

  let updated = markdown
  for (const tag of normalizedRemove) {
    updated = removeTagOccurrences(updated, tag)
  }

  const existing = new Set(extractHashtags(updated))
  const toAdd = normalizedAdd.filter((tag) => !existing.has(tag) && !normalizedRemove.has(tag))
  if (toAdd.length > 0) {
    const suffix = toAdd.map((tag) => `#${tag}`).join(' ')
    updated = `${updated.trimEnd()}\n\n${suffix}\n`
  }

  return {
    markdown: updated,
    tags: extractHashtags(updated),
  }
}

export function runTagPatchTests(): string[] {
  const failures: string[] = []
  const added = applyTagPatch('# Note\n', ['research'])
  if (!added.markdown.includes('#research')) {
    failures.push('tag patch should append hashtag')
  }
  const removed = applyTagPatch('# Note\n\n#draft #research\n', [], ['draft'])
  if (removed.tags.includes('draft') || !removed.tags.includes('research')) {
    failures.push('tag patch should remove hashtag')
  }
  if (!removed.markdown.includes('\n#research\n')) {
    failures.push('tag removal should not leave stray whitespace')
  }

  const indented = applyTagPatch('# Note\n\n    let x =  1\n\n| a  | b |\n\n#draft\n', [], ['draft'])
  if (!indented.markdown.includes('    let x =  1') || !indented.markdown.includes('| a  | b |')) {
    failures.push('tag removal must not collapse whitespace outside the removed span')
  }

  const fenced = applyTagPatch('```\n#keep me\n```\n\n#draft\n', [], ['keep', 'draft'])
  if (!fenced.markdown.includes('#keep me')) {
    failures.push('tag removal should skip fenced code regions')
  }
  if (fenced.tags.includes('keep') || fenced.tags.includes('draft')) {
    failures.push('extractHashtags should skip fenced code and removed tags')
  }

  const unicode = applyTagPatch('note\n', ['日本語'])
  if (!unicode.tags.includes('日本語')) {
    failures.push('non-ASCII tags should be extracted')
  }
  const unicodeRemoved = applyTagPatch(unicode.markdown, [], ['日本語'])
  if (unicodeRemoved.tags.includes('日本語')) {
    failures.push('non-ASCII tags should be removable')
  }

  const sorted = applyTagPatch('#beta #alpha #Alpha\n')
  const resorted = [...sorted.tags].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
  if (sorted.tags.join(',') !== resorted.join(',')) {
    failures.push('tags should be returned in deterministic codepoint order')
  }

  return failures
}
