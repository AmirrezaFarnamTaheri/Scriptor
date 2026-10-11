import { useEffect, useReducer, useState } from 'react'
import { readReaderDocument } from '../bridge/reader'
import { mediaKind, validatedMediaType } from '../lib/assetMedia'
import { EmbeddedPanelShell } from './chrome/EmbeddedPanelShell'

type PreviewState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; url: string }
export function AssetMediaPreview({ path, vaultId, onClose }: { path: string; vaultId: string; onClose(): void }) {
  const [state, dispatch] = useReducer((_state: PreviewState, next: PreviewState) => next, { status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    dispatch({ status: 'loading' })
    void readReaderDocument(path, vaultId).then(bytes => {
      if (!active) return
      const type = validatedMediaType(path, bytes)
      objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }))
      dispatch({ status: 'ready', url: objectUrl })
    }).catch((error: unknown) => {
      if (active) dispatch({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [path, vaultId, attempt])
  const kind = mediaKind(path)
  return <EmbeddedPanelShell title="Source preview" ariaLabel="Source preview" helpTopic="reader" onClose={onClose}>
    <p className="asset-media-path">{path}</p>
    {state.status === 'loading' && <p role="status">Loading vault media…</p>}
    {state.status === 'error' && <><p role="alert">{state.message}</p><button type="button" className="toolbar-button" onClick={() => setAttempt(value => value + 1)}>Retry preview</button></>}
    {state.status === 'ready' && <>
      {kind === 'image' ? <img className="asset-media-image" src={state.url} alt={`Vault source: ${path}`} onError={() => dispatch({ status: 'error', message: 'This image could not be decoded.' })} />
        : <audio className="asset-media-audio" controls preload="metadata" src={state.url} aria-label={`Vault audio: ${path}`} onError={() => dispatch({ status: 'error', message: 'This audio could not be decoded by the current browser.' })} />}
      <p>Preview loaded from the active vault. Image and audio previews are limited to 32 MiB.</p>
    </>}
  </EmbeddedPanelShell>
}
