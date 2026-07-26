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

/**
 * Normalize a vault-relative path, resolving `.`/`..` segments.
 * Returns null for paths that are absolute, carry a scheme/drive letter,
 * or escape the vault root via `..`.
 */
function vaultNormalize(path: string): string | null {
  const normalized = path.replace(/\\/g, '/')
  if (normalized.startsWith('/') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized)) {
    return null
  }
  const segments: string[] = []
  for (const segment of normalized.split('/')) {
    if (segment.length === 0 || segment === '.') continue
    if (segment === '..') {
      if (segments.length === 0) return null
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments.join('/')
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

  function resolveImportPath(importPath: string): string | null {
    const trimmed = importPath.trim()
    if (basePath.length === 0) return vaultNormalize(trimmed)
    return vaultNormalize(vaultJoin(vaultDirname(basePath), trimmed))
  }

  function inline(current: string, depth: number, chain: string[]): string {
    if (depth > maxDepth) {
      return current.replace(IMPORT_LINE, () => `\n> Import depth limit (${maxDepth}) reached\n`)
    }

    return current.replace(IMPORT_LINE, (_match, importPath: string) => {
      const resolved = resolveImportPath(importPath)
      if (resolved == null) {
        return `\n> Import path not allowed: ${importPath}\n`
      }
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

  const normalizedBase = basePath ? vaultNormalize(basePath) : null
  return inline(markdown.replace(/\r\n/g, '\n'), 1, normalizedBase ? [normalizedBase] : [])
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

  function resolveImportPath(importPath: string, currentBase: string): string | null {
    const trimmed = importPath.trim()
    if (currentBase.length === 0) return vaultNormalize(trimmed)
    return vaultNormalize(vaultJoin(vaultDirname(currentBase), trimmed))
  }

  async function inline(current: string, depth: number, chain: string[]): Promise<string> {
    if (depth > maxDepth) {
      return current.replace(IMPORT_LINE, () => `\n> Import depth limit (${maxDepth}) reached\n`)
    }

    const matches = [...current.matchAll(IMPORT_LINE)]
    if (matches.length === 0) return current

    // Rebuild the output by slicing around each match so replacement text is
    // inserted literally ($&/$1/$$ in imported notes must never be interpreted)
    // and later occurrences of identical text are never hijacked.
    let output = ''
    let cursor = 0
    for (const match of matches) {
      const index = match.index ?? 0
      output += current.slice(cursor, index)
      cursor = index + match[0].length

      const importPath = match[1]?.trim() ?? ''
      const currentBase = chain[chain.length - 1] ?? basePath
      const resolved = resolveImportPath(importPath, currentBase)
      if (resolved == null) {
        output += `\n> Import path not allowed: ${importPath}\n`
        continue
      }
      if (chain.includes(resolved) || seen.has(resolved)) {
        output += `\n> Circular import detected: ${importPath}\n`
        continue
      }

      const imported = await options.fetchNote(resolved)
      if (imported == null) {
        output += `\n> Import not found: ${importPath}\n`
        continue
      }

      seen.add(resolved)
      const nextChain = [...chain, resolved]
      const inlined = await inline(imported.replace(/\r\n/g, '\n'), depth + 1, nextChain)
      seen.delete(resolved)
      output += `\n${inlined}\n`
    }
    output += current.slice(cursor)

    return output
  }

  const normalizedBase = basePath ? vaultNormalize(basePath) : null
  return inline(markdown.replace(/\r\n/g, '\n'), 1, normalizedBase ? [normalizedBase] : [])
}

/** Remark plugin hook point — imports are expanded in {@link preprocessImports}. */
export function remarkImport() {
  return () => {}
}
