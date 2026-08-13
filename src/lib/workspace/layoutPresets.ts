/**
 * Layout presets
 * --------------
 * Shippable alternate workspace layout templates surfaced in the Store's
 * "Layouts" tab. Each preset is a named {@link WorkspaceLayout} snapshot that
 * the user can apply to the active workspace mode with one click.
 *
 * Presets are pure data — applying one calls the existing
 * `useWorkspaceLayout().applyLayout(mode, preset.layout)` path, so no new
 * persistence surface is introduced.
 */

import type { WorkspaceLayout } from '../../hooks/useWorkspaceLayout'

export interface LayoutPreset {
  id: string
  name: string
  description: string
  layout: WorkspaceLayout
}

/**
 * Built-in layout templates. Ordered from most focused to most expansive so
 * the gallery reads as a progression.
 */
export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'zen',
    name: 'Zen',
    description: 'Distraction-free single pane. No preview, stickies, or graph clutter.',
    layout: { splitPreview: false, showStickies: false, graphDepth: 1, distractionFree: true },
  },
  {
    id: 'author',
    name: 'Author',
    description: 'Editor beside a live preview with quick-note stickies at hand.',
    layout: { splitPreview: true, showStickies: true, graphDepth: 2, distractionFree: false },
  },
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Deep graph context for tracing connections while you read and link.',
    layout: { splitPreview: false, showStickies: true, graphDepth: 4, distractionFree: false },
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    description: 'Split preview for comparing rendered output against source, no stickies.',
    layout: { splitPreview: true, showStickies: false, graphDepth: 2, distractionFree: false },
  },
  {
    id: 'atlas',
    name: 'Atlas',
    description: 'Maximum graph depth for exploring the whole vault as a map.',
    layout: { splitPreview: false, showStickies: false, graphDepth: 5, distractionFree: false },
  },
  {
    id: 'canvas',
    name: 'Canvas',
    description: 'Stickies-first ideation surface with shallow graph hints and no preview.',
    layout: { splitPreview: false, showStickies: true, graphDepth: 1, distractionFree: false },
  },
  {
    id: 'draft-sprint',
    name: 'Draft sprint',
    description: 'Distraction-free drafting that still keeps stickies within reach for capture.',
    layout: { splitPreview: false, showStickies: true, graphDepth: 1, distractionFree: true },
  },
  {
    id: 'synthesis',
    name: 'Synthesis',
    description: 'Preview, stickies, and deep graph together for weaving sources into one note.',
    layout: { splitPreview: true, showStickies: true, graphDepth: 4, distractionFree: false },
  },
]
