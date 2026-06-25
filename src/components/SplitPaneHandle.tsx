interface SplitPaneHandleProps {
  dragging: boolean
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void
  onDoubleClick: () => void
}

export function SplitPaneHandle({
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
}: SplitPaneHandleProps) {
  return (
    <div
      className={`split-pane-handle ${dragging ? 'is-dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize editor and preview panes"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onDoubleClick()
        }
      }}
    />
  )
}
