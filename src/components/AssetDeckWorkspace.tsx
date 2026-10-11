import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { indexerAssetUsage } from '../bridge/commands/assets'
import { loadReaderAnnotations } from '../bridge/reader'
import { AssetDeckPanel, type ResearchAsset } from './AssetDeckPanel'
import type { ReaderAnnotation } from './reader/useReaderStore'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { mediaKind } from '../lib/assetMedia'
import { AssetMediaPreview } from './AssetMediaPreview'

const ReaderPanel = lazy(() => import('./reader/ReaderPanel').then(module => ({ default: module.ReaderPanel })))
export interface AssetDeckWorkspaceProps { vaultId: string; vaultRoot: string; onClose(): void; onOpenAsset(path: string): void; onOpenNote(path: string): void; onCreateNote(title: string, markdown: string): Promise<void> }
export function AssetDeckWorkspace(props: AssetDeckWorkspaceProps) {
  const [inventory, setInventory] = useState<{ assets: ResearchAsset[]; truncated: boolean } | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [selection, setSelection] = useState<{ path: string; annotations: ReaderAnnotation[] } | null>(null)
  const generation = useRef(0)
  const closeReader = useRef<(() => Promise<boolean>) | null>(null)
  const nextAction = useRef<{ path: string } | 'close' | null>(null)
  const registerCloseAction = useCallback((action: (() => Promise<boolean>) | null) => { closeReader.current = action }, [])
  useEffect(() => {
    let active = true
    const requestGeneration = generation
    void indexerAssetUsage(props.vaultId).then(report => {
      if (active) setInventory({ assets: report.assets.map(asset => ({ path: asset.path, bytes: asset.bytes, usedBy: asset.used_by })), truncated: report.truncated })
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : String(reason)) })
    return () => { active = false; requestGeneration.current++ }
  }, [props.vaultId, refresh])
  function select(path: string) {
    const current = ++generation.current
    setSelection({ path, annotations: [] })
    if (mediaKind(path) !== 'reader') return
    void loadReaderAnnotations(path, props.vaultId).then(annotations => {
      if (generation.current === current) setSelection({ path, annotations })
    }).catch(reason => { if (generation.current === current) setError(String(reason)) })
  }
  function readerClosed() {
    const action = nextAction.current
    nextAction.current = null
    generation.current++
    if (action === 'close') props.onClose()
    else if (action) select(action.path)
    else setSelection(null)
  }
  function requestClose() {
    if (nextAction.current) return
    if (selection && closeReader.current) {
      nextAction.current = 'close'
      void closeReader.current().then(closed => { if (!closed) nextAction.current = null }).catch(reason => { nextAction.current = null; setError(String(reason)) })
    }
    else props.onClose()
  }
  function openAsset(path: string) {
    if (nextAction.current) return
    if (selection?.path === path) return
    if (selection && closeReader.current) {
      nextAction.current = { path }
      void closeReader.current().then(closed => { if (!closed) nextAction.current = null }).catch(reason => { nextAction.current = null; setError(String(reason)) })
    }
    else select(path)
  }
  return <UnifiedPanelShell title="Asset deck" ariaLabel="Asset deck" helpTopic="reader" onClose={requestClose} wide className="asset-deck-workspace">
    {inventory && error && <p role="alert">{error}</p>}
    {!inventory ? <>
      {error ? <><p role="alert">{error}</p><button onClick={() => { setError(''); setRefresh(value => value + 1) }}>Retry</button></> : <p role="status">Loading indexed asset usage…</p>}
    </> : <div className={selection ? 'asset-deck-split has-reader' : 'asset-deck-split'}>
      <AssetDeckPanel {...props} onClose={requestClose} embedded assets={inventory.assets} usageComplete={!inventory.truncated} activeAssetPath={selection?.path} annotations={selection?.annotations} onOpenAsset={openAsset} />
      {selection && (mediaKind(selection.path) !== 'reader' ? <AssetMediaPreview key={`${props.vaultId}:${selection.path}`} path={selection.path} vaultId={props.vaultId} onClose={readerClosed} /> : <Suspense fallback={<p role="status">Loading source reader…</p>}>
        <ReaderPanel key={`${props.vaultId}:${selection.path}`} vaultId={props.vaultId} filePath={selection.path} vaultRoot={props.vaultRoot} embedded onClose={readerClosed} registerCloseAction={registerCloseAction}
          onAnnotationCreate={annotation => setSelection(current => current?.path === selection.path ? { ...current, annotations: [...current.annotations.filter(item => item.id !== annotation.id), annotation] } : current)} />
      </Suspense>)}
    </div>}
  </UnifiedPanelShell>
}
