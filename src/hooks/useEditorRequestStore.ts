/**
 * useEditorRequestStore
 *
 * Manages the "impulse request" objects that the workspace uses to send
 * one-shot commands into the CodeMirror / Monaco editor instance without
 * needing a direct ref to the editor API. Previously these lived as three
 * separate useState calls inside `useWorkspaceEditor`.
 *
 * Pattern: each request carries a monotone `seq` field. The editor watches
 * for a change in `seq` and fires the action exactly once, ignoring stale
 * requests. The store never stores large payloads — just command descriptors.
 *
 * Decoupled so that:
 * - Keyboard shortcut hooks can dispatch requests without depending on the
 *   full workspace editor state.
 * - The editor component only subscribes to this narrow slice, not the
 *   entire workspace editor bundle.
 */
import { useCallback, useState } from 'react'

import type { EditorTransformAction, TypographyAction } from '@scriptor/editor'

export interface InsertRequest {
  seq: number
  text: string
}

export interface TransformRequest {
  seq: number
  action: EditorTransformAction
}

export interface TypographyRequest {
  seq: number
  action: TypographyAction
}

interface EditorRequestState {
  insertRequest: InsertRequest | null
  transformRequest: TransformRequest | null
  typographyRequest: TypographyRequest | null
}

export function useEditorRequestStore() {
  const [state, setState] = useState<EditorRequestState>({
    insertRequest: null,
    transformRequest: null,
    typographyRequest: null,
  })

  /**
   * Dispatch a snippet-insert request. The editor will insert `text` at the
   * current cursor position when it processes the updated seq.
   */
  const dispatchInsert = useCallback((text: string) => {
    setState((prev) => ({
      ...prev,
      insertRequest: { seq: Date.now(), text },
    }))
  }, [])

  /**
   * Dispatch a structural transform (bold, italic, heading, list, etc.).
   */
  const dispatchTransform = useCallback((action: EditorTransformAction) => {
    setState((prev) => ({
      ...prev,
      transformRequest: { seq: Date.now(), action },
    }))
  }, [])

  /**
   * Dispatch a typography action (smart quotes, em dash, etc.).
   */
  const dispatchTypography = useCallback((action: TypographyAction) => {
    setState((prev) => ({
      ...prev,
      typographyRequest: { seq: Date.now(), action },
    }))
  }, [])

  return {
    insertRequest: state.insertRequest,
    transformRequest: state.transformRequest,
    typographyRequest: state.typographyRequest,
    dispatchInsert,
    dispatchTransform,
    dispatchTypography,
  }
}
