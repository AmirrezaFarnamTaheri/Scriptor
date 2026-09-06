/**
 * useReaderFile — reads a Reader document through the native vault boundary.
 *
 * The Reader wrappers consume the returned bytes directly over postMessage.
 * No blob URL is created: the iframe itself is served from the isolated
 * `reader` custom protocol and document bytes never become an app-origin URL.
 */

import { useEffect, useReducer } from 'react'
import { readReaderDocument } from '../../bridge/reader'

export type ReaderFileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; bytes: Uint8Array }
  | { status: 'error'; message: string }

type ReaderFileAction =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'ready'; bytes: Uint8Array }
  | { type: 'error'; message: string }

function readerFileReducer(_state: ReaderFileState, action: ReaderFileAction): ReaderFileState {
  switch (action.type) {
    case 'idle':
      return { status: 'idle' }
    case 'loading':
      return { status: 'loading' }
    case 'ready':
      return { status: 'ready', bytes: action.bytes }
    case 'error':
      return { status: 'error', message: action.message }
  }
}

export function useReaderFile(
  vaultRelPath: string | null,
  vaultRoot: string | null,
  reloadGeneration = 0,
): ReaderFileState {
  const [state, dispatch] = useReducer(readerFileReducer, { status: 'idle' } as ReaderFileState)

  useEffect(() => {
    if (!vaultRelPath || !vaultRoot) {
      dispatch({ type: 'idle' })
      return
    }

    dispatch({ type: 'loading' })
    let cancelled = false

    void readReaderDocument(vaultRelPath)
      .then((bytes) => {
        if (!cancelled) dispatch({ type: 'ready', bytes })
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          dispatch({
            type: 'error',
            message: cause instanceof Error ? cause.message : String(cause),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [vaultRelPath, vaultRoot, reloadGeneration])

  return state
}
