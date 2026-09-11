import { withStableVaultSessionRead } from '../../lib/vaultSessionLock'
import {
  vaultLoadConfig as loadVaultConfigUncoordinated,
  vaultLoadSnippets as loadVaultSnippetsUncoordinated,
} from './vault'
import { indexerListNoteSummaries as listNoteSummariesUncoordinated } from './indexer'

export function vaultLoadConfig() {
  return withStableVaultSessionRead(loadVaultConfigUncoordinated)
}

export function vaultLoadSnippets() {
  return withStableVaultSessionRead(loadVaultSnippetsUncoordinated)
}

export function indexerListNoteSummaries() {
  return withStableVaultSessionRead(listNoteSummariesUncoordinated)
}
