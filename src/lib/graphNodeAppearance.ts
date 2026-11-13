/** Visual hierarchy for large canvas-backed knowledge graphs. */
export interface GraphNodeAppearanceInput {
  /** Whether the current note's immediate connections are the visual focus. */
  focusMode: boolean
  isFocus: boolean
  isNeighbor: boolean
  isHovered: boolean
  isKeyboardFocus: boolean
  /** Phone-width 100+ note overview: avoid 28px discs merging into a blob. */
  compactOverview?: boolean
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
  compactOverview = false,
}: GraphNodeAppearanceInput): GraphNodeAppearance {
  if (focusMode && !isFocus && !isNeighbor && !isHovered && !isKeyboardFocus) {
    return { radius: 6, alpha: 0.2 }
  }
  if (compactOverview && !focusMode) {
    return { radius: isFocus || isHovered || isKeyboardFocus ? 12 : 7, alpha: 1 }
  }
  return { radius: isFocus || isHovered ? 18 : 14, alpha: 1 }
}

/**
 * A 120-note expanded network cannot fit 28px-diameter markers into the
 * 350px-wide phone graph stage. Reduce only the *overview* symbol and
 * reciprocal-arrow geometry. Focused views and desktop targets remain intact.
 * Search and keyboard traversal provide precise access to crowded notes.
 */
export function graphCanvasDensityMetrics(
  nodeCount: number,
  width: number,
  focusNeighborhoodOnly: boolean,
): { radiusScale: number; hitRadius: number; edgeOffsetScale: number; arrowScale: number } {
  if (nodeCount >= 80 && width <= 480 && !focusNeighborhoodOnly) {
    return { radiusScale: 0.52, hitRadius: 12, edgeOffsetScale: 0.6, arrowScale: 0.7 }
  }
  return { radiusScale: 1, hitRadius: 20, edgeOffsetScale: 1, arrowScale: 1 }
}
