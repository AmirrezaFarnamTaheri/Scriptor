/**
 * reader/index.ts — public barrel for the reader module (W3-8).
 *
 * Import from this file rather than from individual modules so that
 * internal restructuring doesn't break callers.
 */

export { ReaderPanel } from './ReaderPanel'
export type { ReaderPanelProps } from './ReaderPanel'
export { useReaderStore } from './useReaderStore'
export type {
  ReaderAnnotation,
  ReaderFileType,
  ReaderSelection,
  ReaderState,
  ReaderActions,
} from './useReaderStore'
export { useReaderFile } from './useReaderFile'
export type { ReaderFileState } from './useReaderFile'
export { AnnotationPopover } from './AnnotationPopover'
