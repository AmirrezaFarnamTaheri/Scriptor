export interface PreviewPostProcessResult {
  html: string
  warning: string | null
}

function errorDetail(error: unknown): string | null {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (typeof error === 'string' && error.trim()) return error.trim()
  return null
}

/**
 * Formats a non-fatal preview enhancement failure without confusing it with a
 * core Markdown render failure. The caller can keep showing the base HTML.
 */
export function previewEnhancementWarning(phase: string, error: unknown): string {
  const detail = errorDetail(error)
  return detail
    ? `${phase} failed: ${detail}. Showing the core Markdown render.`
    : `${phase} failed. Showing the core Markdown render.`
}

/**
 * Applies optional plugin post-processing without allowing a plugin exception
 * or invalid return value to erase an otherwise valid Markdown render.
 */
export function applyPreviewPostProcess(
  html: string,
  postProcess?: (html: string) => string,
): PreviewPostProcessResult {
  if (!postProcess) return { html, warning: null }

  try {
    const processed = postProcess(html)
    if (typeof processed !== 'string') {
      throw new TypeError('preview post-processor returned a non-string value')
    }
    return { html: processed, warning: null }
  } catch (error) {
    return {
      html,
      warning: previewEnhancementWarning('Preview extension', error),
    }
  }
}

export function combinePreviewWarnings(
  ...warnings: Array<string | null | undefined>
): string | null {
  const unique = [...new Set(warnings.filter((warning): warning is string => Boolean(warning)))]
  return unique.length > 0 ? unique.join(' ') : null
}
