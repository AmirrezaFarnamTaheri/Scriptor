export interface WorkspaceOperation {
  readonly owner: string
  readonly generation: number
}

/** One pending operation, with display results bound to the originating workspace.
 * Changing owners invalidates the display lease without pretending submitted
 * native work has stopped or permitting another operation to overlap it. */
export class WorkspaceOperationGate {
  private owner: string | null
  private generation = 0
  private pending: WorkspaceOperation | null = null

  constructor(owner: string | null) { this.owner = owner }

  setOwner(owner: string | null): void {
    if (owner !== this.owner) {
      this.owner = owner
      this.generation++
    }
  }

  invalidate(): void {
    this.owner = null
    this.generation++
  }

  hasOwner(owner: string | null): boolean { return this.owner === owner }

  begin(expectedOwner?: string): WorkspaceOperation | null {
    if (!this.owner || this.pending || (expectedOwner !== undefined && expectedOwner !== this.owner)) return null
    const operation = { owner: this.owner, generation: this.generation }
    this.pending = operation
    return operation
  }

  isCurrent(operation: WorkspaceOperation): boolean {
    return this.pending === operation && this.owner === operation.owner && this.generation === operation.generation
  }

  isPending(): boolean { return this.pending !== null }

  finish(operation: WorkspaceOperation): void {
    if (this.pending === operation) this.pending = null
  }
}
