import { useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import { getVaultLabel, getDisambiguatedVaultLabels } from '../../lib/workspaceSwitcher'

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
  const vaultLabels = useMemo(() => getDisambiguatedVaultLabels(recentVaults), [recentVaults])
  const { t } = useI18n()

  if (recentVaults.length === 0) return null

  return (
    <div className="workspace-switcher" aria-label={t('topBar.recentVaults')}>
      <select
        aria-label={t('topBar.switchVault')}
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
          {t('topBar.chooseVault')}
        </option>
        {recentVaults.map((path) => (
          <option key={path} value={path} title={path}>
            {vaultLabels.get(path) ?? getVaultLabel(path)}
          </option>
        ))}
        <option value="__choose__">{t('topBar.openAnotherVault')}</option>
      </select>
    </div>
  )
}
