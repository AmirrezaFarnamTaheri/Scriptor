import { invoke } from '@tauri-apps/api/core'

import type { ExportJobOutput, ExportJobStarted, PandocDiscovery } from '../../types/vault'
import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'

export async function exportDiscover(): Promise<PandocDiscovery> {
  requireNative()
  return invoke<PandocDiscovery>('export_discover')
}

export interface OfflinePdfOutput {
  artifact_path: string
  page_count: number
  warnings: string[]
  duration_ms: number
}

export async function exportPdfInprocess(notePath: string, sourceMarkdown: string, expectedVaultId: string): Promise<OfflinePdfOutput> {
  requireNative()
  return invoke<OfflinePdfOutput>('export_pdf_inprocess', { notePath, sourceMarkdown, expectedVaultId })
}

export async function exportPdfLicenses(): Promise<string> {
  requireNative()
  return invoke<string>('export_pdf_licenses')
}

export async function exportRunNote(
  notePath: string,
  format: string,
  dryRun = false,
  extraPandocArgs: string[] = [],
  outputSubdirectory?: string,
  expectedVaultId?: string,
): Promise<ExportJobOutput> {
  requireNative()
  return invoke<ExportJobOutput>('export_run_note', {
    notePath,
    format,
    dryRun,
    extraPandocArgs,
    outputSubdirectory: outputSubdirectory ?? null,
    expectedVaultId: expectedVaultId ?? null,
  })
}

export async function exportStartNote(
  notePath: string,
  format: string,
  dryRun = false,
  extraPandocArgs: string[] = [],
  outputSubdirectory?: string,
  expectedVaultId?: string,
): Promise<ExportJobStarted> {
  requireNative()
  return invoke<ExportJobStarted>('export_start_note', {
    notePath,
    format,
    dryRun,
    extraPandocArgs,
    outputSubdirectory: outputSubdirectory ?? null,
    expectedVaultId: expectedVaultId ?? null,
  })
}

export async function exportCancel(expectedVaultId?: string): Promise<boolean> {
  requireNative()
  return invoke<boolean>('export_cancel', { expectedVaultId: expectedVaultId ?? null })
}

export interface PdfTranslateOutput {
  outputPath: string
}

export async function pdfTranslate(
  inputPath: string,
  langIn = 'en',
  langOut = 'zh',
  outputPath?: string,
): Promise<PdfTranslateOutput> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('pdf_translation', inputPath)
  return invoke<PdfTranslateOutput>('pdf_translate', {
    inputPath,
    langIn,
    langOut,
    outputPath: outputPath ?? null,
    authorizationToken,
  })
}

export async function exportRunMarkdown(
  notePath: string,
  sourceMarkdown: string,
  format: string,
  dryRun = false,
  extraPandocArgs: string[] = [],
  outputSubdirectory?: string,
  expectedVaultId?: string,
): Promise<ExportJobOutput> {
  requireNative()
  return invoke<ExportJobOutput>('export_run_markdown', {
    notePath,
    sourceMarkdown,
    format,
    dryRun,
    extraPandocArgs,
    outputSubdirectory: outputSubdirectory ?? null,
    expectedVaultId: expectedVaultId ?? null,
  })
}
