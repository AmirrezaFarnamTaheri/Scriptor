import { nativeInvoke } from './native.ts'

export interface CanvasHitTestResult {
  blockId: string
  layerId: string
  kind: string
}

export interface CanvasTemplateApplyPreview {
  templateId: string
  blocksAdded: Array<{
    id: string
    kind: string
    layerId: string
    bounds: { x: number; y: number; width: number; height: number }
    zIndex: number
    contentRef?: string
  }>
  patchLog: string[]
}

export interface CanvasSnapshotOutput {
  format: 'png' | 'svg' | 'pdf'
  artifactPath: string
  width: number
  height: number
  dryRun: boolean
}

export interface CanvasTemplateApplyOutput {
  document: unknown
  templateId: string
  patchId: string
  checkpointPath: string
  blocksAdded: number
}

export async function canvasHitTest(
  sceneJson: string,
  x: number,
  y: number,
): Promise<CanvasHitTestResult | null> {
  return nativeInvoke<CanvasHitTestResult | null>('canvas_hit_test', { sceneJson, x, y })
}

export async function canvasRenderSvg(sceneJson: string): Promise<string> {
  return nativeInvoke<string>('canvas_render_svg', { sceneJson })
}

export async function canvasTemplateDryRun(
  sceneJson: string,
  templateId: string,
): Promise<CanvasTemplateApplyPreview> {
  return nativeInvoke<CanvasTemplateApplyPreview>('canvas_template_dry_run', { sceneJson, templateId })
}

export async function canvasApplyTemplate(
  sceneJson: string,
  templateId: string,
): Promise<CanvasTemplateApplyOutput> {
  return nativeInvoke<CanvasTemplateApplyOutput>('canvas_apply_template', { sceneJson, templateId })
}

export async function canvasRestoreTemplate(patchId: string): Promise<string> {
  return nativeInvoke<string>('canvas_restore_template', { patchId })
}

export async function canvasQueryBlocks(
  sceneJson: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<string[]> {
  return nativeInvoke<string[]>('canvas_query_blocks', { sceneJson, x, y, width, height })
}

export async function canvasSnapshot(
  sceneJson: string,
  format: 'png' | 'svg' | 'pdf',
  outputPath: string,
  dryRun = false,
): Promise<CanvasSnapshotOutput> {
  return nativeInvoke<CanvasSnapshotOutput>('canvas_snapshot', {
    sceneJson,
    format,
    outputPath,
    dryRun,
  })
}

export async function canvasListDocuments(): Promise<
  Array<{
    id: string
    title: string
    updatedAt: string
    blockCount: number
    path: string
  }>
> {
  return nativeInvoke('canvas_list_documents')
}

export async function canvasLoadDocument(canvasId: string): Promise<string> {
  return nativeInvoke<string>('canvas_load_document', { canvasId })
}

export async function canvasSaveDocument(sceneJson: string): Promise<string> {
  return nativeInvoke<string>('canvas_save_document', { sceneJson })
}
