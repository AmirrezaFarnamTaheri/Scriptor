/**
 * CaptureChoice — the choice model that determines where captured content lands.
 *
 * Serves QuickAdd-style capture (tasks P1-2), web clip (sync WS-G), and
 * template capture (writing P1-15) through a single choice surface (D2).
 *
 * Three modes:
 * - `silent`  — no UI prompt; target is pre-configured.
 * - `prompt`  — show a list of `CaptureChoiceOption`s in the command palette.
 * - `dynamic` — call `resolve()` at runtime (for context-sensitive targets).
 *
 * The palette integration (F-3) is done via `registerCaptureCommands` in
 * `commands.ts`. The actual UI rendering is handled by the command palette
 * component, which is already palette-aware.
 */

import type { CaptureTarget } from './target'

export interface CaptureChoiceOption {
  id: string
  label: string
  description?: string
  target: CaptureTarget
}

export type CaptureChoiceMode = 'silent' | 'prompt' | 'dynamic'

export interface CaptureChoice {
  mode: CaptureChoiceMode
  /** Pre-selected target for `silent` mode. */
  defaultTarget?: CaptureTarget
  /** Options presented to the user in `prompt` mode. */
  options?: CaptureChoiceOption[]
  /** Called at runtime in `dynamic` mode; must return a target. */
  resolve?: (context: CaptureChoiceContext) => Promise<CaptureTarget>
}

export interface CaptureChoiceContext {
  /** URL being clipped, if this is a web-clip capture. */
  url?: string
  /** Currently active note path, if any. */
  activeNotePath?: string
  /** Captured page title, if available before resolution. */
  title?: string
}

// ── Presenter ────────────────────────────────────────────────────────────────

/**
 * Present a capture choice to the user and return the resolved target.
 *
 * - `silent`: returns `defaultTarget` immediately (or the inbox fallback).
 * - `prompt`: delegates to `showCaptureChoicePicker` (supplied by the UI layer).
 * - `dynamic`: calls `choice.resolve(context)`.
 *
 * The `showPicker` callback is dependency-injected so this module has no
 * direct dependency on React or the Tauri window.
 */
export async function presentCaptureChoice(
  choice: CaptureChoice,
  context: CaptureChoiceContext,
  showPicker: (options: CaptureChoiceOption[]) => Promise<CaptureChoiceOption | null>,
): Promise<CaptureTarget | null> {
  switch (choice.mode) {
    case 'silent': {
      return (
        choice.defaultTarget ?? {
          kind: 'folder',
          folderPath: '00-inbox',
          filenameTemplate: '{{date}}-{{title}}.md',
        }
      )
    }

    case 'prompt': {
      const options = choice.options ?? []
      if (options.length === 0) {
        // Nothing configured — fall through to inbox.
        return { kind: 'folder', folderPath: '00-inbox', filenameTemplate: '{{date}}-{{title}}.md' }
      }
      if (options.length === 1) {
        // Only one option — skip the picker UX.
        return options[0]!.target
      }
      const picked = await showPicker(options)
      return picked?.target ?? null
    }

    case 'dynamic': {
      if (!choice.resolve) {
        return null
      }
      return choice.resolve(context)
    }
  }
}
