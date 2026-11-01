/**
 * Serializes a file mutation with the active editor's unsaved draft for the
 * same source note. The native write is deliberately not started until the
 * draft has been persisted successfully.
 */
export async function coordinateNoteMutation({
  sourcePath,
  activePath,
  isDirty,
  saveActiveNote,
  runMutation,
  isStillCurrent,
}: {
  sourcePath: string
  activePath: string | null
  isDirty: boolean
  saveActiveNote: () => Promise<boolean>
  runMutation: () => Promise<void>
  /** Renderer ownership check, re-evaluated after any asynchronous draft save. */
  isStillCurrent?: () => boolean
}): Promise<boolean> {
  if (isStillCurrent && !isStillCurrent()) return false
  if (sourcePath === activePath && isDirty) {
    const saved = await saveActiveNote()
    if (!saved || (isStillCurrent && !isStillCurrent())) return false
  }
  if (isStillCurrent && !isStillCurrent()) return false

  await runMutation()
  return true
}
