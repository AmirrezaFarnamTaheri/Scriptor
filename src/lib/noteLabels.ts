export interface NoteLabel {
  prefix: string
  identity: string
  folder: string
}

/** Group once so a large virtualized rail does not compare every pair of paths. */
export function buildNoteLabels(paths: readonly string[]): Map<string, NoteLabel> {
  const groups = new Map<string, string[]>()
  const basenames = new Map<string, number>()
  for (const path of paths) {
    const name = path.split('/').pop() ?? path
    basenames.set(name, (basenames.get(name) ?? 0) + 1)
    if (name.length > 40) {
      const groupKey = name.slice(0, 16)
      const group = groups.get(groupKey) ?? []
      group.push(name)
      groups.set(groupKey, group)
    }
  }
  const sharedLengths = new Map<string, number>()
  for (const [key, names] of groups) {
    const first = names[0]
    let length = first.length
    for (const name of names.slice(1)) {
      length = Math.min(length, name.length)
      let index = 0
      while (index < length && first[index] === name[index]) index++
      length = index
    }
    sharedLengths.set(key, length)
  }
  return new Map(paths.map(path => {
    const name = path.split('/').pop() ?? path
    const shared = sharedLengths.get(name.slice(0, 16)) ?? name.length
    const sharedIdentity = name.length > 40 && shared < name.length
    const prefix = name.length <= 40 ? name : sharedIdentity ? name.slice(0, shared) : name.slice(0, -18)
    const identity = name.length <= 40 ? '' : sharedIdentity ? name.slice(shared, shared + 16) : name.slice(-18)
    return [path, {
      prefix,
      identity,
      folder: (basenames.get(name) ?? 0) > 1 ? path.slice(0, Math.max(0, path.lastIndexOf('/'))) : '',
    }]
  }))
}
