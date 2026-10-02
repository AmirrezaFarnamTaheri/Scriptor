type RecordValue = Record<string, unknown>
function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unsupported Google Docs content shape')
  return value as RecordValue
}
const baselineWarnings = ['Comments, suggestions, revision history, page layout and access permissions are not imported.', 'Headers, footers, footnote text and tab navigation are not imported.', 'Rich fonts, colors, links, lists and positioning are flattened; review the extracted text before applying.']
/** Loss-aware translation is a reviewed copy, never a round-trip fidelity claim. */
export function translateGoogleDoc(value: unknown): { markdown: string; title: string; warnings: string[] } {
  const document = record(value)
  if (JSON.stringify(document).length > 4 * 1024 * 1024) throw new Error('Google Docs response exceeds its limit')
  const warnings = new Set(baselineWarnings)
  let nodes = 0
  function content(value: unknown, depth = 0): string {
    if (depth > 20 || ++nodes > 50_000) throw new Error('Google Docs content exceeds its nesting or element limit')
    if (!Array.isArray(value)) throw new Error('Unsupported Google Docs content shape')
    return value.map(item => {
      const element = record(item)
      if (element.paragraph) {
        const paragraph = record(element.paragraph)
        if (!Array.isArray(paragraph.elements)) throw new Error('Unsupported Google Docs paragraph')
        const text = paragraph.elements.map(run => {
          if (++nodes > 50_000) throw new Error('Google Docs content exceeds its element limit')
          const piece = record(run)
          if (piece.textRun) { const textRun = record(piece.textRun); if (typeof textRun.content !== 'string') throw new Error('Unsupported Google Docs text'); return textRun.content }
          if (piece.inlineObjectElement || piece.footnoteReference || piece.person || piece.richLink) { warnings.add('Embedded objects, smart chips and footnote anchors become marked placeholders.'); return '[omitted embedded object]' }
          if (piece.pageBreak || piece.columnBreak || piece.horizontalRule) { warnings.add('Page/column breaks and horizontal rules are flattened.'); return '\n' }
          throw new Error('Unsupported Google Docs paragraph element; import was stopped to avoid silent loss')
        }).join('')
        const style = paragraph.paragraphStyle ? record(paragraph.paragraphStyle).namedStyleType : undefined
        const heading = typeof style === 'string' ? /^HEADING_([1-6])$/.exec(style) : null
        return heading ? '#'.repeat(Number(heading[1])) + ' ' + text : text
      }
      if (element.table) {
        warnings.add('Tables become tab-separated text; merged cells and formatting are not preserved.')
        const table = record(element.table)
        if (!Array.isArray(table.tableRows)) throw new Error('Unsupported Google Docs table')
        return table.tableRows.map(row => { const cells = record(row).tableCells; if (!Array.isArray(cells)) throw new Error('Unsupported Google Docs table row'); return cells.map(cell => content(record(cell).content, depth + 1).trim()).join('\t') }).join('\n') + '\n'
      }
      if (element.sectionBreak) { warnings.add('Section layout is not preserved.'); return '' }
      if (element.tableOfContents) { warnings.add('The table of contents is copied as text and will not update automatically.'); return content(record(element.tableOfContents).content, depth + 1) }
      throw new Error('Unsupported Google Docs block; import was stopped to avoid silent loss')
    }).join('')
  }
  function tabs(value: unknown, depth = 0): string {
    if (depth > 20 || !Array.isArray(value)) throw new Error('Unsupported Google Docs tabs')
    return value.map(item => {
      if (++nodes > 50_000) throw new Error('Google Docs content exceeds its element limit')
      const tab = record(item)
      const current = tab.documentTab ? content(record(record(tab.documentTab).body).content, depth) : ''
      return current + (tab.childTabs ? tabs(tab.childTabs, depth + 1) : '')
    }).join('\n')
  }
  const markdown = document.tabs ? tabs(document.tabs) : content(record(document.body).content)
  if (!markdown.trim()) throw new Error('Google Docs document contains no extractable text')
  if (new TextEncoder().encode(markdown).length > 1_572_864) throw new Error('Translated text exceeds its limit')
  return { markdown, title: typeof document.title === 'string' ? document.title.slice(0, 512) : 'Google document', warnings: [...warnings] }
}
export function docsPlainTextExport(markdown: string): string {
  if (!markdown.trim() || new TextEncoder().encode(markdown).length > 1_572_864) throw new Error('Google Docs plain text copy is empty or exceeds its limit')
  return markdown
}
