import type { PluginManifest } from '@scriptor/core/contracts/plugin'

import { canvasTemplateCatalog } from '@scriptor/canvas'

export const canvasKitManifest: PluginManifest = {
  id: 'scriptor.canvas-kit',
  name: 'Canvas Kit',
  version: '0.1.0',
  publisher: 'Scriptor',
  description: 'Built-in canvas templates and board tools.',
  activation: ['on-startup'],
  capabilities: ['canvas-tool', 'template-pack'],
  permissions: [{ permission: 'read', reason: 'Read note metadata when placing markdown blocks on boards.' }],
  contributes: {
    templatePacks: canvasTemplateCatalog.map((entry) => ({
      id: entry.id,
      label: entry.name,
      categories: [entry.category],
      canvasCompatible: true,
      documentCompatible: false,
    })),
    canvasTools: [
      { id: 'select', label: 'Select', commandId: 'canvas.select', toolKind: 'select' },
      { id: 'draw', label: 'Ink', commandId: 'canvas.draw', toolKind: 'draw' },
      { id: 'table', label: 'Table', commandId: 'canvas.table', toolKind: 'place' },
      { id: 'template', label: 'Template', commandId: 'canvas.template', toolKind: 'template' },
    ],
  },
}
