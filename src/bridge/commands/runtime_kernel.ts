import { invoke } from '@tauri-apps/api/core'
import { requireNative } from '../native'
import { authorizeSensitiveOperation } from './authorization'
import { parseKernelResult, parseKernelSession, parseKernelStatus, runtimeRunScope, runtimeStartScope, type KernelResult, type KernelSession, type KernelStatus } from '../../components/plugins/runtime-kernel'
import { validateRuntimeConsoleInput } from '../../components/plugins/runtime-console'
export async function runtimeKernelStart(vaultId: string, environment: Record<string, string>): Promise<KernelSession> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('code_execution', await runtimeStartScope(environment))
  return parseKernelSession(await invoke('runtime_kernel_start', { expectedVaultId: vaultId, environment, authorizationToken }), vaultId)
}
export async function runtimeKernelRun(session: KernelSession, code: string): Promise<KernelResult> {
  requireNative(); validateRuntimeConsoleInput('python', code)
  const authorizationToken = await authorizeSensitiveOperation('code_execution', await runtimeRunScope(session.id, code))
  return parseKernelResult(await invoke('runtime_kernel_run', { expectedVaultId: session.vault_id, sessionId: session.id, code, authorizationToken }), session.id)
}
export async function runtimeKernelStatus(session: KernelSession): Promise<KernelStatus> {
  requireNative()
  return parseKernelStatus(await invoke('runtime_kernel_status', { expectedVaultId: session.vault_id, sessionId: session.id }), session.vault_id, session.id)
}
export async function runtimeKernelStop(session: KernelSession): Promise<void> {
  requireNative()
  await invoke('runtime_kernel_stop', { expectedVaultId: session.vault_id, sessionId: session.id })
}
