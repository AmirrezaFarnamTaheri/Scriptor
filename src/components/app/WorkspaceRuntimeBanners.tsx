type WorkspaceRuntimeBannersProps = {
  nativeReady: boolean
  error: string | null
}

export function WorkspaceRuntimeBanners({ nativeReady, error }: WorkspaceRuntimeBannersProps) {
  return (
    <>
      {!nativeReady && (
        <div className="runtime-banner" role="status">
          Native vault commands require the desktop shell. Run <code>pnpm desktop:dev</code> to open real Markdown vaults.
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
