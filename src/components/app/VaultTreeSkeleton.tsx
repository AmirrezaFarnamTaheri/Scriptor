export function VaultTreeSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="vault-tree-skeleton" aria-hidden="true">
      <div className="folder-row panel-loading vault-skeleton-folder" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="note-row panel-loading vault-skeleton-row" />
      ))}
    </div>
  )
}
