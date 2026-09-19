import { memo } from 'react'

import type { WorkspaceChromePrefs } from '../hooks/useWorkspaceChrome'
import { useI18n } from '../lib/i18n'

interface WorkspaceChromeSettingsSectionProps {
  workspaceChrome: WorkspaceChromePrefs
  onPatchWorkspaceChrome: (patch: Partial<WorkspaceChromePrefs>) => void
  onResetWorkspaceChrome?: () => void
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
  onResetWorkspaceChrome,
}: WorkspaceChromeSettingsSectionProps) {
  const { t } = useI18n()
  const toggles = [
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
  ] as const satisfies readonly (readonly [
    keyof Pick<
      WorkspaceChromePrefs,
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
    >,
    string,
  ])[]

  return (
    <section className="settings-section" aria-labelledby="workspace-chrome-heading">
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
      {onResetWorkspaceChrome ? (
        <button type="button" className="toolbar-button" onClick={onResetWorkspaceChrome}>
          {t('settingsPanel.resetWorkspaceChrome')}
        </button>
      ) : null}
    </section>
  )
})
