interface SplitPaneHandleProps {
  dragging: boolean
  direction?: 'left' | 'right' | 'horizontal' | 'vertical' | string
  locked?: boolean
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void
  onDoubleClick: () =>