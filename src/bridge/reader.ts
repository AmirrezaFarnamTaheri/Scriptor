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

/** Reads a supported document from the native active vault only. */
export async function readReaderDocument(relPath: string): Promise<Uint8Array> {
  return new Uint8Array(await invoke<number[]>('reader_read_document', { relPath }))
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
