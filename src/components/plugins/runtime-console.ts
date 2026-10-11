export const RUNTIME_CONSOLE_SOURCE_LIMIT = 64000
export const RUNTIME_CONSOLE_OUTPUT_LIMIT = 262144
export const runtimeConsoleLanguages = ['python', 'javascript', 'typescript', 'bash', 'powershell'] as const
export type RuntimeConsoleLanguage = typeof runtimeConsoleLanguages[number]
export interface RuntimeConsoleResult { exit_code: number; stdout: string; stderr: string; duration_ms: number; language: string }
export function validateRuntimeConsoleInput(language: string, code: string): void {
  if (!runtimeConsoleLanguages.some(value => value === language)) throw new Error('Unsupported language')
  if (!code.trim() || code.length > RUNTIME_CONSOLE_SOURCE_LIMIT || code.includes('\0')) throw new Error('Code must contain 1–64,000 characters without null bytes')
}
export function parseRuntimeConsoleResult(input: unknown): RuntimeConsoleResult {
  if (!input || typeof input !== 'object') throw new Error('Invalid execution response')
  const result = input as Record<string, unknown>
  if (!Number.isSafeInteger(result.exit_code) || !Number.isFinite(result.duration_ms) || Number(result.duration_ms) < 0 || typeof result.language !== 'string' || result.language.length > 64 || typeof result.stdout !== 'string' || typeof result.stderr !== 'string') throw new Error('Invalid execution response')
  const bounded = (text: string) => text.length > RUNTIME_CONSOLE_OUTPUT_LIMIT ? `${text.slice(0, RUNTIME_CONSOLE_OUTPUT_LIMIT)}\n[Output truncated]` : text
  return { exit_code: Number(result.exit_code), duration_ms: Number(result.duration_ms), language: result.language, stdout: bounded(result.stdout), stderr: bounded(result.stderr) }
}
