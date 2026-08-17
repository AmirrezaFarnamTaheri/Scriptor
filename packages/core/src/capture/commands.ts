/**
 * Command-palette registration for the capture layer (W3-5, F-3).
 *
 * Registers exactly one command ID per capture surface so the command
 * registry (I-5) remains the single source of truth. The actual invocation
 * delegates to the Tauri bridge for the Rust pipeline.
 *
 * Commands registered here:
 * - `scriptor.capture.clipUrl`       — prompt for a URL, clip it to inbox.
 * - `scriptor.capture.clipSelection` — clip selected text in the active note.
 * - `scriptor.capture.quickAdd`      — QuickAdd-style text note capture.
 *
 * The registry shape matches `src/lib/commands/registry.ts` (Wave 2, W2-9).
 */

interface CommandDefinition {
  id: string
  label: string
  description: string
  category: string
  hotkey: string | null
}

interface CommandRegistry {
  register: (command: CommandDefinition) => void
}

export function registerCaptureCommands(registry: CommandRegistry): void {
  const commands: CommandDefinition[] = [
    {
      id: 'scriptor.capture.clipUrl',
      label: 'Clip URL to vault',
      description: 'Fetch a web page and save it as a Markdown note',
      category: 'capture',
      // Hotkey is intentionally not pre-set — users assign it via the keymap.
      hotkey: null,
    },
    {
      id: 'scriptor.capture.clipSelection',
      label: 'Clip selection to vault',
      description: 'Save the current editor selection as a new note',
      category: 'capture',
      hotkey: null,
    },
    {
      id: 'scriptor.capture.quickAdd',
      label: 'Quick Add note',
      description: 'Quickly capture a plain-text note to the inbox',
      category: 'capture',
      hotkey: null,
    },
  ]

  for (const cmd of commands) {
    registry.register(cmd)
  }
}
