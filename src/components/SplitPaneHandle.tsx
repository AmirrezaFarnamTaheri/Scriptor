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
  if (locked) {
    return (
      <div
        className="split-pane-handle is-locked"
        data-direction={direction}
        role="separator"
        aria-orientation="vertical"
        aria-label="Locked workspace border"
      />
    )
  }

  return (
    <div
      className={`split-pane-handle ${dragging ? 'is-dragging' : ''}`}
      data-direction={direction}
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
