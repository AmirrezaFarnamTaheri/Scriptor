import { Ban, CheckCheck, Circle, CircleEllipsis, CornerDownRight, HelpCircle } from 'lucide-react'

import { getStatusMeta } from '@scriptor/core/task'

interface TaskStatusGlyphProps {
  status: string
  className?: string
}

export function TaskStatusGlyph({
  status,
  className = 'task-status-chip',
}: TaskStatusGlyphProps) {
  const meta = getStatusMeta(status)

  return (
    <span
      className={`${className} task-status-chip--${meta.cssClass}`}
      title={meta.label}
      aria-label={meta.label}
    >
      {renderStatusIcon(status)}
    </span>
  )
}

function renderStatusIcon(status: string) {
  switch (status) {
    case 'open':
      return <Circle aria-hidden="true" />
    case 'in-progress':
      return <CircleEllipsis aria-hidden="true" />
    case 'done':
      return <CheckCheck aria-hidden="true" />
    case 'cancelled':
      return <Ban aria-hidden="true" />
    case 'forwarded':
      return <CornerDownRight aria-hidden="true" />
    default:
      return <HelpCircle aria-hidden="true" />
  }
}
