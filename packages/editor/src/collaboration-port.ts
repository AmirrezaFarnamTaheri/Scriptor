/** Narrow, opt-in editor boundary. A controller is constructed only after
 * authenticated seed hydration and native local-journal restoration.
 * The normal autosave owner MUST be suspended while this port is active.
 */
export interface CollaborativeEditorEdit {
  from: number
  to: number
  insert: string
}
export interface CollaborativeEditorSurface {
  getValue(): string
  setReadOnly(readOnly: boolean): void
  /** Apply remote changes outside the local editor's undo history. */
  applyRemoteEdit(change: CollaborativeEditorEdit): void
}
export interface CollaborativeEditorConnection {
  localChange(): Promise<void>
  dispose(): void
}
export interface CollaborativeEditorBinding {
  connect(surface: CollaborativeEditorSurface): CollaborativeEditorConnection
  onError(error: unknown): void
}
