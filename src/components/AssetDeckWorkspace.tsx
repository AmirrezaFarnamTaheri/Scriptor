import { useEffect, useState } from 'react'
import { indexerAssetUsage } from '../bridge/commands/assets'
import { loadReaderAnnotations } from '../bridge/reader'
import { AssetDeckPanel, type ResearchAsset } from './AssetDeckPanel'
import type { ReaderAnnotation } from './reader/useReaderStore'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'

export interface AssetDeckWorkspaceProps { vaultId: string; onClose(): void; onOpenAsset(path: string): void; onOpenNote(path: string): void; onCreateNote(title: string, markdown: string): Promise<void> }
export function AssetDeckWorkspace(props: AssetDeckWorkspaceProps) {
  const [inventory, setInventory] = useState<{ assets: ResearchAsset[]; truncated: boolean } | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [selection, setSelection] = useState<{ path: string; annotations: ReaderAnnotation[] } | null>(null)
  useEffect(() => {
    let active = true
    void indexerAssetUsage(props.vaultId).then(report => {
      if (active) setInventory({ assets: report.assets.map(asset => ({ path: asset.path, bytes: asset.bytes, usedBy: asset.used_by })), truncated: report.truncated })
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : String(reason)) })
    return () => { active = false }
  }, [props.vaultId, refresh])
  if (!inventory || error) return <UnifiedPanelShell title="Asset deck" ariaLabel="Asset deck" helpTopic="reader" onClose={props.onClose}>
    {error ? <><p role="alert">{error}</p><button onClick={() => { setError(''); setRefresh(value => value + 1) }}>Retry</button></> : <p role="status">Loading indexed asset usage…</p>}
  </UnifiedPanelShell>
  return <AssetDeckPanel {...props} assets={inventory.assets} usageComplete={!inventory.truncated} activeAssetPath={selection?.path} annotations={selection?.annotations}
    onOpenAsset={path => {
      void loadReaderAnnotations(path).then(annotations => setSelection({ path, annotations })).catch(reason => setError(String(reason)))
      props.onOpenAsset(path)
    }} />
}
