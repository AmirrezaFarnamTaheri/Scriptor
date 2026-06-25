export interface EmbedFetchContext {
  /** Resolve note path/title to markdown body. Host implements vault lookup. */
  fetchNote: (path: string) => Promise<string | null> | string | null
  /** Optional inner renderer for embedded note bodies (defaults to setting innerHTML as pre). */
  renderMarkdown?: (markdown: string) => string
}

function extractSection(markdown: string, section: string): string {
  const target = section.trim().toLowerCase()
  if (target.length === 0) return markdown

  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let start = -1
  let startDepth = 0

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index] ?? '')
    if (!match) continue
    const heading = (match[2] ?? '').trim().toLowerCase()
    if (heading === target || slugify(heading) === slugify(target)) {
      start = index + 1
      startDepth = match[1]?.length ?? 1
      break
    }
  }

  if (start < 0) return markdown

  let end = lines.length
  for (let index = start; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s/.exec(lines[index] ?? '')
    if (!match) continue
    const depth = match[1]?.length ?? 1
    if (depth <= startDepth) {
      end = index
      break
    }
  }

  return lines.slice(start, end).join('\n').trim()
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function renderFallback(markdown: string): string {
  return `<div class="wikilink-embed-body">${markdown
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')}</div>`
}

/** Hydrate `data-wikilink-embed` placeholders by fetching note content from the host. */
export async function hydrateWikilinkEmbeds(
  root: HTMLElement,
  ctx: EmbedFetchContext,
): Promise<void> {
  const embeds = root.querySelectorAll<HTMLElement>('[data-wikilink-embed="true"]')
  if (embeds.length === 0) return

  for (const embed of embeds) {
    const target = embed.getAttribute('data-wikilink-target')?.trim() ?? ''
    const section = embed.getAttribute('data-wikilink-section')?.trim() ?? ''
    if (target.length === 0 && section.length === 0) {
      embed.replaceChildren(createMessage('Missing wikilink embed target'))
      continue
    }

    try {
      const fetched = await ctx.fetchNote(target)
      if (fetched == null || fetched.trim().length === 0) {
        embed.replaceChildren(createMessage(`Note not found: ${target || `#${section}`}`))
        continue
      }

      const body = section.length > 0 ? extractSection(fetched, section) : fetched
      const html = ctx.renderMarkdown ? ctx.renderMarkdown(body) : renderFallback(body)
      embed.innerHTML = html
      embed.classList.add('wikilink-embed-loaded')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Embed failed'
      embed.replaceChildren(createMessage(message))
    }
  }
}

function createMessage(text: string): HTMLElement {
  const message = document.createElement('p')
  message.className = 'wikilink-embed-error'
  message.textContent = text
  return message
}
