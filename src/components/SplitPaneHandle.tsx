interface SplitPaneHandleProps {
  dragging: boolean
  direction?: 'left' | 'right' | 'horizontal' | 'vertical' | string
  locked?: boolean
  /** Editor pane width as a percentage of the workspace (0–100). */
  valueNow?: number
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void
  onDoubleClick: () => void
  /** Nudges the ratio by a delta (e.g. ±0.02 for arrow keys). */
  onNudge?: (delta: number) => void
}

const KEYBOARD_STEP = 0.02

export function SplitPaneHandle({
  dragging,
  direction,
  locked = false,
  valueNow = 50,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
  onNudge,
}: SplitPaneHandleProps) {
  const orientation = direction === 'vertical' ? 'horizontal' : 'vertical'
  const pct = Math.round(valueNow * 100)

  return (
    <div
      className={`split-pane-handle ${dragging ? 'is-dragging' : ''} ${locked ? 'is-locked' : ''}`}
      data-direction={direction}
      role="separator"
      aria-orientation={orientation}
      aria-label={locked ? 'Locked workspace border' : 'Resize editor and preview panes'}
      aria-valuemin={22}
      aria-valuemax={78}
      aria-valuenow={pct}
      aria-valuetext={`${pct}% of workspace width`}
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
          return
        }
        if (!onNudge) return
        const forward = event.key === 'ArrowRight' || event.key === 'ArrowUp'
        const back = event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        if (!forward && !back) return
        event.preventDefault()
        onNudge(forward ? KEYBOARD_STEP : -KEYBOARD_STEP)
      }}
    />
  )
}
