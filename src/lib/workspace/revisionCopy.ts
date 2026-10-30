/**
 * A reviewed historical revision may be copied only through the vault's
 * existing create-only writer. This helper does not confer native authority:
 * vault identity, destination path and the absence precondition are enforced
 * again by the native vault-save command.
 */
export interface ReviewedRevisionCopy {
  vaultId: string | null
  sourcePath: string
  revisionId: string
  targetPath: string
  reviewedMarkdown: string
}

export interface RevisionCopyDependencies {
  readRevision: (sourcePath: string, revisionId: string, expectedVaultId: string) => Promise<string>
  createNote: (targetPath: string, markdown: string, expectedHash: string, expectedVaultId: string) => Promise<unknown>
  isCurrent: () => boolean
}

const EXPECTED_MISSING_CONTENT_HASH = '<missing>'

function destinationIsUnsafe(path: string): boolean {
  if (!path || !/\.md$/i.test(path) || path.startsWith('/') || path.includes('\\')) return true
  if (/^[a-zA-Z]:/.test(path) || /[\u0000-\u001f\u007f]/.test(path)) return true
  const components = path.split('/')
  return components.some((part) => !part || part === '.' || part === '..' || part.toLowerCase() === '.scriptor')
}

export async function copyReviewedRevisionAsNewNote(
  request: ReviewedRevisionCopy,
  { readRevision, createNote, isCurrent }: RevisionCopyDependencies,
): Promise<string> {
  const vaultId = request.vaultId?.trim()
  const sourcePath = request.sourcePath.trim()
  const revisionId = request.revisionId.trim()
  const targetPath = request.targetPath.trim()
  if (!vaultId || !sourcePath || !revisionId || !targetPath) {
    throw new Error('Open the original vault and choose a revision and destination before creating a recovered copy.')
  }
  if (destinationIsUnsafe(targetPath)) {
    throw new Error('Choose a relative Markdown path outside the internal .scriptor folder.')
  }
  if (targetPath === sourcePath) {
    throw new Error('Choose a different destination: the original note must remain unchanged.')
  }
  if (!isCurrent()) {
    throw new Error('The originating vault or revision changed. Review the revision again before creating a copy.')
  }

  // Re-read rather than trusting stale renderer preview bytes as authority.
  const markdown = await readRevision(sourcePath, revisionId, vaultId)
  if (!isCurrent()) {
    throw new Error('The originating vault or revision changed. Review the revision again before creating a copy.')
  }
  if (markdown !== request.reviewedMarkdown) {
    throw new Error('The selected revision changed since preview. Review again before creating a copy.')
  }

  // Never list-and-overwrite: the native atomic writer rejects existing paths.
  // The originating vault ID is revalidated at the native mutation boundary.
  await createNote(targetPath, markdown, EXPECTED_MISSING_CONTENT_HASH, vaultId)
  return targetPath
}
