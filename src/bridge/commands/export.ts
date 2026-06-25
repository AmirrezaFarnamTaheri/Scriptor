import { invoke } from '@tauri-apps/api/core'

import type { ExportJobOutput, ExportJobStarted, PandocDiscovery } from '../../types/vault'
import { isHeadlessMode } from '../headlessMode.ts'
import { requireNative } from '../native.ts'
import { daemonExportRunMarkdown, daemonExportRunNote } from './daemon.ts'

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
  if (isHeadlessMode()) {
    return daemonExportRunNote(notePath, format, dryRun, extraPandocArgs, outputSubdirectory)
  }
  return invoke<ExportJobOutput>('export_run_note', {
    notePath,
    format,
    dryRun,
    extraPandocArgs,
    outputSubdirectory: outputSubdirectory ?? null,
  })
}

async function emitHeadlessExportFinished(jobId: string, result: ExportJobOutput): Promise<void> {
  const { emit } = await import('@tauri-apps/api/event')
  await emit('export:finished', { job_id: jobId, result: { ...result, job_id: jobId } })
}

async function emitHeadlessExportFailed(jobId: string, error: string): Promise<void> {
  const { emit } = await import('@tauri-apps/api/event')
  await emit('export:failed', { job_id: jobId, error })
}

export async function exportStartNote(
  notePath: string,
  format: string,
  dryRun = false,
  extraPandocArgs: string[] = [],
  outputSubdirectory?: string,
): Promise<ExportJobStarted> {
  requireNative()
  if (isHeadlessMode()) {
    const jobId = crypto.randomUUID()
    const started: ExportJobStarted = { job_id: jobId, note_path: notePath, format }
    const { emit } = await import('@tauri-apps/api/event')
    await emit('export:started', started)
    void daemonExportRunNote(notePath, format, dryRun, extraPandocArgs, outputSubdirectory)
      .then((result) => emitHeadlessExportFinished(jobId, result))
      .catch((caught) =>
        emitHeadlessExportFailed(jobId, caught instanceof Error ? caught.message : String(caught)),
      )
    return started
  }
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
  return invoke<PdfTranslateOutput>('pdf_translate', {
    inputPath,
    langIn,
    langOut,
    outputPath: outputPath ?? null,
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
  if (isHeadlessMode()) {
    return daemonExportRunMarkdown(
      notePath,
      sourceMarkdown,
      format,
      dryRun,
      extraPandocArgs,
      outputSubdirectory,
    )
  }
  return invoke<ExportJobOutput>('export_run_markdown', {
    notePath,
    sourceMarkdown,
    format,
    dryRun,
    extraPandocArgs,
    outputSubdirectory: outputSubdirectory ?? null,
  })
}
