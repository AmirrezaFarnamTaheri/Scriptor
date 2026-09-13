import { memo, Suspense, useCallback } from 'react'
import type { ComponentProps } from 'react'

import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import { FrontmatterInspector } from '../FrontmatterInspector'
import { ConflictResolverSurface } from './ConflictResolverSurface'
import {
  CheatsheetPanel,
  KnowledgeWorkbench,
  OnboardingTour,
  PanelFallback,
  PerfHudOverlay,
  PublishCenter,
  SnippetsPanelLazy,
  SupportPanel,
  VaultHealthDashboard,
  WritingTargetsPanel,
} from './lazyPanels'
import { parseSimpleFrontmatter } from '../../lib/frontmatter'
import { recordWritingSession } from '../../lib/writingTargets'
import { mutateVaultConfig } from '../../lib/vaultConfigMutation'
import type { useVaultWorkspace } from '../../hooks/useVaultWorkspace'
import type { usePluginRegistry } from '../../hooks/usePluginRegistry'
import type { useOnboarding } from '../../hooks/useOnboarding'
import type { usePerfMetrics } from '../../hooks/usePerfMetrics'
import type { KnowledgeWorkbenchTab } from '../KnowledgeWorkbench'
import type { usePreviewBridge } from '../../hooks/usePreviewBridge'
import type { TextPromptRequest } from '../../hooks/useTextPrompt'

export interface WorkspaceDialogLayersProps {
  workspace: ReturnType<typeof useVaultWorkspace>
  plugins: ReturnType<typeof usePluginRegistry>
  nativeReady: boolean
  draftWordCount: number
  deferredDraft: string
  previewBridge: ReturnType<typeof usePreviewBridge>
  onboarding: ReturnType<typeof useOnboarding>
  perfMetrics: ReturnType<typeof usePerfMetrics>

  // Writing targets
  writingTargetsOpen: boolean
  setWritingTargetsOpen: (open: boolean) => void

  // Conflict resolver
  conflictPath: string | null
  conflictSource: string
  conflictBasePreview: string | null
  setConflictPath: (path: string | null) => void

  // Vault health
  healthDashboardOpen: boolean
  onCloseHealthDashboard: () => void
  onOpenIssueFromHealth: (path: string, line?: number | null) => void
  onRebuildIndexFromHealth: () => void
  onFixVaultLintFromHealth: () => void
  onOpenWorkbenchFromHealth: () => void
  onGenerateLinkReferencesFromHealth: () => void

  // Frontmatter
  frontmatterOpen: boolean
  setFrontmatterOpen: (open: boolean) => void

  // Knowledge Workbench
  knowledgeWorkbenchOpen: boolean
  knowledgeWorkbenchTab: KnowledgeWorkbenchTab
  onCloseKnowledgeWorkbench: () => void
  onOpenNoteFromWorkbench: (path: string) => void
  onOpenGraphFromWorkbench: () => void
  onCreateNoteFromWikilink: (target: string) => void
  onInsertTagFromWorkbench: (tag: string) => void
  onRenameTagFromWorkbench: (tag: string) => void

  // Publish center
  publishCenterOpen: boolean
  publishPlan: ComponentProps<typeof PublishCenter>['publishPlan']
  publishApplying: boolean
  onClosePublishCenter: () => void
  onExportFromPublishCenter: (profileId: string, dryRun?: boolean) => void
  onCancelExportFromPublishCenter: () => void
  onPlanStarlight: () => void
  onReplanStarlight: () => void
  onApplyPlanFromPublishCenter: (selectedPaths: string[], deleteOrphans: string[]) => void

  // Snippets
  snippetsOpen: boolean
  setSnippetsOpen: (open: boolean) => void

  // Cheatsheet
  cheatsheetOpen: boolean
  setCheatsheetOpen: (open: boolean) => void

  // Support
  supportOpen: boolean
  setSupportOpen: (open: boolean) => void

  // Perf HUD
  perfHudOpen: boolean
  setPerfHudOpen: (open: boolean) => void

  // Text Prompt
  promptText: (request: TextPromptRequest) => Promise<string | null>
}

function WorkspaceDialogLayersImpl({
  workspace,
  plugins,
  nativeReady,
  draftWordCount,
  deferredDraft,
  previewBridge,
  onboarding,
  perfMetrics,
  writingTargetsOpen,
  setWritingTargetsOpen,
  conflictPath,
  conflictSource,
  conflictBasePreview,
  setConflictPath,
  healthDashboardOpen,
  onCloseHealthDashboard,
  onOpenIssueFromHealth,
  onRebuildIndexFromHealth,
  onFixVaultLintFromHealth,
  onOpenWorkbenchFromHealth,
  onGenerateLinkReferencesFromHealth,
  frontmatterOpen,
  setFrontmatterOpen,
  knowledgeWorkbenchOpen,
  knowledgeWorkbenchTab,
  onCloseKnowledgeWorkbench,
  onOpenNoteFromWorkbench,
  onOpenGraphFromWorkbench,
  onCreateNoteFromWikilink,
  onInsertTagFromWorkbench,
  onRenameTagFromWorkbench,
  publishCenterOpen,
  publishPlan,
  publishApplying,
  onClosePublishCenter,
  onExportFromPublishCenter,
  onCancelExportFromPublishCenter,
  onPlanStarlight,
  onReplanStarlight,
  onApplyPlanFromPublishCenter,
  snippetsOpen,
  setSnippetsOpen,
  cheatsheetOpen,
  setCheatsheetOpen,
  supportOpen,
  setSupportOpen,
  perfHudOpen,
  setPerfHudOpen,
  promptText,
}: WorkspaceDialogLayersProps) {
  const handleDailyTargetChange = useCallback(
    (value: number) => {
      workspace.setVaultConfig((current) => ({
        ...current,
        writing_targets: {
          ...current.writing_targets,
          daily_words: value,
          history_path: current.writing_targets?.history_path ?? '.scriptor/stats-history.json',
        },
      }))
      if (nativeReady) {
        void mutateVaultConfig((current) => ({
          ...current,
          writing_targets: {
            ...current.writing_targets,
            daily_words: value,
            history_path: current.writing_targets?.history_path ?? '.scriptor/stats-history.json',
          },
        })).catch((error) => {
          workspace.logActivity(
            'error',
            'Writing target save failed',
            error instanceof Error ? error.message : String(error),
          )
        })
      }
    },
    [workspace, nativeReady],
  )

  const handleCloseWritingTargets = useCallback(() => {
    recordWritingSession(draftWordCount)
    setWritingTargetsOpen(false)
  }, [draftWordCount, setWritingTargetsOpen])

  const hasAnyDialogOpen =
    writingTargetsOpen ||
    Boolean(conflictPath && conflictSource) ||
    healthDashboardOpen ||
    (frontmatterOpen && Boolean(workspace.activePath)) ||
    knowledgeWorkbenchOpen ||
    publishCenterOpen ||
    snippetsOpen ||
    cheatsheetOpen ||
    onboarding.onboardingOpen ||
    supportOpen ||
    perfHudOpen

  if (!hasAnyDialogOpen) {
    return null
  }

  return (
    <>
      {writingTargetsOpen && (
        <ErrorBoundary
          name="writing-targets-panel"
          autoRetryPanelFallback={false}
          fallback={<PanelErrorFallback title="Writing targets" onDismiss={() => setWritingTargetsOpen(false)} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <WritingTargetsPanel
              dailyTarget={workspace.vaultConfig.writing_targets?.daily_words ?? 500}
              wordsToday={draftWordCount}
              onDailyTargetChange={handleDailyTargetChange}
              onClose={handleCloseWritingTargets}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {conflictPath && conflictSource ? (
        <ConflictResolverSurface
          conflictPath={conflictPath}
          conflictSource={conflictSource}
          conflictBasePreview={conflictBasePreview}
          isBusy={workspace.isGitBusy}
          onClose={() => setConflictPath(null)}
          onResolved={() => void workspace.refreshGit()}
        />
      ) : null}

      {healthDashboardOpen && (
        <ErrorBoundary
          name="vault-health-panel"
          fallback={<PanelErrorFallback title="Vault health" onDismiss={onCloseHealthDashboard} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <VaultHealthDashboard
              diagnostics={workspace.healthDiagnostics}
              inspectorWidgets={plugins.contributions.inspectorWidgets}
              vaultHealthChecks={plugins.contributions.vaultHealthChecks}
              onClose={onCloseHealthDashboard}
              onOpenIssue={onOpenIssueFromHealth}
              onRebuildIndex={onRebuildIndexFromHealth}
              onFixVaultLint={onFixVaultLintFromHealth}
              onOpenWorkbench={onOpenWorkbenchFromHealth}
              onGenerateLinkReferences={onGenerateLinkReferencesFromHealth}
              isFixingVaultLint={workspace.isFixingVaultLint}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {frontmatterOpen && workspace.activePath ? (
        <FrontmatterInspector
          key={`${workspace.activePath}:${workspace.activeNote?.metadata.content_hash ?? ''}`}
          path={workspace.activePath}
          fields={parseSimpleFrontmatter(workspace.draftMarkdown)}
          onClose={() => setFrontmatterOpen(false)}
          onSaved={() => void workspace.reloadActiveNoteFromDisk()}
        />
      ) : null}

      {knowledgeWorkbenchOpen && (
        <ErrorBoundary
          name="knowledge-workbench"
          resetKeys={[workspace.activePath]}
          fallback={<PanelErrorFallback title="The workbench" onDismiss={() => onCloseKnowledgeWorkbench()} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <KnowledgeWorkbench
              vaultOpen={Boolean(workspace.vault)}
              vaultId={workspace.vault?.id}
              initialTab={knowledgeWorkbenchTab}
              activePath={workspace.activePath}
              onClose={onCloseKnowledgeWorkbench}
              onOpenNote={onOpenNoteFromWorkbench}
              onOpenGraph={onOpenGraphFromWorkbench}
              onCreateNoteFromWikilink={onCreateNoteFromWikilink}
              onInsertTag={onInsertTagFromWorkbench}
              onRenameTag={onRenameTagFromWorkbench}
              promptText={promptText}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {publishCenterOpen && (
        <ErrorBoundary
          name="publish-center"
          resetKeys={[workspace.activePath]}
          fallback={<PanelErrorFallback title="Publish Center" onDismiss={onClosePublishCenter} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <PublishCenter
              activePath={workspace.activePath}
              draftMarkdown={deferredDraft}
              previewProps={previewBridge}
              exportProfiles={workspace.exportProfiles}
              exportHistory={workspace.exportHistory}
              exportResult={workspace.exportResult}
              isExporting={workspace.isExporting}
              nativeReady={nativeReady}
              onClose={onClosePublishCenter}
              onExport={onExportFromPublishCenter}
              onCancelExport={onCancelExportFromPublishCenter}
              publishPlan={publishPlan}
              applyingPlan={publishApplying}
              publishRequireOptIn
              onPlanStarlight={onPlanStarlight}
              onReplanStarlight={onReplanStarlight}
              onApplyPlan={onApplyPlanFromPublishCenter}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {snippetsOpen && (
        <ErrorBoundary
          name="snippets-panel"
          fallback={<PanelErrorFallback title="Snippets" onDismiss={() => setSnippetsOpen(false)} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <SnippetsPanelLazy
              vaultOpen={Boolean(workspace.vault)}
              onClose={() => setSnippetsOpen(false)}
              onSaved={() => void workspace.refreshVaultSnippets()}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {cheatsheetOpen ? (
        <ErrorBoundary
          name="cheatsheet-panel"
          autoRetryPanelFallback={false}
          fallback={<PanelErrorFallback title="Cheatsheet" onDismiss={() => setCheatsheetOpen(false)} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <CheatsheetPanel onClose={() => setCheatsheetOpen(false)} />
          </Suspense>
        </ErrorBoundary>
      ) : null}

      {onboarding.onboardingOpen ? (
        <ErrorBoundary
          name="onboarding-tour"
          autoRetryPanelFallback={false}
          fallback={<PanelErrorFallback title="Onboarding tour" onDismiss={onboarding.completeOnboarding} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <OnboardingTour
              onComplete={onboarding.completeOnboarding}
              onOpenCheatsheet={() => {
                onboarding.completeOnboarding()
                setCheatsheetOpen(true)
              }}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}

      {supportOpen ? (
        <ErrorBoundary
          name="support-panel"
          autoRetryPanelFallback={false}
          fallback={<PanelErrorFallback title="Support" onDismiss={() => setSupportOpen(false)} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <SupportPanel onClose={() => setSupportOpen(false)} />
          </Suspense>
        </ErrorBoundary>
      ) : null}

      {perfHudOpen ? (
        <ErrorBoundary
          name="perf-hud"
          autoRetryPanelFallback={false}
          fallback={<PanelErrorFallback title="Performance HUD" onDismiss={() => setPerfHudOpen(false)} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <PerfHudOverlay metrics={perfMetrics.metrics} />
          </Suspense>
        </ErrorBoundary>
      ) : null}
    </>
  )
}

export const WorkspaceDialogLayers = memo(WorkspaceDialogLayersImpl)
