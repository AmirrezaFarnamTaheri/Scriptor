import { useCallback } from 'react'
import {
  attachPreviewCodeCopy,
  hydrateMpeCodeChunks,
  renderMarkdownPreview,
  renderMermaidDiagrams,
  renderPlantUmlDiagrams,
  sanitizeRenderedHtml,
} from '@scriptor/renderer'
import type { MarkdownVisualBlockRenderer } from '@scriptor/editor'
import type { MarkdownPreviewProps } from '@scriptor/renderer'

type PreviewBridge = Pick<
  MarkdownPreviewProps,
  'postProcessHtml' | 'renderPlantUmlLocal' | 'runCodeChunk'
>

/**
 * Builds the canonical renderer used by inactive fenced blocks in the writable
 * Preview and Split surfaces. Keeping this outside App.tsx preserves the
 * workspace module-size ratchet without coupling the editor package to the
 * renderer package.
 */
export function useVisualBlockRenderer(
  previewBridge: PreviewBridge,
  activePath: string | null,
): MarkdownVisualBlockRenderer {
  return useCallback<MarkdownVisualBlockRenderer>(
    (request, container) => {
      let html = renderMarkdownPreview(request.raw, {
        enableBreaks: true,
        basePath: activePath ?? undefined,
      })
      if (previewBridge.postProcessHtml) {
        try {
          html = sanitizeRenderedHtml(previewBridge.postProcessHtml(html))
        } catch {
          // A plugin failure must not erase the canonical block render.
        }
      }
      container.innerHTML = html

      void (async () => {
        try {
          await renderMermaidDiagrams(container)
          if (previewBridge.renderPlantUmlLocal) {
            await renderPlantUmlDiagrams(container, previewBridge.renderPlantUmlLocal)
          }
          if (previewBridge.runCodeChunk) {
            await hydrateMpeCodeChunks(container, previewBridge.runCodeChunk)
          }
          attachPreviewCodeCopy(container)
        } catch {
          // The source remains available by activating the block for editing.
        }
      })()
    },
    [activePath, previewBridge],
  )
}
