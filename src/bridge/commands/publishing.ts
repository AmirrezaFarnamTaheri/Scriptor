import { invoke } from '@tauri-apps/api/core'
import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'
import { validateDeploymentTarget, type DeploymentTarget } from '../../lib/publishingStudio.ts'
export interface PublishingResult { exitCode: number; stdout: string; stderr: string; truncated: boolean; timedOut: boolean }
export async function publishingRunJob(outputPath: string, jobId: string, expectedVaultId: string, target?: DeploymentTarget, apiToken = ''): Promise<PublishingResult> {
  requireNative()
  if (target) validateDeploymentTarget(target)
  const scope = target ? `pages-deploy:${outputPath}:${target.accountId}:${target.project}:${jobId}` : `site-build:${outputPath}:${jobId}`
  const authorizationToken = target ? await authorizeSensitiveOperation('publish_deploy', scope) : await authorizeSensitiveOperation('publish_build', scope)
  const result = target
    ? await invoke<PublishingResult>('publishing_deploy_site', { outputPath, jobId, expectedVaultId, accountId:target.accountId,project:target.project,apiToken,authorizationToken })
    : await invoke<PublishingResult>('publishing_build_site', { outputPath, jobId, expectedVaultId, authorizationToken })
  if (!result || !Number.isInteger(result.exitCode) || typeof result.stdout !== 'string' || typeof result.stderr !== 'string' || result.stdout.length + result.stderr.length > 524288 || typeof result.truncated !== 'boolean' || typeof result.timedOut !== 'boolean') throw new Error('Invalid publication result')
  return result
}
export async function publishingCancelJob(jobId: string, expectedVaultId: string): Promise<boolean> {
  requireNative()
  return invoke('publishing_cancel_job', { jobId, expectedVaultId })
}
export async function publishingConfigureDomain(target: DeploymentTarget, apiToken: string, expectedVaultId: string) {
  requireNative()
  const normalized = validateDeploymentTarget(target)
  if (!normalized.domain) throw new Error('Enter a custom domain')
  const authorizationToken = await authorizeSensitiveOperation('publish_deploy', `pages-domain:${normalized.accountId}:${normalized.project}:${normalized.domain}`)
  return invoke<{domain:string;status:string;cname_target:string}>('publishing_configure_domain', { accountId:normalized.accountId,project:normalized.project,domain:normalized.domain,apiToken,expectedVaultId,authorizationToken })
}
