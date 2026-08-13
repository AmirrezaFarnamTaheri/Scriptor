/**
 * Capture layer — TypeScript side of the D2 split (W3-5).
 *
 * Responsibilities:
 *  - Define `CaptureTarget` (where the result lands in the vault).
 *  - Define the `CaptureChoice` model (QuickAdd-style prompt or silent).
 *  - Expose `resolveTarget()` for target resolution (used by QuickAdd, web clip, template capture).
 *  - Register the "Clip URL" command in the command registry.
 *
 * The Rust pipeline (`crates/capture`) is invoked via the Tauri bridge.
 * All vault writes go through the single write path (I-1).
 */

export type { CaptureTarget, TargetKind } from './target'
export type { CaptureChoice, CaptureChoiceOption } from './choice'
export { resolveTarget } from './target'
export { presentCaptureChoice } from './choice'
export { registerCaptureCommands } from './commands'
