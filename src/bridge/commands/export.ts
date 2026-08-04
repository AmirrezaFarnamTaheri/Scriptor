import { invoke } from '@tauri-apps/api/core'

import type { ExportJobOutput, ExportJobStarted, PandocDiscovery } from '../../types/vault'
import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'

export async function exportDiscover(): Promise<PandocDiscovery> {
  requireNative()
  return invoke<PandocDiscovery>('export_discover')
}

export async function exportRunNote(
  notePath: string,
  format: string,
  dryRun = false,
  extraPandocArgs: string[] = [],
  outputSubdirectory?: string,
): Promise<ExportJobOutput> {
  requireNative()
  return invoke<ExportJobOutput>('export_run_note', {
    notePath,
    format,
    dryRun,
    extraPandocArgs,
    outputSubdirectory: outputSubdirectory ?? null,
  })
}

export async function exportStartNote(
  notePath: string,
  format: string,
  dryRun = false,
  extraPandocArgs: string[] = [],
  outputSubdirectory?: string,
): Promise<ExportJobStarted> {
  requireNative()
  return invoke<ExportJobStarted>('export_start_note', {
    notePath,
    format,
    dryRun,
    extraPandocArgs,
    outputSubdirectory: outputSubdirectory ?? null,
  })
}

export async function exportCancel(): Promise<boolean> {
  requireNative()
  return invoke<boolean>('export_cancel')
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
): Promise<ExportJobOutput> {
  requireNative()
  return invoke<ExportJobOutput>('export_run_markdown', {
    notePath,
    sourceMarkdown,
    format,
    dryRun,
    extraPandocArgs,
    outputSubdirectory: outputSubdirectory ?? null,
  })
}
