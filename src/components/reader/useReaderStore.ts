/**
 * useReaderStore — Zustand slice for the Reader panel (W3-8).
 *
 * Decoupled from the component tree so that annotation creation, page
 * navigation, and highlight selection can be driven from outside the
 * component (e.g. by the command palette or the annotation bridge).
 *
 * Design constraints (from plan W3-8 / D7):
 *  - No `pdfium` dependency; pdf.js runs inside the webview iframe.
 *  - epub.js runs in the webview as well; no native EPUB parser.
 *  - Annotation writes go through `packages/core/src/capture/` → I-1.
 *  - Highlighting a selection must create an annotation that reopens to
 *    the same place (two-stage anchor: byte-exact + fuzzy-quote fallback).
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReaderFileType = 'pdf' | 'epub' | 'unknown'

export interface ReaderSelection {
  /** Serializable anchor — for PDF this is `{page, rect}`, for epub `{cfi}`. */
  anchor: string
  /** The exact selected text (used for fuzzy fallback in annotations). */
  quote: string
}

export interface ReaderAnnotation {
  id: string
  anchor: string
  quote: string
  /** Optional comment body. Empty string for highlight-only annotations. */
  body: string
  color: string
  createdAt: string
}

export interface ReaderState {
  /** Vault-relative path to the open file, or null when no file is open. */
  filePath: string | null
  fileType: ReaderFileType
  /** Current page (PDF) or CFI spine position (epub). */
  position: string | null
  /** Pending selection from the webview. */
  selection: ReaderSelection | null
  annotations: ReaderAnnotation[]
  /** Whether the annotation creation popover is visible. */
  annotationPopoverOpen: boolean
  isLoading: boolean
  error: string | null
}

export interface ReaderActions {
  openFile: (vaultRelPath: string, fileType: ReaderFileType) => void
  closeFile: () => void
  setPosition: (position: string) => void
  setSelection: (selection: ReaderSelection | null) => void
  addAnnotation: (annotation: ReaderAnnotation) => void
  setAnnotations: (annotations: ReaderAnnotation[]) => void
  removeAnnotation: (id: string) => void
  openAnnotationPopover: () => void
  closeAnnotationPopover: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

const INITIAL_STATE: ReaderState = {
  filePath: null,
  fileType: 'unknown',
  position: null,
  selection: null,
  annotations: [],
  annotationPopoverOpen: false,
  isLoading: false,
  error: null,
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useReaderStore = create<ReaderState & ReaderActions>()(
  immer((set) => ({
    ...INITIAL_STATE,

    openFile: (vaultRelPath, fileType) =>
      set((state) => {
        state.filePath = vaultRelPath
        state.fileType = fileType
        state.position = null
        state.selection = null
        state.annotations = []
        state.error = null
        state.isLoading = true
      }),

    closeFile: () =>
      set((state) => {
        Object.assign(state, INITIAL_STATE)
      }),

    setPosition: (position) =>
      set((state) => {
        state.position = position
      }),

    setSelection: (selection) =>
      set((state) => {
        state.selection = selection
        if (!selection) state.annotationPopoverOpen = false
      }),

    addAnnotation: (annotation) =>
      set((state) => {
        state.annotations.push(annotation)
        state.selection = null
        state.annotationPopoverOpen = false
      }),

    setAnnotations: (annotations) =>
      set((state) => {
        state.annotations = annotations
      }),

    removeAnnotation: (id) =>
      set((state) => {
        state.annotations = state.annotations.filter((a) => a.id !== id)
      }),

    openAnnotationPopover: () =>
      set((state) => {
        state.annotationPopoverOpen = true
      }),

    closeAnnotationPopover: () =>
      set((state) => {
        state.annotationPopoverOpen = false
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading
      }),

    setError: (error) =>
      set((state) => {
        state.error = error
        state.isLoading = false
      }),

    reset: () => set(() => ({ ...INITIAL_STATE })),
  })),
)
