import { useCallback, useMemo, useRef, useState } from 'react'

import {
  appendCitationExportArgs,
  applyVaultExportToProfiles,
  DEFAULT_EXPORT_PROFILES,
  findExportProfile,
  mergePluginExportProfiles,
  preprocessMarkdownDiagramsForExport,
} from '@scriptor/export'
import type { ExportProfileContribution } from '@scriptor/core/contracts/plugin'

import {
  exportCancel,
  exportRunMarkdown,
  exportRunNote,
  pdfTranslate,
  plantumlRender,
  vaultSaveAsset,
} from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { useExportJobEvents } from './useExportJobEvents'
import type {
  ExportJobFailedEvent,
  ExportJobFinishedEvent,
  ExportJobOutput,
  ExportJobProgressEvent,
  ExportJobRecord,
  VaultConfig,
} from '../types/vault'
import type { ActivityEntry } from './useActivityLog'

interface UseWorkspaceExportOptions {
  activePath: string | null
  draftMarkdown: string
  vaultConfig: VaultConfig
  pluginExportProfiles: ExportProfileContribution[]
  logActivity: (kind: ActivityEntry['kind'], message: string, detail?: string) => void
  setError: (message: string | null) => void
  refreshGit: () => Promise<void>
}

export function useWorkspaceExport({
  activePath,
  draftMarkdown,
  vaultConfig,
  pluginExportProfiles,
  logActivity,
  setError,
  refreshGit,
}: UseWorkspaceExportOptions) {
  const [exportResult, setExportResult] = useState<ExportJobOutput | null>(null)
  const [exportHistory, setExportHistory] = useState<ExportJobRecord[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const exportPendingRef = useRef<Map<string, { profileLabel: string; notePath: string; dryRun: boolean }>>(
    new Map(),
  )

  const exportProfiles = useMemo(
    () =>
      mergePluginExportProfiles(
        applyVaultExportToProfiles(DEFAULT_EXPORT_PROFILES, vaultConfig.export),
        pluginExportProfiles,
      ),
    [pluginExportProfiles, vaultConfig.export],
  )

  const handleExportFinished = useCallback(
    async (event: ExportJobFinishedEvent) => {
      const pending = exportPendingRef.current.get(event.job_id)
      exportPendingRef.current.delete(event.job_id)
      setIsExporting(exportPendingRef.current.size > 0)
      setExportResult(event.result)
      setExportHistory((current) =>
        current.map((entry) =>
          entry.id === event.job_id
            ? {
                ...entry,
                status: event.result.dry_run ? ('dry-run' as const) : ('success' as const),
                finished_at: new Date().toISOString(),
                result: event.result,
              }
            : entry,
        ),
      )
      logActivity(
        'success',
        `Exported ${pending?.profileLabel ?? event.result.format}`,
        event.result.artifact_path,
      )
      if (!event.result.dry_run) {
        await refreshGit()
      }
    },
    [logActivity, refreshGit],
  )

  const handleExportFailed = useCallback(
    (event: ExportJobFailedEvent) => {
      const pending = exportPendingRef.current.get(event.job_id)
      exportPendingRef.current.delete(event.job_id)
      setIsExporting(exportPendingRef.current.size > 0)
      const cancelled = event.error.toLowerCase().includes('cancelled')
      if (!cancelled) {
        setError(event.error)
      }
      setExportResult(null)
      setExportHistory((current) =>
        current.map((entry) =>
          entry.id === event.job_id
            ? {
                ...entry,
                status: cancelled ? ('cancelled' as const) : ('error' as const),
                finished_at: new Date().toISOString(),
                error: event.error,
              }
            : entry,
        ),
      )
      logActivity(
        cancelled ? 'info' : 'error',
        cancelled ? 'Export cancelled' : 'Export failed',
        pending?.notePath ?? event.error,
      )
    },
    [logActivity, setError],
  )

  const handleExportProgress = useCallback((event: ExportJobProgressEvent) => {
    if (event.stream !== 'stderr' || !event.chunk) return
    setExportHistory((current) =>
      current.map((entry) =>
        entry.id === event.job_id && entry.status === 'running'
          ? { ...entry, live_stderr: `${entry.live_stderr ?? ''}${event.chunk}` }
          : entry,
      ),
    )
  }, [])

  useExportJobEvents({
    onFinished: (event) => {
      void handleExportFinished(event)
    },
    onFailed: handleExportFailed,
    onProgress: handleExportProgress,
  })

  const exportWithProfile = useCallback(
    async (profileId: string, dryRun = false) => {
      if (!activePath) {
        setError('Open a note before exporting.')
        return
      }

      const profile = findExportProfile(exportProfiles, profileId)
      if (!profile) {
        setError(`Unknown export profile: ${profileId}`)
        return
      }

      if (profileId === 'pdf-translate') {
        if (!isNativeBridgeAvailable()) {
          setError('PDF translation requires the desktop app.')
          return
        }
        setIsExporting(true)
        setError(null)
        try {
          const { open } = await import('@tauri-apps/plugin-dialog')
          const selected = await open({
            title: 'Select PDF to translate',
            multiple: false,
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
          })
          if (!selected || typeof selected !== 'string') {
            setIsExporting(false)
            return
          }
          const result = await pdfTranslate(selected)
          const jobId = crypto.randomUUID()
          setExportHistory((current) => [
            {
              id: jobId,
              profile_label: profile.label,
              note_path: activePath,
              status: 'success' as const,
              finished_at: new Date().toISOString(),
              result: {
                job_id: jobId,
                format: 'pdf',
                artifact_path: result.outputPath,
                command: ['pdf2zh', selected],
                stdout: '',
                stderr: '',
                duration_ms: 0,
                dry_run: false,
              },
            },
            ...current,
          ].slice(0, 20))
          logActivity('success', 'PDF translated', result.outputPath)
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : String(caught)
          setError(message)
          logActivity('error', 'PDF translation failed', message)
        } finally {
          setIsExporting(false)
        }
        return
      }

      setIsExporting(true)
      setError(null)

      try {
        const citationArgs = appendCitationExportArgs(profile.extraPandocArgs, profile)
        const exportMarkdown = await preprocessMarkdownDiagramsForExport(
          draftMarkdown,
          async (_kind, index, bytes, extension) => {
            const slug = activePath.replace(/\.md$/i, '').replace(/[\\/]/g, '-')
            const relativePath = `assets/export-${slug}-${index}.${extension}`
            if (isNativeBridgeAvailable()) {
              await vaultSaveAsset(relativePath, Array.from(bytes))
            }
            return relativePath
          },
          isNativeBridgeAvailable()
            ? async (source) => {
                const { svg } = await plantumlRender(source)
                return new TextEncoder().encode(svg)
              }
            : undefined,
        )

        if (isNativeBridgeAvailable()) {
          const result = await exportRunMarkdown(
            activePath,
            exportMarkdown,
            profile.format,
            dryRun,
            citationArgs,
            profile.outputDirectory,
          )
          setExportResult(result)
          setExportHistory((current) => [
            {
              id: result.job_id,
              profile_label: profile.label,
              note_path: activePath,
              status: dryRun ? ('dry-run' as const) : ('success' as const),
              finished_at: new Date().toISOString(),
              result,
            },
            ...current,
          ].slice(0, 20))
          logActivity('success', `Exported ${profile.label}`, result.artifact_path)
          if (!dryRun) {
            await refreshGit()
          }
          setIsExporting(false)
          return
        }

        const result = await exportRunNote(
          activePath,
          profile.format,
          dryRun,
          citationArgs,
          profile.outputDirectory,
        )
        setExportResult(result)
        setExportHistory((current) => [
          {
            id: result.job_id,
            profile_label: profile.label,
            note_path: activePath,
            status: dryRun ? ('dry-run' as const) : ('success' as const),
            finished_at: new Date().toISOString(),
            result,
          },
          ...current,
        ].slice(0, 20))
        logActivity('success', `Exported ${profile.label}`, result.artifact_path)
        if (!dryRun) {
          await refreshGit()
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        const cancelled = message.toLowerCase().includes('cancelled')
        if (!cancelled) {
          setError(message)
        }
        setExportResult(null)
        setExportHistory((current) => [
          {
            id: crypto.randomUUID(),
            profile_label: profile.label,
            note_path: activePath,
            status: cancelled ? ('cancelled' as const) : ('error' as const),
            finished_at: new Date().toISOString(),
            error: message,
          },
          ...current,
        ].slice(0, 20))
        logActivity(
          cancelled ? 'info' : 'error',
          cancelled ? 'Export cancelled' : 'Export failed',
          message,
        )
      } finally {
        setIsExporting(false)
      }
    },
    [activePath, draftMarkdown, exportProfiles, logActivity, refreshGit, setError],
  )

  const cancelExportRequest = useCallback(async () => {
    try {
      await exportCancel()
      logActivity('info', 'Export cancel requested', 'Stopping Pandoc if running')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      logActivity('error', 'Export cancel failed', message)
    }
  }, [logActivity])

  return {
    exportProfiles,
    exportResult,
    exportHistory,
    isExporting,
    exportWithProfile,
    cancelExport: cancelExportRequest,
  }
}
