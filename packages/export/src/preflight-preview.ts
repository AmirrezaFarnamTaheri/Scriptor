/** Shell-style display for a Pandoc argv vector (preview only, not for execution). */
export function formatPandocCommand(command: string[]): string {
  return command
    .map((part) => {
      if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(part)) {
        return part
      }
      return `"${part.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    })
    .join(' ')
}

/** Whether PublishCenter should show an in-app HTML snippet for this export format. */
export function supportsHtmlSnippetPreview(format: string): boolean {
  const normalized = format.trim().toLowerCase()
  return normalized === 'html' || normalized === 'wechat-html'
}
