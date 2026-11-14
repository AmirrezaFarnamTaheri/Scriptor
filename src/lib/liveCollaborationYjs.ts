import type { LiveCollaborationScope } from './liveCollaborationProtocol.ts'

/** Initial TDD seam; behavior is implemented only after failing tests are observed. */
export class CollaborativeMarkdown {
  constructor(_scope: LiveCollaborationScope) {}
  get ready(): boolean { return false }
  get value(): string { throw new Error('CRDT implementation pending') }
  initializeOwner(_markdown: string): Uint8Array[] { throw new Error('CRDT implementation pending') }
  hydrate(_updates: Uint8Array[]): void { throw new Error('CRDT implementation pending') }
  change(_from: number, _to: number, _insert: string): Uint8Array { throw new Error('CRDT implementation pending') }
  applyRemote(_update: Uint8Array, _sender: {roomId:string; documentId:string; epoch:number; peerId:string}): void { throw new Error('CRDT implementation pending') }
  stateVector(): Uint8Array { throw new Error('CRDT implementation pending') }
  diff(_vector: Uint8Array): Uint8Array { throw new Error('CRDT implementation pending') }
  undo(): Uint8Array | null { throw new Error('CRDT implementation pending') }
  redo(): Uint8Array | null { throw new Error('CRDT implementation pending') }
  close(): void {}
}
