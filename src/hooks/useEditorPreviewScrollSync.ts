import { useCallback, useEffect, useRef, type RefObject } from 'react'

import type { MarkdownEditorHandle } from '@scriptor/editor'
import type { MarkdownPreviewHandle } from '@scriptor/renderer'
import { getPreviewTopSourceLine, scrollPreviewToLine } from '@scriptor/renderer'

export function useEditorPreviewScrollSync({
  enabled,
  editorRef,
  previewRef,
  previewEditorRef,
  editablePreviewActive,
  scrollContainerRef,
}: {
  enabled: boolean
  editorRef: RefObject<MarkdownEditorHandle | null>
  previewRef: RefObject<MarkdownPreviewHandle | null>
  previewEditorRef: RefObject<MarkdownEditorHandle | null>
  editablePreviewActive: boolean
  scrollContainerRef: RefObject<HTMLElement | null>
}) {
  const lockRef = useRef(false)
  const frameRef = useRef<number | null>(null)

  const handleEditorLine = useCallback(
    (line: number) => {
      if (!enabled || lockRef.current) return

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null

        if (editablePreviewActive) {
          const previewEditor = previewEditorRef.current
          if (!previewEditor) return
          lockRef.current = true
          previewEditor.scrollToLine(line, false)
          requestAnimationFrame(() => {
            lockRef.current = false
          })
          return
        }

        const content = previewRef.current?.getContentRoot()
        const container = scrollContainerRef.current
        if (!content || !container) return

        lockRef.current = true
        scrollPreviewToLine(container, content, line)
        requestAnimationFrame(() => {
          lockRef.current = false
        })
      })
    },
    [editablePreviewActive, enabled, previewEditorRef, previewRef, scrollContainerRef],
  )

  const handlePreviewLine = useCallback(
    (line: number) => {
      if (!enabled || !editablePreviewActive || lockRef.current) return
      const editor = editorRef.current
      if (!editor) return

      lockRef.current = true
      editor.scrollToLine(line, false)
      requestAnimationFrame(() => {
        lockRef.current = false
      })
    },
    [editablePreviewActive, editorRef, enabled],
  )

  useEffect(() => {
    if (!enabled || editablePreviewActive) return

    const container = scrollContainerRef.current
    if (!container) return

    const onScroll = () => {
      if (lockRef.current) return

      const content = previewRef.current?.getContentRoot()
      const editor = editorRef.current
      if (!content || !editor) return

      const line = getPreviewTopSourceLine(container, content)
      if (!line) return

      lockRef.current = true
      editor.scrollToLine(line, false)
      requestAnimationFrame(() => {
        lockRef.current = false
      })
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [editablePreviewActive, enabled, editorRef, previewRef, scrollContainerRef])

  return { handleEditorLine, handlePreviewLine }
}
