import { memo } from 'react'
import { readStoredCustomThemes, type AppTheme, type AppearanceMode } from '../hooks/useAppTheme'
import { useI18n } from '../lib/i18n'
import { COLOR_PALETTE_SCHEMES } from '../brand/palettes'
import { EDITOR_FONT_FAMILIES } from '../brand/support'
import {
  DEFAULT_WORKSPACE_CHROME,
  type GlassBlurIntensity,
  type UiBorderRadius,
  type UiDensity,
  type UiFontFamily,
  type WorkspaceChromePrefs,
} from '../hooks/useWorkspaceChrome'

export interface AppearanceSettingsSectionProps {
  workspaceChrome: WorkspaceChromePrefs
  onPatchWorkspaceChrome: (patch: Partial<WorkspaceChromePrefs>) => void
  theme?: AppTheme
  appearance?: AppearanceMode
  onThemeChange?: (theme: AppTheme) => void
  onAppearanceChange?: (appearance: AppearanceMode) => void
  onManagePalettes?: () => void
}

export const AppearanceSettingsSection = memo(function AppearanceSettingsSection({
  workspaceChrome,
  onPatchWorkspaceChrome,
  theme,
  appearance = 'system',
  onThemeChange,
  onAppearanceChange,
  onManagePalettes,
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
      {onManagePalettes ? (
        <button type="button" className="toolbar-button" onClick={onManagePalettes}>
          {t('appearanceSettings.managePalettes')}
        </button>
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
      <button
        type="button"
        className="toolbar-button"
        onClick={() => {
          onThemeChange?.('dark')
          onAppearanceChange?.('system')
          onPatchWorkspaceChrome({
            uiFontFamily: DEFAULT_WORKSPACE_CHROME.uiFontFamily,
            uiDensity: DEFAULT_WORKSPACE_CHROME.uiDensity,
            uiBorderRadius: DEFAULT_WORKSPACE_CHROME.uiBorderRadius,
            glassBlur: DEFAULT_WORKSPACE_CHROME.glassBlur,
            editorFontSize: DEFAULT_WORKSPACE_CHROME.editorFontSize,
            editorFontFamily: DEFAULT_WORKSPACE_CHROME.editorFontFamily,
            editorLineHeight: DEFAULT_WORKSPACE_CHROME.editorLineHeight,
            editorPaddingPx: DEFAULT_WORKSPACE_CHROME.editorPaddingPx,
            previewMaxWidthCh: DEFAULT_WORKSPACE_CHROME.previewMaxWidthCh,
          })
        }}
      >
        {t('appearanceSettings.reset')}
      </button>
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

