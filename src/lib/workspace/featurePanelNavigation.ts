/**
 * Feature panels must remain available until the existing workspace-leaf
 * owner approves and commits note navigation. This owns no editor, pane,
 * workspace state, or native permission boundary.
 */
export async function openNoteBeforeDismissingPanel(
  path: string,
  openNote: (path: string) => Promise<boolean>,
  dismissPanel: () => void,
): Promise<boolean> {
  if (!path.trim()) return false
  const opened = await openNote(path)
  if (opened !== true) return false
  dismissPanel()
  return true
}
