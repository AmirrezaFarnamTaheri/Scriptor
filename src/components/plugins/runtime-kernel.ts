import { parseRuntimeConsoleResult, type RuntimeConsoleResult } from './runtime-console.ts'
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
export interface KernelSession { id: string; vault_id: string; language: 'python'; python_version: string; executable: string; remaining_seconds: number }
export interface KernelResult extends RuntimeConsoleResult { session_id: string; variables: Array<{ name: string; type: string; value: string }>; plots: Array<{ mime_type: 'image/png'; data_base64: string; caption: string }> }
export interface KernelStatus { session: KernelSession; status: 'idle' | 'running' | 'stopped'; stdout: string; stderr: string }
export function parseRuntimeEnvironment(text: string): Record<string, string> {
  const environment: Record<string, string> = {}
  for (const line of text.split(/\r?\n/).filter(line => line.trim())) {
    const separator = line.indexOf('='), key = line.slice(0, separator).trim(), value = line.slice(separator + 1)
    if (separator < 1 || !/^[A-Z_][A-Z0-9_]{0,63}$/.test(key) || /^(?:PATH|HOME|USERPROFILE|SYSTEMROOT|COMSPEC|TEMP|TMP|PYTHON.*|LD_.*|DYLD_.*)$/.test(key) || key in environment || new TextEncoder().encode(value).length > 1024 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Use unique NAME=value entries; process configuration variables cannot be overridden.')
    environment[key] = value
  }
  if (Object.keys(environment).length > 16 || new TextEncoder().encode(JSON.stringify(environment)).length > 8192) throw new Error('Environment exceeds 16 variables or 8 KiB.')
  return environment
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function runtimeStartScope(environment: Record<string, string>): Promise<string> { return `runtime:start:python:${await sha256(JSON.stringify(Object.keys(environment).sort().map(key => [key, environment[key]])))}` }
export async function runtimeRunScope(id: string, code: string): Promise<string> { if (!UUID.test(id)) throw new Error('Invalid kernel identity'); return `runtime:run:${id}:${await sha256(code)}` }
export function parseKernelSession(value: unknown, vaultId: string): KernelSession {
  const row = value as Partial<KernelSession> | null
  if (!row || !UUID.test(row.id ?? '') || row.vault_id !== vaultId || row.language !== 'python' || typeof row.python_version !== 'string' || row.python_version.length > 64 || typeof row.executable !== 'string' || row.executable.length > 4096 || !Number.isFinite(row.remaining_seconds) || Number(row.remaining_seconds) < 0 || Number(row.remaining_seconds) > 900) throw new Error('Invalid kernel session or vault ownership')
  return row as KernelSession
}
export function parseKernelResult(value: unknown, id: string): KernelResult {
  const base = parseRuntimeConsoleResult(value), row = value as Partial<KernelResult>
  if (row.session_id !== id || base.language !== 'python' || !Array.isArray(row.variables) || row.variables.length > 64 || !Array.isArray(row.plots) || row.plots.length > 3) throw new Error('Invalid kernel result identity or bounds')
  for (const variable of row.variables) if (typeof variable.name !== 'string' || Array.from(variable.name).length > 128 || typeof variable.type !== 'string' || Array.from(variable.type).length > 128 || typeof variable.value !== 'string' || Array.from(variable.value).length > 512) throw new Error('Invalid kernel variable')
  for (const plot of row.plots) if (plot.mime_type !== 'image/png' || typeof plot.data_base64 !== 'string' || plot.data_base64.length > 5_592_408 || !/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(plot.data_base64) || typeof plot.caption !== 'string' || plot.caption.length > 128) throw new Error('Invalid kernel plot')
  return { ...base, session_id: id, variables: row.variables, plots: row.plots }
}
export function parseKernelStatus(value: unknown, vaultId: string, id: string): KernelStatus {
  const row = value as Partial<KernelStatus>, session = parseKernelSession(row?.session, vaultId)
  if (session.id !== id || !['idle', 'running', 'stopped'].includes(row.status ?? '') || typeof row.stdout !== 'string' || typeof row.stderr !== 'string' || new TextEncoder().encode(row.stdout + row.stderr).length > 262144) throw new Error('Invalid kernel status')
  return { session, status: row.status as KernelStatus['status'], stdout: row.stdout, stderr: row.stderr }
}
