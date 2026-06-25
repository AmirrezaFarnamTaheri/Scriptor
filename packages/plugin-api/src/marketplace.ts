import type { PluginManifest } from '@scriptor/core/contracts/plugin'

import catalog from '../catalog.json' with { type: 'json' }
import { validatePluginManifest } from './manifest.ts'

export interface MarketplaceListing {
  id: string
  name: string
  version: string
  description: string
  package: string
  homepage?: string
}

type CatalogEntry = MarketplaceListing

const MANIFEST_LOADERS: Record<string, () => Promise<PluginManifest>> = {
  'scriptor-vault-lint': async () => (await import('@scriptor/plugin-vault-lint')).vaultLintManifest,
  'scriptor-canvas-kit': async () => (await import('@scriptor/plugin-canvas-kit')).canvasKitManifest,
  'scriptor-publish-pack': async () => (await import('@scriptor/plugin-publish-pack')).publishPackManifest,
  'scriptor-pdf-translate': async () => (await import('@scriptor/plugin-pdf-translate')).pdfTranslateManifest,
}

export function listBundledMarketplaceCatalog(): MarketplaceListing[] {
  return (catalog as CatalogEntry[]).map((entry) => ({ ...entry }))
}

export async function fetchRemoteMarketplaceCatalog(url: string): Promise<MarketplaceListing[]> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`marketplace fetch failed: ${response.status}`)
  }
  const payload = (await response.json()) as MarketplaceListing[]
  if (!Array.isArray(payload)) {
    throw new Error('marketplace catalog must be a JSON array')
  }
  return payload
}

export async function resolveMarketplaceManifest(listing: MarketplaceListing): Promise<PluginManifest> {
  const loader = MANIFEST_LOADERS[listing.id]
  if (!loader) {
    throw new Error(`no bundled manifest loader for ${listing.id}`)
  }
  const manifest = await loader()
  const validation = validatePluginManifest(manifest)
  if (!validation.ok) {
    throw new Error(validation.errors.join('; '))
  }
  if (manifest.id !== listing.id) {
    throw new Error(`manifest id mismatch: expected ${listing.id}, got ${manifest.id}`)
  }
  return manifest
}

export async function loadAllBundledManifests(): Promise<PluginManifest[]> {
  const bundled = listBundledMarketplaceCatalog()
  const manifests: PluginManifest[] = []
  for (const listing of bundled) {
    manifests.push(await resolveMarketplaceManifest(listing))
  }
  return manifests
}

export async function loadMarketplaceCatalog(remoteUrl?: string | null): Promise<MarketplaceListing[]> {
  const bundled = listBundledMarketplaceCatalog()
  if (!remoteUrl?.trim()) {
    return bundled
  }
  const remote = await fetchRemoteMarketplaceCatalog(remoteUrl.trim())
  const merged = new Map<string, MarketplaceListing>()
  for (const entry of bundled) merged.set(entry.id, entry)
  for (const entry of remote) merged.set(entry.id, entry)
  return Array.from(merged.values())
}
