/**
 * language-tool-config
 * --------------------
 * Mutable LanguageTool settings, split out of `language-tool-lint.ts` so that
 * app startup can call `configureLanguageTool()` without importing
 * `@codemirror/lint` (and therefore the whole CodeMirror runtime).
 */

export interface LanguageToolSettings {
  enabled: boolean
  endpoint: string
  language: string
}

const settings: LanguageToolSettings = {
  enabled: false,
  endpoint: 'https://api.languagetool.org/v2/check',
  language: 'en-US',
}

export function configureLanguageTool(options: {
  enabled?: boolean
  endpoint?: string
  language?: string
}): void {
  if (options.enabled != null) settings.enabled = options.enabled
  if (options.endpoint) settings.endpoint = options.endpoint
  if (options.language) settings.language = options.language
}

export function languageToolSettings(): LanguageToolSettings {
  return settings
}
