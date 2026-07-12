import type { RendererExtensionContribution } from '@scriptor/core/contracts/plugin'

const PUBLISH_CALLOUT_MARKER = '<!-- scriptor:publish-callout -->'

export function applyRendererExtensions(
  html: string,
  extensions: RendererExtensionContribution[],
): string {
  if (extensions.length === 0) {
    return html
  }

  let next = html
  if (extensions.some((extension) => extension.id === 'publish-callout')) {
    if (!next.includes(PUBLISH_CALLOUT_MARKER)) {
      next = `${PUBLISH_CALLOUT_MARKER}<aside class="publish-callout" role="note"><p>Publication preview enabled by Publish Pack.</p></aside>${next}`
    }
  }

  const badges = [...extensions]
    .sort((left, right) => right.priority - left.priority)
    .map(
      (extension) =>
        `<span class="renderer-extension-badge" data-extension="${escapeAttribute(extension.id)}">${escapeHtml(extension.label)}</span>`,
    )
    .join('')

  return `${next}<footer class="renderer-extension-footer" aria-hidden="true">${badges}</footer>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('`', '&#96;')
}
