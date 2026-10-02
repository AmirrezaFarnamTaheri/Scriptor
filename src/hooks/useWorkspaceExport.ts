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
  exportPdfInprocess,
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
  vaultId: string | null
  activePath: string | null
  draftMarkdown: string
  vaultConfig: VaultConfig
  pluginExportProfiles: ExportProfileContribution[]
  logActivity: (kind: ActivityEntry['kind'], message: string, detail?: string) => void
  setError: (message: string | null) => void
  refreshGit: () => Promise<void>
}

export function useWorkspaceExport({
  vaultId,
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
  const offlinePending = useRef(false)

  const exportProfiles = useMemo(
    () =>
      [...mergePluginExportProfiles(
        applyVaultExportToProfiles(DEFAULT_EXPORT_PROFILES, vaultConfig.export),
        pluginExportProfiles,
      ), {
        id: 'pdf-offline', label: 'PDF · Offline', format: 'pdf' as const,
        outputDirectory: '.scriptor/exports/offline', extraPandocArgs: [],
      }],
    [pluginExportProfiles, vaultConfig.export],
  )

  const handleExportFinished = useCallback(
    async (event: ExportJobFinishedEvent) => {
      setIsExporting(false)
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
        event.result.dry_run ? `Dry run: ${event.result.format}` : `Exported ${event.result.format}`,
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
      setIsExporting(false)
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
        event.error,
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

      if (profileId === 'pdf-offline') {
        if (!isNativeBridgeAvailable() || !vaultId) {
          setError('Offline PDF export requires an open vault in the desktop app.')
          return
        }
        if (offlinePending.current) return
        if (dryRun) {
          setError('Offline PDF export creates a document directly; dry run is unavailable.')
          return
        }
        offlinePending.current = true
        setIsExporting(true)
        setError(null)
        const jobId = crypto.randomUUID()
        setExportHistory(current => [{ id: jobId, profile_label: profile.label, note_path: activePath, status: 'running' as const, finished_at: '' }, ...current].slice(0, 20))
        try {
          const pdf = await exportPdfInprocess(activePath, draftMarkdown, vaultId)
          const result: ExportJobOutput = {
            job_id: jobId, format: 'pdf', artifact_path: pdf.artifact_path,
            command: ['in-process Typst'], stdout: `${pdf.page_count} pages. ${pdf.warnings.join('\n')}`,
            stderr: '', duration_ms: pdf.duration_ms, dry_run: false,
          }
          setExportResult(result)
          setExportHistory(current => current.map(entry => entry.id === jobId ? { ...entry, status: 'success', finished_at: new Date().toISOString(), result } : entry))
          logActivity('success', 'Offline PDF exported', `${pdf.page_count} pages · ${pdf.artifact_path}${pdf.warnings.length ? ` · ${pdf.warnings.join('; ')}` : ''}`)
          await refreshGit()
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : String(caught)
          setError(message)
          setExportHistory(current => current.map(entry => entry.id === jobId ? { ...entry, status: 'error', finished_at: new Date().toISOString(), error: message } : entry))
          logActivity('error', 'Offline PDF export failed', message)
        } finally {
          offlinePending.current = false
          setIsExporting(false)
        }
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

      // The native export commands resolve only after the job completes, so the
      // history entry is created up front (status "running") and reconciled in
      // place when the outcome arrives; the job events emitted by the daemon's
      // start-based flow carry backend job ids and are reconciled by
      // handleExportFinished/handleExportFailed instead.
      let runningId: string | null = null

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
          const markdownJobId = crypto.randomUUID()
          runningId = markdownJobId
          setExportHistory((current) =>
            [
              {
                id: markdownJobId,
                profile_label: profile.label,
                note_path: activePath,
                status: 'running' as const,
                finished_at: '',
              },
              ...current,
            ].slice(0, 20),
          )
          const result = await exportRunMarkdown(
            activePath,
            exportMarkdown,
            profile.format,
            dryRun,
            citationArgs,
            profile.outputDirectory,
          )
          setExportResult(result)
          setExportHistory((current) =>
            current.map((entry) =>
              entry.id === runningId
                ? {
                    ...entry,
                    status: dryRun ? ('dry-run' as const) : ('success' as const),
                    finished_at: new Date().toISOString(),
                    result,
                  }
                : entry,
            ),
          )
          logActivity(
        'success',
        dryRun ? `Dry run: ${profile.label}` : `Exported ${profile.label}`,
        result.artifact_path,
      )
          if (!dryRun) {
            await refreshGit()
          }
          setIsExporting(false)
          return
        }

        const noteJobId = crypto.randomUUID()
        runningId = noteJobId
        setExportHistory((current) =>
          [
            {
              id: noteJobId,
              profile_label: profile.label,
              note_path: activePath,
              status: 'running' as const,
              finished_at: '',
            },
            ...current,
          ].slice(0, 20),
        )
        const result = await exportRunNote(
          activePath,
          profile.format,
          dryRun,
          citationArgs,
          profile.outputDirectory,
        )
        setExportResult(result)
        setExportHistory((current) =>
          current.map((entry) =>
            entry.id === runningId
              ? {
                  ...entry,
                  status: dryRun ? ('dry-run' as const) : ('success' as const),
                  finished_at: new Date().toISOString(),
                  result,
                }
              : entry,
          ),
        )
        logActivity(
          'success',
          dryRun ? `Dry run: ${profile.label}` : `Exported ${profile.label}`,
          result.artifact_path,
        )
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
        setExportHistory((current) => {
          if (runningId !== null) {
            return current.map((entry) =>
              entry.id === runningId
                ? {
                    ...entry,
                    status: cancelled ? ('cancelled' as const) : ('error' as const),
                    finished_at: new Date().toISOString(),
                    error: message,
                  }
                : entry,
            )
          }
          return [
            {
              id: crypto.randomUUID(),
              profile_label: profile.label,
              note_path: activePath,
              status: cancelled ? ('cancelled' as const) : ('error' as const),
              finished_at: new Date().toISOString(),
              error: message,
            },
            ...current,
          ].slice(0, 20)
        })
        logActivity(
          cancelled ? 'info' : 'error',
          cancelled ? 'Export cancelled' : 'Export failed',
          message,
        )
      } finally {
        setIsExporting(false)
      }
    },
    [activePath, draftMarkdown, exportProfiles, logActivity, refreshGit, setError, vaultId],
  )

  const cancelExportRequest = useCallback(async () => {
    if (offlinePending.current) {
      logActivity('info', 'Offline PDF is still typesetting', 'This in-process compiler finishes its current document before controls unlock.')
      return
    }
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
