export type VaultId = string
export type VaultRelativePath = string

export interface VaultDescriptor {
  id: VaultId
  name: string
  rootPath: string
  openedAt: string
  status: 'ready' | 'scanning' | 'degraded'
}

export interface OpenVaultInput {
  rootPath: string
  rebuildCache?: boolean
}

export interface OpenVaultOutput {
  vault: VaultDescriptor
  scanJobId: string
}

export interface VaultHealthReport {
  vaultId: VaultId
  brokenLinks: number
  orphanAssets: number
  duplicateTitles: number
  invalidFrontmatter: number
  cacheStatus: 'fresh' | 'stale' | 'rebuilding'
}

