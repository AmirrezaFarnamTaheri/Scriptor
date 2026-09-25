type WorkspaceRuntimeBannersProps = {
  nativeReady: boolean
  error: string | null
  closeState?: 'idle' | 'saving' | 'delayed' | 'failed'
}

export function WorkspaceRuntimeBanners({
  nativeReady,
  error,
  closeState = 'idle',
}: WorkspaceRuntimeBannersProps) {
  return (
    <>
      {!nativeReady && (
        <div className="runtime-banner" role="status">
          Native vault commands require the desktop shell. Run <code>pnpm desktop:dev</code> to open real Markdown vaults.
        </div>
      )}

      {closeState === 'saving' && (
        <div className="runtime-banner" role="status" aria-live="polite">
          Saving pending changes before closing Scriptor…
        </div>
      )}

      {closeState === 'delayed' && (
        <div className="runtime-banner" role="status" aria-live="polite">
          Scriptor is still waiting for a pending save. The window will stay open so your draft is not lost.
        </div>
      )}

      {closeState === 'failed' && !error && (
        <div className="runtime-banner error" role="alert">
          Scriptor could not finish closing safely. Your draft is still open; try closing again.
        </div>
      )}

      {error && (
        <div className="runtime-banner error" role="alert">
          {error}
        </div>
      )}
    </>
  )
}
