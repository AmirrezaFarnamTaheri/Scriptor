import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

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
import { WorkspaceOperationGate, type WorkspaceOperation } from '../lib/workspaceOperation'
import type { VaultSwitchDetail } from '../lib/vaultSwitchGuard'
import type { ExportJobOutput, ExportJobRecord, VaultConfig } from '../types/vault'
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

export function useWorkspaceExport({ vaultId, activePath, draftMarkdown, vaultConfig, pluginExportProfiles, logActivity, setError, refreshGit }: UseWorkspaceExportOptions) {
  const [exportResult, setExportResult] = useState<ExportJobOutput | null>(null)
  const [exportHistory, setExportHistory] = useState<ExportJobRecord[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const gate = useRef(new WorkspaceOperationGate(vaultId)).current
  const mounted = useRef(false)
  const pending = useRef<{ operation: WorkspaceOperation; profileId: string; cancelled: boolean; phase: 'preparing' | 'submitted' | 'complete' } | null>(null)

  useLayoutEffect(() => {
    mounted.current = true
    gate.setOwner(vaultId)
    setExportResult(null)
    setExportHistory([])
    setIsExporting(gate.isPending())
    return () => { mounted.current = false; gate.invalidate() }
  }, [gate, vaultId])

  useEffect(() => {
    const preventPendingSwitch = (event: Event) => {
      if (!gate.isPending()) return
      ;(event as CustomEvent<VaultSwitchDetail>).detail?.waitUntil(async () => {
        if (!gate.isPending()) return true
        setError('An export is still running. Wait for it to finish, or cancel it in Export & publish before changing vaults.')
        return false
      })
    }
    window.addEventListener('scriptor:vault-change-starting', preventPendingSwitch)
    return () => window.removeEventListener('scriptor:vault-change-starting', preventPendingSwitch)
  }, [gate, setError])

  const exportProfiles = useMemo(() => [
    ...mergePluginExportProfiles(applyVaultExportToProfiles(DEFAULT_EXPORT_PROFILES, vaultConfig.export), pluginExportProfiles),
    { id: 'pdf-offline', label: 'PDF · Offline', format: 'pdf' as const, outputDirectory: '.scriptor/exports/offline', extraPandocArgs: [] },
  ], [pluginExportProfiles, vaultConfig.export])

  const exportWithProfile = useCallback(async (profileId: string, dryRun = false) => {
    if (!mounted.current || !gate.hasOwner(vaultId)) return
    if (!activePath || !vaultId) { setError('Open a note in a vault before exporting.'); return }
    const profile = findExportProfile(exportProfiles, profileId)
    if (!profile) { setError(`Unknown export profile: ${profileId}`); return }
    if (dryRun && (profileId === 'pdf-offline' || profileId === 'pdf-translate')) {
      setError(`${profileId === 'pdf-offline' ? 'Offline PDF export' : 'PDF translation'} creates a document directly; dry run is unavailable.`)
      return
    }
    if ((profileId === 'pdf-offline' || profileId === 'pdf-translate') && !isNativeBridgeAvailable()) {
      setError('This PDF operation requires the desktop app.')
      return
    }
    const operation = gate.begin(vaultId)
    if (!operation) {
      if (gate.isPending()) logActivity('info', 'An export is already running. Wait for it to finish before starting another export.')
      return
    }
    const request = { operation, profileId, cancelled: false, phase: 'preparing' as 'preparing' | 'submitted' | 'complete' }
    pending.current = request
    const jobId = crypto.randomUUID()
    const isCurrent = () => mounted.current && gate.isCurrent(operation)
    const assertPendingOwner = () => {
      if (!isCurrent()) throw new Error('Workspace changed; reopen export in the selected vault.')
      if (request.cancelled) throw new Error('Export cancelled')
    }
    setIsExporting(true)
    setError(null)
    setExportResult(null)
    setExportHistory(current => [{ id: jobId, profile_label: profile.label, note_path: activePath, status: 'running' as const, finished_at: '' }, ...current].slice(0, 20))

    try {
      let result: ExportJobOutput
      if (profileId === 'pdf-offline') {
        const pdf = await exportPdfInprocess(activePath, draftMarkdown, operation.owner)
        result = { job_id: jobId, format: 'pdf', artifact_path: pdf.artifact_path, command: ['in-process Typst'], stdout: `${pdf.page_count} pages. ${pdf.warnings.join('\n')}`, stderr: '', duration_ms: pdf.duration_ms, dry_run: false }
      } else if (profileId === 'pdf-translate') {
        const { open } = await import('@tauri-apps/plugin-dialog')
        assertPendingOwner()
        const selected = await open({ title: 'Select PDF to translate', multiple: false, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
        assertPendingOwner()
        if (!selected || typeof selected !== 'string') {
          setExportHistory(current => current.map(entry => entry.id === jobId ? { ...entry, status: 'cancelled', finished_at: new Date().toISOString() } : entry))
          return
        }
        const translated = await pdfTranslate(selected)
        result = { job_id: jobId, format: 'pdf', artifact_path: translated.outputPath, command: ['pdf2zh', selected], stdout: '', stderr: '', duration_ms: 0, dry_run: false }
      } else {
        const citationArgs = appendCitationExportArgs(profile.extraPandocArgs, profile)
        // A preview must not render diagrams, execute PlantUML or write assets.
        // Real exports use unique, creation-only paths so earlier artifacts and
        // a user's similarly named assets cannot be replaced by preprocessing.
        const exportMarkdown = dryRun ? draftMarkdown : await preprocessMarkdownDiagramsForExport(
          draftMarkdown,
          async (_kind, index, bytes, extension) => {
            assertPendingOwner()
            // Filenames enter a Markdown image destination directly; avoid
            // note names containing spaces, brackets or other URL syntax.
            const relativePath = `assets/export-${jobId}-${index}.${extension}`
            if (isNativeBridgeAvailable()) await vaultSaveAsset(relativePath, Array.from(bytes), true, operation.owner)
            assertPendingOwner()
            return relativePath
          },
          isNativeBridgeAvailable() ? async source => {
            assertPendingOwner()
            const { svg } = await plantumlRender(source)
            assertPendingOwner()
            return new TextEncoder().encode(svg)
          } : undefined,
        )
        assertPendingOwner()
        // These commands return the completed job. Global export events also
        // describe unrelated daemon jobs and must not alter this operation.
        request.phase = 'submitted'
        result = isNativeBridgeAvailable()
          ? await exportRunMarkdown(activePath, exportMarkdown, profile.format, dryRun, citationArgs, profile.outputDirectory, operation.owner)
          : await exportRunNote(activePath, profile.format, dryRun, citationArgs, profile.outputDirectory, operation.owner)
      }
      request.phase = 'complete'
      if (!isCurrent()) return
      setExportResult(result)
      setExportHistory(current => current.map(entry => entry.id === jobId ? { ...entry, status: result.dry_run ? 'dry-run' : 'success', finished_at: new Date().toISOString(), result } : entry))
      logActivity('success', result.dry_run ? `Dry run: ${profile.label}` : `Exported ${profile.label}`, result.artifact_path)
      if (!result.dry_run) {
        try { await refreshGit() }
        catch (reason) {
          if (isCurrent()) logActivity('info', 'Export created; Git status could not refresh', reason instanceof Error ? reason.message : String(reason))
        }
      }
    } catch (reason) {
      if (!isCurrent()) return
      const message = reason instanceof Error ? reason.message : String(reason)
      const cancelled = message.toLowerCase().includes('cancelled')
      if (!cancelled) setError(message)
      setExportResult(null)
      setExportHistory(current => current.map(entry => entry.id === jobId ? { ...entry, status: cancelled ? 'cancelled' : 'error', finished_at: new Date().toISOString(), error: message } : entry))
      logActivity(cancelled ? 'info' : 'error', cancelled ? 'Export cancelled' : 'Export failed', message)
    } finally {
      gate.finish(operation)
      if (pending.current === request) pending.current = null
      if (mounted.current) setIsExporting(gate.isPending())
    }
  }, [activePath, draftMarkdown, exportProfiles, gate, logActivity, refreshGit, setError, vaultId])

  const cancelExportRequest = useCallback(async () => {
    const request = pending.current
    if (!request || !gate.isCurrent(request.operation)) return
    if (request.profileId === 'pdf-offline' || request.profileId === 'pdf-translate') {
      logActivity('info', 'PDF operation is still running', 'This compiler or translation tool finishes its current document before controls unlock.')
      return
    }
    if (request.phase === 'complete') {
      logActivity('info', 'Export already completed', 'Waiting for its Git status refresh; the artifact is ready.')
      return
    }
    request.cancelled = true
    if (request.phase === 'preparing') {
      logActivity('info', 'Export cancel requested', 'Stopping preprocessing before starting Pandoc')
      return
    }
    try {
      await exportCancel(request.operation.owner)
      if (gate.isCurrent(request.operation)) logActivity('info', 'Export cancel requested', 'Stopping preprocessing or Pandoc if running')
    } catch (reason) {
      if (gate.isCurrent(request.operation)) logActivity('error', 'Export cancel failed', reason instanceof Error ? reason.message : String(reason))
    }
  }, [gate, logActivity])

  return { exportProfiles, exportResult, exportHistory, isExporting, exportWithProfile, cancelExport: cancelExportRequest }
}
