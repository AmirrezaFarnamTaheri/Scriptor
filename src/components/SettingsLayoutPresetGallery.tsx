import type { WorkspaceLayout } from '../hooks/useWorkspaceLayout'
import { LAYOUT_PRESETS, type LayoutPreset } from '../lib/workspace/layoutPresets'

function matchesLayout(a: WorkspaceLayout | undefined, b: WorkspaceLayout): boolean {
  if (!a) return false
  return (
    a.splitPreview === b.splitPreview &&
    a.showStickies === b.showStickies &&
    a.graphDepth === b.graphDepth &&
    a.distractionFree === b.distractionFree
  )
}

export function LayoutPresetGallery({
  current,
  onApply,
}: {
  current: WorkspaceLayout | undefined
  onApply: (preset: LayoutPreset) => void
}) {
  return (
    <div className="settings-layout-presets">
      <h4 className="settings-subheading">Layout templates</h4>
      <p className="health-subtitle">
        Apply a template to reconfigure this mode&apos;s split preview, stickies, and graph depth in one click.
      </p>
      <ul className="layout-preset-list">
        {LAYOUT_PRESETS.map((preset) => {
          const active = matchesLayout(current, preset.layout)
          return (
            <li key={preset.id} className="layout-preset-item">
              <div className="layout-preset-copy">
                <strong>{preset.name}</strong>
                <span className="health-subtitle">{preset.description}</span>
              </div>
              <button
                type="button"
                className="toolbar-button"
                aria-label={`Apply ${preset.name} layout template`}
                aria-pressed={active}
                onClick={() => onApply(preset)}
              >
                {active ? 'Active' : 'Apply'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
