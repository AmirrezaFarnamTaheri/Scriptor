export type InspectorPreset = 'balanced' | 'research' | 'publishing' | 'cleanup'

export interface InspectorPresetConfig {
  id: InspectorPreset
  label: string
  description: string
  showOutline: boolean
  showLinks: boolean
  showBacklinks: boolean
  showCitations: boolean
  showQuality: boolean
  showExportQuick: boolean
}

export const INSPECTOR_PRESETS: InspectorPresetConfig[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Default inspector layout.',
    showOutline: true,
    showLinks: true,
    showBacklinks: true,
    showCitations: true,
    showQuality: true,
    showExportQuick: false,
  },
  {
    id: 'research',
    label: 'Research',
    description: 'Links, backlinks, and citation context.',
    showOutline: true,
    showLinks: true,
    showBacklinks: true,
    showCitations: true,
    showQuality: true,
    showExportQuick: false,
  },
  {
    id: 'publishing',
    label: 'Publishing',
    description: 'Outline, quality checks, and export readiness.',
    showOutline: true,
    showLinks: false,
    showBacklinks: false,
    showCitations: true,
    showQuality: true,
    showExportQuick: true,
  },
  {
    id: 'cleanup',
    label: 'Cleanup',
    description: 'Quality signals and broken-link repair focus.',
    showOutline: false,
    showLinks: true,
    showBacklinks: true,
    showCitations: false,
    showQuality: true,
    showExportQuick: false,
  },
]

export function readInspectorPreset(): InspectorPreset {
  try {
    const raw = window.localStorage.getItem('scriptor:inspector-preset')
    if (raw === 'balanced' || raw === 'research' || raw === 'publishing' || raw === 'cleanup') {
      return raw
    }
  } catch {
    // ignore
  }
  return 'balanced'
}

export function writeInspectorPreset(preset: InspectorPreset) {
  try {
    window.localStorage.setItem('scriptor:inspector-preset', preset)
  } catch {
    // ignore
  }
}
