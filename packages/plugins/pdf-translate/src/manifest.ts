import type { PluginManifest } from '@scriptor/core'

export const pdfTranslateManifest: PluginManifest = {
  id: 'scriptor-pdf-translate',
  name: 'PDF Translate',
  version: '0.1.0',
  publisher: 'Scriptor',
  description: 'Scientific PDF translation via pdf2zh while preserving layout, formulas, and figures.',
  activation: ['manual'],
  capabilities: ['command', 'export-profile'],
  permissions: [{ permission: 'read', reason: 'Read source PDF paths from vault export workflows.' }],
  contributes: {
    commands: [
      {
        commandId: 'export.pdf-translate',
        label: 'Translate PDF (pdf2zh)',
        category: 'Export',
        permission: 'read',
      },
    ],
    exportProfiles: [
      {
        id: 'pdf-translate',
        label: 'PDF translate (pdf2zh)',
        format: 'pdf',
      },
    ],
  },
}

export const PDF_TRANSLATE_CLI = 'pdf2zh'
