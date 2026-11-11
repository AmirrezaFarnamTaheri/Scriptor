/** Visual hierarchy for large canvas-backed knowledge graphs. */
export interface GraphNodeAppearanceInput {
  /** Whether the current note's immediate connections are the visual focus. */
  focusMode: boolean
  isFocus: boolean
  isNeighbor: boolean
  isHovered: boolean
  isKeyboardFocus: boolean
}

export interface GraphNodeAppearance {
  radius: number
  alpha: number
}

/**
 * Background notes remain visible as compact context marks in neighborhood
 * mode. Hover/keyboard focus reveals just the active note; it must not make the
 * entire vault flash back to full-density circles. The complete appearance is
 * restored when the user explicitly switches to all links.
 */
export function graphNodeAppearance({
  focusMode,
  isFocus,
  isNeighbor,
  isHovered,
  isKeyboardFocus,
}: GraphNodeAppearanceInput): GraphNodeAppearance {
  if (focusMode && !isFocus && !isNeighbor && !isHovered && !isKeyboardFocus) {
    return { radius: 6, alpha: 0.2 }
  }
  return { radius: isFocus || isHovered ? 18 : 14, alpha: 1 }
}
