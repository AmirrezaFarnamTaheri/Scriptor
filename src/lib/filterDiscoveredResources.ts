export interface DiscoverableResource {
  name: string
  logicalId: string
  targetId: string
  scope: string
  path: string
  issues: readonly string[]
}

export interface DiscoverableTarget {
  id: string
  label: string
}

/** Filter displayed inventory only; never change the selected source or sync draft. */
export function filterDiscoveredResources<T extends DiscoverableResource>(
  resources: readonly T[],
  targets: readonly DiscoverableTarget[],
  query: string,
): T[] {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return [...resources]
  const labels = new Map(targets.map(target => [target.id, target.label]))
  return resources.filter(resource => [
    resource.name,
    resource.logicalId,
    resource.targetId,
    labels.get(resource.targetId) ?? '',
    resource.scope,
    resource.path,
    ...resource.issues,
  ].join(' ').toLocaleLowerCase().includes(term))
}
