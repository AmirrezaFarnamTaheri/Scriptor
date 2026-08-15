/**
 * useReaderFile — hook that resolves a vault-relative path to a data URL
 * or blob URL the webview can load.
 *
 * Separation of concerns: this hook owns I/O; `ReaderPanel.tsx` owns presentation.
 * Reads the file via the Tauri `readBinaryFile` bridge and produces a blob URL
 * that the webview can consume without CORS issues.
 *
 * Strategy: pdf.js and epub.js each accept a `Uint8Array` / `ArrayBuffer`
 * directly through their postMessage API (see `useReaderWebview`), so the
 * blob URL is only used as a fallback URL for simple `<iframe src>` embedding.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { readReaderDocument } from '../../bridge/reader'

export type ReaderFileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; blobUrl: string; bytes: Uint8Array }
  | { status: 'error'; message: string }

type ReaderFileAction =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'ready'; blobUrl: string; bytes: Uint8Array }
  | { type: 'error'; message: string }

function readerFileReducer(_state: ReaderFileState, action: ReaderFileAction): ReaderFileState {
  switch (action.type) {
    case 'idle':
      return { status: 'idle' }
    case 'loading':
      return { status: 'loading' }
    case 'ready':
      return { status: 'ready', blobUrl: action.blobUrl, bytes: action.bytes }
    case 'error':
      return { status: 'error', message: action.message }
  }
}

/**
 * Load a vault-relative path as binary and return a blob URL + raw bytes.
 * The blob URL is revoked automatically on unmount or when `vaultRelPath` changes.
 */
export function useReaderFile(
  vaultRelPath: string | null,
  vaultRoot: string | null,
): ReaderFileState {
  const [state, dispatch] = useReducer(readerFileReducer, { status: 'idle' } as ReaderFileState)
  const prevBlobUrl = useRef<string | null>(null)

  const revokePrev = useCallback(() => {
    if (prevBlobUrl.current) {
      URL.revokeObjectURL(prevBlobUrl.current)
      prevBlobUrl.current = null
    }
  }, [])

  useEffect(() => {
    if (!vaultRelPath || !vaultRoot) {
      revokePrev()
      dispatch({ type: 'idle' })
      return
    }

    dispatch({ type: 'loading' })
    let cancelled = false

    const load = async () => {
      try {
        // The native command uses the active session; `vaultRoot` only signals
        // that the reader is not usable until a vault has been opened.
        const bytes = await readReaderDocument(vaultRelPath)
        if (cancelled) return

        const mimeType = guessMime(vaultRelPath)
        const blob = new Blob([bytes.slice().buffer], { type: mimeType })
        revokePrev()
        const blobUrl = URL.createObjectURL(blob)
        prevBlobUrl.current = blobUrl
        dispatch({ type: 'ready', blobUrl, bytes })
      } catch (err) {
        if (cancelled) return
        dispatch({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultRelPath, vaultRoot])

  useEffect(() => revokePrev, [revokePrev])

  return state
}

function guessMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'epub') return 'application/epub+zip'
  return 'application/octet-stream'
}
