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
}: {
  sourcePath: string
  activePath: string | null
  isDirty: boolean
  saveActiveNote: () => Promise<boolean>
  runMutation: () => Promise<void>
}): Promise<boolean> {
  if (sourcePath === activePath && isDirty && !(await saveActiveNote())) {
    return false
  }

  await runMutation()
  return true
}
