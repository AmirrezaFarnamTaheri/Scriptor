const WIDGET_TOPICS: ReadonlyArray<readonly [key: string, id: string]> = [
  ['inspector.noteHealth', 'publish-readiness'], ['noteQuality.title', 'publish-readiness'], ['inspector.previewCard', 'preview'],
  ['inspector.outline', 'outline'], ['inspector.outgoingLinks', 'outgoing'],
  ['inspector.backlinks', 'backlinks'], ['inspector.citations', 'citations'],
  ['inspector.publishing', 'publish-readiness'], ['inspector.exportProfiles', 'export'],
]

/** Resolve only application-owned translated widget headings; never inspect note content. */
export function widgetHelpTopic(title: string, translate: (key: string) => string): string | undefined {
  return WIDGET_TOPICS.find(([key]) => translate(key) === title)?.[1]
}
