/**
 * Fills `{{name}}` placeholders in one pass. Values are inserted literally:
 * a function replacer keeps `$&`, `$'` and `$$` in note titles or commit
 * messages from being expanded, and a value that itself contains `{{other}}`
 * is not substituted again by a later parameter.
 */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.hasOwn(params, key) ? String(params[key]) : match,
  )
}
