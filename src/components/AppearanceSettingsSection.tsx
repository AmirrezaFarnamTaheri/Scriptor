import type { AppTheme } from '../hooks/useAppTheme'
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
  onThemeChange?: (theme: AppTheme) => void
  onReplayOnboarding?: () => void
}

export function AppearanceSettingsSection({
  workspaceChrome,
  onPatchWorkspaceChrome,
  onResetWorkspaceChrome,
  theme,
  onThemeChange,
  onReplayOnboarding,
}: AppearanceSettingsSectionProps) {
  return (
    <div className="settings-section">
      <h3>Appearance &amp; layout</h3>
      {onThemeChange ? (
        <label className="settings-field">
          <span>Color theme</span>
          <select
            value={theme}
            onChange={(event) => onThemeChange(event.target.value as AppTheme)}
          >
            {COLOR_PALETTE_SCHEMES.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name} ({scheme.category})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="settings-field">
        <span>UI Display Font</span>
        <select
          value={workspaceChrome.uiFontFamily}
          onChange={(event) => onPatchWorkspaceChrome({ uiFontFamily: event.target.value as UiFontFamily })}
        >
          <option value="system">System UI (Default)</option>
          <option value="inter">Inter Modern</option>
          <option value="sf-pro">SF Pro Display</option>
          <option value="avenir-next">Avenir Next</option>
          <option value="outfit">Outfit Geometric</option>
          <option value="jetbrains-mono">JetBrains Mono</option>
          <option value="georgia">Georgia Book Serif</option>
        </select>
      </label>
      <label className="settings-field">
        <span>UI Layout Density</span>
        <select
          value={workspaceChrome.uiDensity}
          onChange={(event) => onPatchWorkspaceChrome({ uiDensity: event.target.value as UiDensity })}
        >
          <option value="compact">Compact (Dense)</option>
          <option value="comfortable">Comfortable (Standard)</option>
          <option value="spacious">Spacious (Relaxed)</option>
        </select>
      </label>
      <label className="settings-field">
        <span>UI Border Radius</span>
        <select
          value={workspaceChrome.uiBorderRadius}
          onChange={(event) => onPatchWorkspaceChrome({ uiBorderRadius: event.target.value as UiBorderRadius })}
        >
          <option value="sharp">Sharp (0px)</option>
          <option value="rounded">Rounded (Standard)</option>
          <option value="curved">Curved (18px)</option>
          <option value="pill">Pill (999px)</option>
        </select>
      </label>
      <label className="settings-field">
        <span>Glassmorphism Backdrop Blur</span>
        <select
          value={workspaceChrome.glassBlur}
          onChange={(event) => onPatchWorkspaceChrome({ glassBlur: event.target.value as GlassBlurIntensity })}
        >
          <option value="none">Opaque (No Blur)</option>
          <option value="subtle">Subtle (12px)</option>
          <option value="glass">Balanced Glass (24px)</option>
          <option value="heavy">Deep Frosted (40px)</option>
        </select>
      </label>
      {onReplayOnboarding ? (
        <button type="button" className="toolbar-button" onClick={onReplayOnboarding}>
          Replay product tour
        </button>
      ) : null}
      {onResetWorkspaceChrome ? (
        <button type="button" className="toolbar-button" onClick={onResetWorkspaceChrome}>
          Reset appearance defaults
        </button>
      ) : null}
      <p className="health-subtitle">Fine-tune sidebars, toolbars, typography, and panel stats.</p>
      <div className="settings-grid settings-toggles">
        {(
          [
            ['showTopBar', 'Show top navigation header'],
            ['showModeStrip', 'Show workspace mode strip'],
            ['showQuickActions', 'Show topbar quick action buttons'],
            ['showHistoryControls', 'Show history navigation bar'],
            ['showFormatToolbar', 'Show format toolbar'],
            ['showEditorAssist', 'Show editor assist chips'],
            ['showEditorStatus', 'Show editor status bar'],
            ['showInspectorHealth', 'Show inspector note health'],
            ['showWorkspaceFooter', 'Show workspace footer dock'],
            ['showStatusBar', 'Show bottom status bar'],
            ['showLineNumbers', 'Show line numbers'],
            ['vaultSidebarCollapsed', 'Collapse vault sidebar'],
            ['inspectorCollapsed', 'Collapse inspector'],
            ['layoutLocked', 'Lock Workspace Layout'],
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
        Editor font size (px)
        <input
          type="number"
          min={11}
          max={24}
          value={workspaceChrome.editorFontSize}
          onChange={(event) => onPatchWorkspaceChrome({ editorFontSize: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        Editor font family
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
        Editor line height
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
        Editor side padding (px)
        <input
          type="number"
          min={4}
          max={48}
          value={workspaceChrome.editorPaddingPx}
          onChange={(event) => onPatchWorkspaceChrome({ editorPaddingPx: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        Split/Inspector preview max width (ch)
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
}
