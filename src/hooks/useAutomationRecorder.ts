/**
 * useAutomationRecorder
 * ----------------------
 * Feature 5.7 — Automation Recorder
 *
 * Records a sequence of named editor/command-palette actions and serialises
 * them to JSON for replay as a named macro. The recorder is purely frontend —
 * it captures action descriptors (not raw keystrokes) so macros are
 * deterministic and vault-portable.
 *
 * Usage:
 *  ```tsx
 *  const { state, startRecording, stopRecording, record, replay, clear,
 *          savedMacros, saveMacro, deleteMacro, loadMacro } =
 *    useAutomationRecorder()
 *
 *  // In command handler:
 *  record({ type: 'insertText', payload: '## Heading\n' })
 *  record({ type: 'runCommand', payload: 'format.bold' })
 *
 *  // On stop:
 *  stopRecording()
 *  saveMacro('My Macro')
 *
 *  // On replay:
 *  const actions = loadMacro('My Macro')
 *  replay(actions, executeAction)
 *  ```
 */

import { useState, useCallback, useRef } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecordedActionType =
  | 'insertText'
  | 'deleteSelection'
  | 'runCommand'
  | 'formatBold'
  | 'formatItalic'
  | 'formatHeading'
  | 'custom'

export interface RecordedAction {
  type: RecordedActionType
  /** String or structured payload depending on the action type. */
  payload?: string
  /** ISO timestamp when the action was recorded. */
  recordedAt: string
}

export interface SavedMacro {
  name: string
  actions: RecordedAction[]
  createdAt: string
}

export type RecorderState = 'idle' | 'recording' | 'replaying'

export interface AutomationRecorderResult {
  state: RecorderState
  /** Actions recorded in the current session (cleared on stopRecording). */
  currentActions: RecordedAction[]
  startRecording: () => void
  stopRecording: () => RecordedAction[]
  /** Push an action to the current recording session. */
  record: (action: Omit<RecordedAction, 'recordedAt'>) => void
  /** Replay a list of actions using the supplied executor. */
  replay: (
    actions: RecordedAction[],
    executor: (action: RecordedAction) => void | Promise<void>,
  ) => Promise<void>
  savedMacros: SavedMacro[]
  saveMacro: (name: string) => SavedMacro | null
  deleteMacro: (name: string) => void
  loadMacro: (name: string) => RecordedAction[]
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'scriptor:automation-macros'

function loadMacros(): SavedMacro[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedMacro[]) : []
  } catch {
    return []
  }
}

function persistMacros(macros: SavedMacro[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(macros))
  } catch {
    // Storage may be unavailable in some environments; non-fatal.
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAutomationRecorder(): AutomationRecorderResult {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [currentActions, setCurrentActions] = useState<RecordedAction[]>([])
  const [savedMacros, setSavedMacros] = useState<SavedMacro[]>(() => loadMacros())
  const actionsRef = useRef<RecordedAction[]>([])

  const startRecording = useCallback(() => {
    actionsRef.current = []
    setCurrentActions([])
    setRecorderState('recording')
  }, [])

  const stopRecording = useCallback((): RecordedAction[] => {
    setRecorderState('idle')
    return actionsRef.current.slice()
  }, [])

  const record = useCallback(
    (action: Omit<RecordedAction, 'recordedAt'>) => {
      if (recorderState !== 'recording') return
      const full: RecordedAction = { ...action, recordedAt: new Date().toISOString() }
      actionsRef.current.push(full)
      setCurrentActions((prev) => [...prev, full])
    },
    [recorderState],
  )

  const replay = useCallback(
    async (
      actions: RecordedAction[],
      executor: (action: RecordedAction) => void | Promise<void>,
    ) => {
      setRecorderState('replaying')
      try {
        for (const action of actions) {
          await executor(action)
        }
      } finally {
        setRecorderState('idle')
      }
    },
    [],
  )

  const saveMacro = useCallback(
    (name: string): SavedMacro | null => {
      const actions = actionsRef.current.slice()
      if (actions.length === 0) return null
      const macro: SavedMacro = { name, actions, createdAt: new Date().toISOString() }
      setSavedMacros((prev) => {
        const next = [...prev.filter((m) => m.name !== name), macro]
        persistMacros(next)
        return next
      })
      return macro
    },
    [],
  )

  const deleteMacro = useCallback((name: string) => {
    setSavedMacros((prev) => {
      const next = prev.filter((m) => m.name !== name)
      persistMacros(next)
      return next
    })
  }, [])

  const loadMacro = useCallback(
    (name: string): RecordedAction[] => {
      return savedMacros.find((m) => m.name === name)?.actions ?? []
    },
    [savedMacros],
  )

  return {
    state: recorderState,
    currentActions,
    startRecording,
    stopRecording,
    record,
    replay,
    savedMacros,
    saveMacro,
    deleteMacro,
    loadMacro,
  }
}
