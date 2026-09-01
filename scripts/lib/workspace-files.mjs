import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * List workspace files the way git sees them: tracked files plus
 * untracked-but-not-ignored files, with .gitignore already applied.
 *
 * Returns absolute paths (OS separators), or `null` when the listing cannot
 * be produced (git missing, or the checkout is a source drop without a
 * repository) so callers can fall back to their own filesystem walks.
 */
export function gitWorkspaceFiles(root) {
  let output
  try {
    output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
    })
  } catch {
    return null
  }
  const seen = new Set()
  const files = []
  for (const relative of output.split('\0')) {
    if (!relative || seen.has(relative)) continue
    seen.add(relative)
    const absolute = path.join(root, ...relative.split('/'))
    // `--cached` lists tracked paths even after their file is deleted from
    // the working tree; only files that actually exist can be used.
    if (fs.existsSync(absolute)) files.push(absolute)
  }
  return files
}

/** True when any path segment is a dot-directory (tool state, linked worktrees). */
export function hasDotSegment(absolute, root) {
  const relative = path.relative(root, absolute)
  return relative.split(path.sep).some((segment) => segment.startsWith('.'))
}
