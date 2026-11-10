import { memo, useState } from 'react'
import type { WorkspaceLayout } from '../hooks/useWorkspaceLayout'
import { LAYOUT_PRESETS, type LayoutPreset } from '../lib/workspace/layoutPresets'

function matchesLayout(a: WorkspaceLayout | undefined, b: WorkspaceLayout): boolean {
  if (!a) return false
  return a.splitPreview === b.splitPreview &&
    a.showStickies === b.showStickies &&
    a.graphDepth === b.graphDepth &&
    a.distractionFree === b.distractionFree
}

interface LayoutPresetGalleryProps {
  current: WorkspaceLayout | undefined
  onApply: (preset: LayoutPreset) => void
}

export const LayoutPresetGallery = memo(function LayoutPresetGallery({ current, onApply }: LayoutPresetGalleryProps) {
  const [selectedId, setSelectedId] = useState(LAYOUT_PRESETS[0]!.id)
  const selected = LAYOUT_PRESETS.find(preset => preset.id === selectedId) ?? LAYOUT_PRESETS[0]!
  const active = matchesLayout(current, selected.layout)
  return (
    <div className="settings-layout-presets" data-help-topic="docks">
      <h4 className="settings-subheading">Layout templates</h4>
      <p className="health-subtitle">Choose a layout to preview it before applying changes to this workspace.</p>
      <ul className="layout-preset-list" aria-label="Layout templates">
        {LAYOUT_PRESETS.map(preset => (
          <li key={preset.id} className="layout-preset-item">
            <label className="layout-preset-choice" data-selected={selected.id === preset.id}>
              <input type="radio" name="scriptor-layout-preset" checked={selected.id === preset.id}
                onChange={() => setSelectedId(preset.id)} />
              <span>{preset.name}</span>
              {matchesLayout(current, preset.layout) ? <small>Current</small> : null}
            </label>
          </li>
        ))}
      </ul>
      <div className="layout-preset-detail">
        <div className={`layout-preset-preview${selected.layout.distractionFree ? ' is-focused' : ''}`}
          role="img" aria-label={`${selected.name} layout preview: ${selected.description}`}>
          <span className="layout-preset-preview-vault" aria-hidden="true" />
          <span className="layout-preset-preview-editor" aria-hidden="true"><span /><span /><span /></span>
          {selected.layout.splitPreview ? <span className="layout-preset-preview-render" aria-hidden="true"><span /><span /></span> : null}
          {selected.layout.showStickies ? <span className="layout-preset-preview-sticky" aria-hidden="true" /> : null}
        </div>
        <div className="layout-preset-detail-copy">
          <strong>{selected.name}</strong>
          <p className="health-subtitle">{selected.description}</p>
          <p className="health-subtitle">Graph depth: {selected.layout.graphDepth}</p>
          <button type="button" className="primary-button" aria-label={`Apply ${selected.name} layout template`}
            disabled={active} onClick={() => onApply(selected)}>
            {active ? 'Current layout' : `Apply ${selected.name}`}
          </button>
        </div>
      </div>
    </div>
  )
})
