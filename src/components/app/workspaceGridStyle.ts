import type { CSSProperties } from 'react'

export type WorkspaceGridStyleOptions = {
  editorFontSize: number
  editorFontFamily: string
  editorLineHeight: number
  editorPaddingPx: number
  previewMaxWidthCh: number
  vaultWidth: number
  inspectorWidth: number
}

export function workspaceGridStyle({
  editorFontSize,
  editorFontFamily,
  editorLineHeight,
  editorPaddingPx,
  previewMaxWidthCh,
  vaultWidth,
  inspectorWidth,
}: WorkspaceGridStyleOptions): CSSProperties {
  return {
    '--editor-font-size': `${editorFontSize}px`,
    '--editor-font-family': editorFontFamily,
    '--editor-line-height': String(editorLineHeight),
    '--editor-padding': `${editorPaddingPx}px`,
    '--preview-max-ch': `${previewMaxWidthCh}ch`,
    '--vault-width': `${vaultWidth}px`,
    '--inspector-width': `${inspectorWidth}px`,
  } as CSSProperties
}
