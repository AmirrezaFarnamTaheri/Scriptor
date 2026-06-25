import type { CanvasBlock } from '@scriptor/core/contracts/canvas'

export type CanvasTemplateId = 'research-board' | 'weekly-plan'

export function blocksForTemplate(templateId: string): CanvasBlock[] {
  if (templateId === 'weekly-plan') {
    return [
      sticky('mon', 20, 20, '#fee2e2', 'Mon'),
      sticky('tue', 140, 20, '#ffedd5', 'Tue'),
      sticky('wed', 260, 20, '#fef9c3', 'Wed'),
      sticky('thu', 380, 20, '#dcfce7', 'Thu'),
      sticky('fri', 500, 20, '#dbeafe', 'Fri'),
      markdown('focus', 20, 160, 'Weekly focus'),
    ]
  }

  return [
    sticky('question', 40, 40, '#fef3c7', 'Research question'),
    sticky('evidence', 220, 40, '#dbeafe', 'Evidence cluster'),
    sticky('synthesis', 400, 40, '#dcfce7', 'Synthesis'),
    markdown('summary', 40, 220, 'Summary note'),
  ]
}

function sticky(id: string, x: number, y: number, fill: string, label: string): CanvasBlock {
  return {
    id: `${id}-${crypto.randomUUID().slice(0, 8)}`,
    kind: 'sticky-note',
    layerId: 'layer-main',
    bounds: { x, y, width: 100, height: 80 },
    zIndex: 1,
    contentRef: label,
    style: { fill, stroke: '#334155', strokeWidth: 1 },
  }
}

function markdown(id: string, x: number, y: number, label: string): CanvasBlock {
  return {
    id: `${id}-${crypto.randomUUID().slice(0, 8)}`,
    kind: 'markdown',
    layerId: 'layer-main',
    bounds: { x, y, width: 280, height: 160 },
    zIndex: 2,
    contentRef: label,
    style: { fill: '#ffffff', stroke: '#94a3b8', strokeWidth: 1, textStyle: 'heading' },
  }
}
