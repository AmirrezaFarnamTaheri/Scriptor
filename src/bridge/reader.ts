import { invoke } from '@tauri-apps/api/core'

export type ReaderDocumentType = 'pdf' | 'epub'

export interface ReaderAnnotationRecord {
  id: string
  anchor: string
  quote: string
  body: string
  color: string
  createdAt: string
}

export interface ReaderViewerLocation {
  url: string
  origin: string
}

/** Reads a supported document from the native active vault only. */
export async function readReaderDocument(relPath: string): Promise<Uint8Array> {
  const response = await invoke<ArrayBuffer>('reader_read_document', { relPath })
  return new Uint8Array(response)
}

/** Returns the isolated custom-protocol location for the bundled Reader wrapper. */
export async function getReaderViewerLocation(
  documentType: ReaderDocumentType,
): Promise<ReaderViewerLocation> {
  return invoke<ReaderViewerLocation>('reader_viewer_location', { documentType })
}

/** Annotation records are stored at `.scriptor/reader/annotations.json` in the active vault. */
export async function loadReaderAnnotations(relPath: string): Promise<ReaderAnnotationRecord[]> {
  return invoke<ReaderAnnotationRecord[]>('reader_load_annotations', { relPath })
}

export async function saveReaderAnnotations(
  relPath: string,
  annotations: ReaderAnnotationRecord[],
): Promise<void> {
  await invoke('reader_save_annotations', { relPath, annotations })
}
