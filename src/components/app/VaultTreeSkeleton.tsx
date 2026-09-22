export function VaultTreeSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="vault-tree-skeleton" aria-hidden="true">
      <div className="folder-row vault-skeleton-folder" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="note-row vault-skeleton-row" />
      ))}
    </div>
  )
}
