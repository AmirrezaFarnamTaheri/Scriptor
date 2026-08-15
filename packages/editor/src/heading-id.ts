/**
 * heading-id
 * ----------
 * CodeMirror-free slug generation for Markdown headings. Lives apart from
 * `toc-field.ts` (a CodeMirror StateField) so that app code needing only the
 * slug helper does not pull the editor runtime into its chunk.
 */

export function headingToId(heading: string): string {
  const pandoc = heading.match(/\{#([^}]+)\}\s*$/)
  if (pandoc) return pandoc[1]
  const anchor = heading.match(/<a\s+name="([^"]+)"/i)
  if (anchor) return anchor[1]
  const stripped = heading
    .replace(/<[^>]+>/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/\{#([^}]+)\}/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
  return stripped || 'section'
}
