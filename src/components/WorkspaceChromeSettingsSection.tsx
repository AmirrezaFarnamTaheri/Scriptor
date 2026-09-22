import { memo } from 'react'

import { DEFAULT_WORKSPACE_CHROME, type WorkspaceChromePrefs } from '../hooks/useWorkspaceChrome'
import { useI18n } from '../lib/i18n'

type WorkspaceChromeBooleanKey =
  | 'showTopBar'
  | 'showModeStrip'
  | 'showQuickActions'
  | 'showHistoryControls'
  | 'showFormatToolbar'
  | 'showEditorAssist'
  | 'showEditorStatus'
  | 'showInspectorHealth'
  | 'showWorkspaceFooter'
  | 'showStatusBar'
  | 'showLineNumbers'
  | 'vaultSidebarCollapsed'
  | 'inspectorCollapsed'
  | 'layoutLocked'

interface WorkspaceChromeSettingsSectionProps {
  workspaceChrome: WorkspaceChromePrefs
  onPatchWorkspaceChrome: (patch: Partial<WorkspaceChromePrefs>) => void
}

/**
 * Owns workspace visibility and chrome behavior.
 *
 * These controls used to live under Appearance, where “Reset appearance”
 * unexpectedly reset panel visibility, collapse state, and layout locking.
 * Keeping structural chrome in Workspace gives each settings tab one job.
 */
export const WorkspaceChromeSettingsSection = memo(function WorkspaceChromeSettingsSection({
  workspaceChrome,
  onPatchWorkspaceChrome,
}: WorkspaceChromeSettingsSectionProps) {
  const { t } = useI18n()
  const toggles: ReadonlyArray<readonly [WorkspaceChromeBooleanKey, string]> = [
    ['showTopBar', t('appearanceSettings.toggles.showTopBar')],
    ['showModeStrip', t('appearanceSettings.toggles.showModeStrip')],
    ['showQuickActions', t('appearanceSettings.toggles.showQuickActions')],
    ['showHistoryControls', t('appearanceSettings.toggles.showHistoryControls')],
    ['showFormatToolbar', t('appearanceSettings.toggles.showFormatToolbar')],
    ['showEditorAssist', t('appearanceSettings.toggles.showEditorAssist')],
    ['showEditorStatus', t('appearanceSettings.toggles.showEditorStatus')],
    ['showInspectorHealth', t('settingsSection.showInspectorHealth')],
    ['showWorkspaceFooter', t('appearanceSettings.toggles.showWorkspaceFooter')],
    ['showStatusBar', t('appearanceSettings.toggles.showStatusBar')],
    ['showLineNumbers', t('appearanceSettings.toggles.showLineNumbers')],
    ['vaultSidebarCollapsed', t('appearanceSettings.toggles.vaultSidebarCollapsed')],
    ['inspectorCollapsed', t('appearanceSettings.toggles.inspectorCollapsed')],
    ['layoutLocked', t('appearanceSettings.toggles.layoutLocked')],
  ]

  return (
    <section className="settings-section" aria-labelledby="workspace-chrome-heading" data-help-topic="workspace-chrome">
      <h3 id="workspace-chrome-heading">{t('settingsPanel.workspaceChrome')}</h3>
      <p className="health-subtitle">{t('settingsPanel.workspaceChromeHelp')}</p>
      <div className="settings-grid settings-toggles">
        {toggles.map(([key, label]) => (
          <label className="diagnostics-opt-in" key={key}>
            <input
              type="checkbox"
              checked={workspaceChrome[key]}
              onChange={(event) => onPatchWorkspaceChrome({ [key]: event.target.checked })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="toolbar-button"
        onClick={() => onPatchWorkspaceChrome({
          showTopBar: DEFAULT_WORKSPACE_CHROME.showTopBar,
          showModeStrip: DEFAULT_WORKSPACE_CHROME.showModeStrip,
          showQuickActions: DEFAULT_WORKSPACE_CHROME.showQuickActions,
          showHistoryControls: DEFAULT_WORKSPACE_CHROME.showHistoryControls,
          showFormatToolbar: DEFAULT_WORKSPACE_CHROME.showFormatToolbar,
          showEditorAssist: DEFAULT_WORKSPACE_CHROME.showEditorAssist,
          showEditorStatus: DEFAULT_WORKSPACE_CHROME.showEditorStatus,
          showInspectorHealth: DEFAULT_WORKSPACE_CHROME.showInspectorHealth,
          showWorkspaceFooter: DEFAULT_WORKSPACE_CHROME.showWorkspaceFooter,
          showStatusBar: DEFAULT_WORKSPACE_CHROME.showStatusBar,
          showLineNumbers: DEFAULT_WORKSPACE_CHROME.showLineNumbers,
          vaultSidebarCollapsed: DEFAULT_WORKSPACE_CHROME.vaultSidebarCollapsed,
          inspectorCollapsed: DEFAULT_WORKSPACE_CHROME.inspectorCollapsed,
          layoutLocked: DEFAULT_WORKSPACE_CHROME.layoutLocked,
        })}
      >
        {t('settingsPanel.resetWorkspaceChrome')}
      </button>
    </section>
  )
})
