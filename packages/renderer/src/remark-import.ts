function vaultDirname(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index >= 0 ? normalized.slice(0, index) : ''
}

function vaultJoin(base: string, relative: string): string {
  const rel = relative.replace(/\\/g, '/').replace(/^\.\//, '')
  if (base.length === 0) return rel
  return `${base.replace(/\\/g, '/').replace(/\/$/, '')}/${rel}`
}

function vaultNormalize(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '')
}

export interface ImportResolverOptions {
  /** Resolve relative import paths to markdown source. Return null when missing. */
  fetchNote: (path: string) => string | null
  /** Path of the note being rendered, used to resolve relative imports. */
  basePath?: string
  maxDepth?: number
}

const IMPORT_LINE =
  /^\s*@import\s+"([^"]+)"(?:\s*\{[^}]*\})?\s*(?:<!--.*?-->)?\s*$/gm

const MAX_IMPORT_DEPTH = 3

/** MPE-style `@import "relative/path.md"` inlining with depth and cycle guards. */
export function preprocessImports(markdown: string, options: ImportResolverOptions): string {
  const maxDepth = options.maxDepth ?? MAX_IMPORT_DEPTH
  const basePath = options.basePath ?? ''
  const seen = new Set<string>()

  function resolveImportPath(importPath: string): string {
    const trimmed = importPath.trim()
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    if (basePath.length === 0) return vaultNormalize(trimmed)
    return vaultNormalize(vaultJoin(vaultDirname(basePath), trimmed))
  }

  function inline(current: string, depth: number, chain: string[]): string {
    if (depth > maxDepth) {
      return current.replace(IMPORT_LINE, () => `\n> Import depth limit (${maxDepth}) reached\n`)
    }

    return current.replace(IMPORT_LINE, (_match, importPath: string) => {
      const resolved = resolveImportPath(importPath)
      if (chain.includes(resolved) || seen.has(resolved)) {
        return `\n> Circular import detected: ${importPath}\n`
      }

      const imported = options.fetchNote(resolved)
      if (imported == null) {
        return `\n> Import not found: ${importPath}\n`
      }

      seen.add(resolved)
      const nextChain = [...chain, resolved]
      const inlined = inline(imported.replace(/\r\n/g, '\n'), depth + 1, nextChain)
      seen.delete(resolved)
      return `\n${inlined}\n`
    })
  }

  return inline(markdown.replace(/\r\n/g, '\n'), 1, basePath ? [vaultNormalize(basePath)] : [])
}

/** Async variant for vault hosts that resolve imports over IPC. */
export async function preprocessImportsAsync(
  markdown: string,
  options: {
    fetchNote: (path: string) => Promise<string | null>
    basePath?: string
    maxDepth?: number
  },
): Promise<string> {
  const maxDepth = options.maxDepth ?? MAX_IMPORT_DEPTH
  const basePath = options.basePath ?? ''
  const seen = new Set<string>()

  function resolveImportPath(importPath: string, currentBase: string): string {
    const trimmed = importPath.trim()
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    if (currentBase.length === 0) return vaultNormalize(trimmed)
    return vaultNormalize(vaultJoin(vaultDirname(currentBase), trimmed))
  }

  async function inline(current: string, depth: number, chain: string[]): Promise<string> {
    if (depth > maxDepth) {
      return current.replace(IMPORT_LINE, () => `\n> Import depth limit (${maxDepth}) reached\n`)
    }

    const matches = [...current.matchAll(IMPORT_LINE)]
    if (matches.length === 0) return current

    let output = current
    for (const match of matches) {
      const importPath = match[1]?.trim() ?? ''
      const currentBase = chain[chain.length - 1] ?? basePath
      const resolved = resolveImportPath(importPath, currentBase)
      if (chain.includes(resolved) || seen.has(resolved)) {
        output = output.replace(match[0], `\n> Circular import detected: ${importPath}\n`)
        continue
      }

      const imported = await options.fetchNote(resolved)
      if (imported == null) {
        output = output.replace(match[0], `\n> Import not found: ${importPath}\n`)
        continue
      }

      seen.add(resolved)
      const nextChain = [...chain, resolved]
      const inlined = await inline(imported.replace(/\r\n/g, '\n'), depth + 1, nextChain)
      seen.delete(resolved)
      output = output.replace(match[0], `\n${inlined}\n`)
    }

    return output
  }

  return inline(markdown.replace(/\r\n/g, '\n'), 1, basePath ? [vaultNormalize(basePath)] : [])
}

/** Remark plugin hook point — imports are expanded in {@link preprocessImports}. */
export function remarkImport() {
  return () => {}
}
