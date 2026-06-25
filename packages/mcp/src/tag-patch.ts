const TAG_PATTERN = /(?:^|\s)#([A-Za-z0-9_/-]+)/g

export function extractHashtags(markdown: string): string[] {
  const tags = new Set<string>()
  for (const match of markdown.matchAll(TAG_PATTERN)) {
    const tag = match[1]?.trim()
    if (tag) tags.add(tag)
  }
  return [...tags].sort((left, right) => left.localeCompare(right))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
    const pattern = new RegExp(`(^|\\s)#${escapeRegExp(tag)}(?=\\s|$)`, 'gm')
    updated = updated.replace(pattern, '$1').replace(/[ \t]{2,}/g, ' ')
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
  return failures
}
