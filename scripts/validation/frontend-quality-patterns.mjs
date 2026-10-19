const tauriCoreImportPattern = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]@tauri-apps\/api\/core['"]/

export function importsTauriCore(source) {
  return tauriCoreImportPattern.test(source)
}

import ts from 'typescript'

/** Reject real TypeScript any types without treating comments and strings as code. */
export function hasExplicitAnyType(source, fileName = 'source.ts') {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind)
  let found = false

  function visit(node) {
    if (found) return
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return found
}
