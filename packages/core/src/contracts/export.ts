import type { VaultRelativePath } from './vault'

export type ExportFormat = 'pdf' | 'html' | 'docx' | 'latex' | 'epub' | 'wechat-html'

export interface ExportProfile {
  id: string
  label: string
  format: ExportFormat
  templateId?: string
  cslStylePath?: VaultRelativePath
  bibliographyPath?: VaultRelativePath
  outputDirectory: VaultRelativePath
  extraPandocArgs: string[]
}

export interface RunExportInput {
  profileId: string
  notePaths: VaultRelativePath[]
  dryRun?: boolean
}

export interface RunExportOutput {
  jobId: string
  expectedArtifacts: VaultRelativePath[]
}

