import type { ExportFormat, ExportProfile } from '@scriptor/core/contracts/export'

export const DEFAULT_EXPORT_PROFILES: ExportProfile[] = [
  {
    id: 'html-standalone',
    label: 'HTML',
    format: 'html',
    outputDirectory: '.scriptor/exports/html',
    bibliographyPath: 'references.bib',
    cslStylePath: 'apa-lite.csl',
    extraPandocArgs: ['--embed-resources', '--css=export-theme.css', '--citeproc'],
  },
  {
    id: 'pdf-print',
    label: 'PDF',
    format: 'pdf',
    outputDirectory: '.scriptor/exports/pdf',
    bibliographyPath: 'references.bib',
    cslStylePath: 'apa-lite.csl',
    extraPandocArgs: ['--citeproc'],
  },
  {
    id: 'docx-manuscript',
    label: 'DOCX',
    format: 'docx',
    outputDirectory: '.scriptor/exports/docx',
    bibliographyPath: 'references.bib',
    cslStylePath: 'apa-lite.csl',
    extraPandocArgs: ['--citeproc'],
  },
  {
    id: 'latex-draft',
    label: 'LaTeX',
    format: 'latex',
    outputDirectory: '.scriptor/exports/latex',
    extraPandocArgs: [],
  },
  {
    id: 'epub-reader',
    label: 'ePub',
    format: 'epub',
    outputDirectory: '.scriptor/exports/epub',
    extraPandocArgs: [],
  },
  {
    id: 'reveal-slides',
    label: 'Reveal.js slides',
    format: 'html',
    outputDirectory: '.scriptor/exports/slides',
    extraPandocArgs: ['-t', 'revealjs', '-s', '--slide-level=2', '--standalone'],
  },
]

export function findExportProfile(
  profiles: ExportProfile[],
  profileId: string,
): ExportProfile | undefined {
  return profiles.find((profile) => profile.id === profileId)
}

export function resolveExportProfiles(overrides?: ExportProfile[]): ExportProfile[] {
  if (!overrides || overrides.length === 0) {
    return DEFAULT_EXPORT_PROFILES
  }
  return overrides
}

export function profileFormatLabel(format: ExportFormat): string {
  if (format === 'wechat-html') return 'WeChat HTML'
  return format.toUpperCase()
}
