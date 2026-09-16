export function getVaultLabel(vaultPath: string): string {
  const parts = vaultPath.split(/[/\\]/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : vaultPath
}

export function getDisambiguatedVaultLabels(vaultPaths: string[]): Map<string, string> {
  const labelMap = new Map<string, string>()
  const pathParts = vaultPaths.map((p) => ({
    path: p,
    parts: p.split(/[/\\]/).filter(Boolean),
  }))

  for (const { path, parts } of pathParts) {
    if (parts.length === 0) {
      labelMap.set(path, path)
      continue
    }
    const basename = parts[parts.length - 1]
    const hasCollision = pathParts.some(
      (other) => other.path !== path && other.parts.length > 0 && other.parts[other.parts.length - 1] === basename,
    )
    if (!hasCollision) {
      labelMap.set(path, basename)
      continue
    }

    let depth = 2
    let label = parts.slice(Math.max(0, parts.length - depth)).join('/')
    while (depth < parts.length) {
      const stillCollides = pathParts.some((other) => {
        if (other.path === path) return false
        const otherLabel = other.parts.slice(Math.max(0, other.parts.length - depth)).join('/')
        return otherLabel === label
      })
      if (!stillCollides) break
      depth++
      label = parts.slice(Math.max(0, parts.length - depth)).join('/')
    }
    labelMap.set(path, label)
  }

  return labelMap
}
