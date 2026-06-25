import type { JobDescriptor } from './job'
import type { NoteId } from './note'
import type { VaultId } from './vault'

export type CanvasDocumentId = string
export type CanvasBlockId = string
export type CanvasLayerId = string

export type CanvasMode = 'document' | 'edgeless' | 'presentation'

export type CanvasBlockKind =
  | 'markdown'
  | 'sticky-note'
  | 'shape'
  | 'connector'
  | 'image'
  | 'embed'
  | 'table'
  | 'template'

export type CanvasShapeKind =
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'polygon'
  | 'freehand'

export interface CanvasPoint {
  x: number
  y: number
  pressure?: number
}

export interface CanvasRect extends CanvasPoint {
  width: number
  height: number
}

export interface CanvasStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  textStyle?: 'body' | 'heading' | 'caption' | 'code'
}

export interface CanvasBlock {
  id: CanvasBlockId
  kind: CanvasBlockKind
  layerId: CanvasLayerId
  bounds: CanvasRect
  zIndex: number
  sourceNoteId?: NoteId
  shapeKind?: CanvasShapeKind
  contentRef?: string
  style?: CanvasStyle
  locked?: boolean
  strokePoints?: CanvasPoint[]
}

export interface CanvasLayer {
  id: CanvasLayerId
  name: string
  visible: boolean
  locked: boolean
  order: number
}

export interface CanvasDocument {
  id: CanvasDocumentId
  vaultId: VaultId
  title: string
  mode: CanvasMode
  layers: CanvasLayer[]
  blocks: CanvasBlock[]
  updatedAt: string
}

export interface CanvasTemplate {
  id: string
  name: string
  category: 'planning' | 'research' | 'learning' | 'diagramming' | 'publishing'
  blocks: CanvasBlock[]
  defaultMode: CanvasMode
  description?: string
}

export interface CanvasSnapshotInput {
  vaultId: VaultId
  canvasId: CanvasDocumentId
  bounds?: CanvasRect
  format: 'png' | 'svg' | 'pdf'
}

export interface CanvasSnapshotOutput {
  job: JobDescriptor
  artifactPath: string
  format: CanvasSnapshotInput['format']
}

export interface CanvasQueryInput {
  vaultId: VaultId
  canvasId: CanvasDocumentId
  bounds?: CanvasRect
  kinds?: CanvasBlockKind[]
}

export interface CanvasQueryOutput {
  canvas: CanvasDocument
  visibleBlocks: CanvasBlock[]
}