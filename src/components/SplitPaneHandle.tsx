interface SplitPaneHandleProps {
  dragging: boolean
  direction?: 'left' | 'right' | 'horizontal' | 'vertical' | string
  locked?: boolean
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void
  onDoubleClick: () => void
}

export function SplitPaneHandle({
  dragging,
  direction,
  locked = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
}: SplitPaneHandleProps) {
  const orientation = direction === 'vertical' ? 'horizontal' : 'vertical'

  return (
    <div
      className={`split-pane-handle ${dragging ? 'is-dragging' : ''} ${locked ? 'is-locked' : ''}`}
      data-direction={direction}
      role="separator"
      aria-orientation={orientation}
      aria-label={locked ? 'Locked workspace border' : 'Resize editor and preview panes'}
      aria-valuemin={160}
      aria-valuemax={1600}
      aria-valuenow={800}
      tabIndex={locked ? -1 : 0}
      onPointerDown={locked ? undefined : onPointerDown}
      onPointerMove={locked ? undefined : onPointerMove}
      onPointerUp={locked ? undefined : onPointerUp}
      onPointerCancel={locked ? undefined : onPointerCancel}
      onDoubleClick={locked ? undefined : onDoubleClick}
      onKeyDown={(event) => {
        if (locked) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onDoubleClick()
        }
      }}
    />
  )
}
