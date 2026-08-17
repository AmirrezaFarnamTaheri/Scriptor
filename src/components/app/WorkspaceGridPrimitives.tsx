import type { ComponentProps } from 'react'

import { SplitPaneHandle } from '../SplitPaneHandle'

type WorkspacePanelResizerProps = Pick<
  ComponentProps<typeof SplitPaneHandle>,
  | 'dragging'
  | 'locked'
  | 'onPointerDown'
  | 'onPointerMove'
  | 'onPointerUp'
  | 'onPointerCancel'
  | 'onDoubleClick'
> & {
  collapsed: boolean
  placeholderClassName: string
}

export function WorkspacePanelResizer({
  collapsed,
  placeholderClassName,
  ...handleProps
}: WorkspacePanelResizerProps) {
  if (collapsed) {
    return <div className={`resizer-placeholder ${placeholderClassName}`} />
  }

  return <SplitPaneHandle direction="horizontal" {...handleProps} />
}
