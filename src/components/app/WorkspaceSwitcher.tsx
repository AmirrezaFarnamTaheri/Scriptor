interface WorkspaceSwitcherProps {
  recentVaults: string[]
  activeVaultPath: string | null
  onOpenVault: (path: string) => void
  onChooseVault: () => void
}

export function WorkspaceSwitcher({
  recentVaults,
  activeVaultPath,
  onOpenVault,
  onChooseVault,
}: WorkspaceSwitcherProps) {
  if (recentVaults.length === 0) return null

  return (
    <div className="workspace-switcher" aria-label="Recent vaults">
      <span>Workspaces</span>
      <select
        aria-label="Recent vault"
        value={activeVaultPath ?? ''}
        onChange={(event) => {
          const value = event.target.value
          if (value === '__choose__') {
            onChooseVault()
            return
          }
          if (value) onOpenVault(value)
        }}
      >
        <option value="" disabled>
          Select vault
        </option>
        {recentVaults.map((path) => (
          <option key={path} value={path}>
            {path}
          </option>
        ))}
        <option value="__choose__">Open another vault…</option>
      </select>
    </div>
  )
}
