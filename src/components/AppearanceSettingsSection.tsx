import { memo } from 'react'
import { readStoredCustomThemes, type AppTheme, type AppearanceMode } from '../hooks/useAppTheme'
import { useI18n } from '../lib/i18n'
import { COLOR_PALETTE_SCHEMES } from '../brand/palettes'
import { EDITOR_FONT_FAMILIES } from '../brand/support'
import type {
  GlassBlurIntensity,
  UiBorderRadius,
  UiDensity,
  UiFontFamily,
  WorkspaceChromePrefs,
} from '../hooks/useWorkspaceChrome'

export interface AppearanceSettingsSectionProps {
  workspaceChrome: WorkspaceChromePrefs
  onPatchWorkspaceChrome: (patch: Partial<WorkspaceChromePrefs>) => void
  onResetWorkspaceChrome?: () => void
  theme?: AppTheme
  appearance?: AppearanceMode
  onThemeChange?: (theme: AppTheme) => void
  onAppearanceChange?: (appearance: AppearanceMode) => void
  onReplayOnboarding?: () => void
}

export const AppearanceSettingsSection = memo(function AppearanceSettingsSection({
  workspaceChrome,
  onPatchWorkspaceChrome,
  onResetWorkspaceChrome,
  theme,
  appearance = 'system',
  onThemeChange,
  onAppearanceChange,
  onReplayOnboarding,
}: AppearanceSettingsSectionProps) {
  const { t } = useI18n()
  const customPalettes = readStoredCustomThemes()
  return (
    <div className="settings-section">
      <h3>{t('appearanceSettings.title')}</h3>
      <p className="health-subtitle">
        {t('appearanceSettings.description')}
      </p>
      {onThemeChange ? (
        <label className="settings-field">
          <span>{t('appearanceSettings.colorPalette')}</span>
          <select
            value={theme}
            onChange={(event) => onThemeChange(event.target.value as AppTheme)}
          >
            {COLOR_PALETTE_SCHEMES.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name}
              </option>
            ))}
            {customPalettes.length ? <optgroup label={t('appearanceSettings.customPalettes')}>
              {customPalettes.map((palette) => (
                <option key={palette.id} value={palette.id}>{palette.name}</option>
              ))}
            </optgroup> : null}
          </select>
        </label>
      ) : null}
      {onAppearanceChange ? (
        <label className="settings-field">
          <span>{t('appearanceSettings.dayNight')}</span>
          <select
            value={appearance}
            onChange={(event) => onAppearanceChange(event.target.value as AppearanceMode)}
          >
            <option value="system">{t('appearanceSettings.followSystem')}</option>
            <option value="light">{t('appearanceSettings.day')}</option>
            <option value="dark">{t('appearanceSettings.night')}</option>
          </select>
        </label>
      ) : null}
      <label className="settings-field">
        <span>{t('appearanceSettings.uiFont')}</span>
        <select
          value={workspaceChrome.uiFontFamily}
          onChange={(event) => onPatchWorkspaceChrome({ uiFontFamily: event.target.value as UiFontFamily })}
        >
          <option value="system">{t('appearanceSettings.fonts.system')}</option>
          <option value="inter">{t('appearanceSettings.fonts.inter')}</option>
          <option value="sf-pro">{t('appearanceSettings.fonts.sfPro')}</option>
          <option value="avenir-next">{t('appearanceSettings.fonts.avenir')}</option>
          <option value="outfit">{t('appearanceSettings.fonts.outfit')}</option>
          <option value="jetbrains-mono">{t('appearanceSettings.fonts.jetbrains')}</option>
          <option value="georgia">{t('appearanceSettings.fonts.georgia')}</option>
        </select>
      </label>
      <label className="settings-field">
        <span>{t('appearanceSettings.density')}</span>
        <select
          value={workspaceChrome.uiDensity}
          onChange={(event) => onPatchWorkspaceChrome({ uiDensity: event.target.value as UiDensity })}
        >
          <option value="compact">{t('appearanceSettings.densityCompact')}</option>
          <option value="comfortable">{t('appearanceSettings.densityComfortable')}</option>
          <option value="spacious">{t('appearanceSettings.densitySpacious')}</option>
        </select>
      </label>
      <label className="settings-field">
        <span>{t('appearanceSettings.radius')}</span>
        <select
          value={workspaceChrome.uiBorderRadius}
          onChange={(event) => onPatchWorkspaceChrome({ uiBorderRadius: event.target.value as UiBorderRadius })}
        >
          <option value="sharp">{t('appearanceSettings.radiusSharp')}</option>
          <option value="rounded">{t('appearanceSettings.radiusRounded')}</option>
          <option value="curved">{t('appearanceSettings.radiusCurved')}</option>
          <option value="pill">{t('appearanceSettings.radiusPill')}</option>
        </select>
      </label>
      <label className="settings-field">
        <span>{t('appearanceSettings.blur')}</span>
        <select
          value={workspaceChrome.glassBlur}
          onChange={(event) => onPatchWorkspaceChrome({ glassBlur: event.target.value as GlassBlurIntensity })}
        >
          <option value="none">{t('appearanceSettings.blurNone')}</option>
          <option value="subtle">{t('appearanceSettings.blurSubtle')}</option>
          <option value="glass">{t('appearanceSettings.blurGlass')}</option>
          <option value="heavy">{t('appearanceSettings.blurHeavy')}</option>
        </select>
      </label>
      {onReplayOnboarding ? (
        <button type="button" className="toolbar-button" onClick={onReplayOnboarding}>
          {t('appearanceSettings.replayTour')}
        </button>
      ) : null}
      {onResetWorkspaceChrome ? (
        <button type="button" className="toolbar-button" onClick={onResetWorkspaceChrome}>
          {t('appearanceSettings.reset')}
        </button>
      ) : null}
      <p className="health-subtitle">{t('appearanceSettings.fineTune')}</p>
      <div className="settings-grid settings-toggles">
        {(
          [
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
          ] as const
        ).map(([key, label]) => (
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
      <label className="settings-field">
        {t('appearanceSettings.editorFontSize')}
        <input
          type="number"
          min={11}
          max={24}
          value={workspaceChrome.editorFontSize}
          onChange={(event) => onPatchWorkspaceChrome({ editorFontSize: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        {t('appearanceSettings.editorFontFamily')}
        <select
          value={workspaceChrome.editorFontFamily}
          onChange={(event) =>
            onPatchWorkspaceChrome({
              editorFontFamily: event.target.value as WorkspaceChromePrefs['editorFontFamily'],
            })
          }
        >
          {EDITOR_FONT_FAMILIES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        {t('appearanceSettings.editorLineHeight')}
        <input
          type="number"
          step={0.05}
          min={1.1}
          max={2.4}
          value={workspaceChrome.editorLineHeight}
          onChange={(event) => onPatchWorkspaceChrome({ editorLineHeight: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        {t('appearanceSettings.editorPadding')}
        <input
          type="number"
          min={4}
          max={48}
          value={workspaceChrome.editorPaddingPx}
          onChange={(event) => onPatchWorkspaceChrome({ editorPaddingPx: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        {t('appearanceSettings.previewWidth')}
        <input
          type="number"
          min={40}
          max={120}
          value={workspaceChrome.previewMaxWidthCh}
          onChange={(event) => onPatchWorkspaceChrome({ previewMaxWidthCh: Number(event.target.value) })}
        />
      </label>
    </div>
  )
})

