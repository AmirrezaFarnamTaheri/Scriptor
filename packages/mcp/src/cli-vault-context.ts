import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import type { McpVaultContext } from './runtime.ts'

const execFileAsync = promisify(execFile)

function resolveCliBinary(): string {
  return process.env.SCRIPTOR_CLI?.trim() || 'scriptor'
}

async function runCliJson<T>(args: string[]): Promise<T> {
  const binary = resolveCliBinary()
  const { stdout } = await execFileAsync(binary, args, {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  })
  return JSON.parse(stdout) as T
}

export function createCliVaultContext(vaultPath: string): McpVaultContext {
  return {
    search: async (query, limit = 25) => {
      const hits = await runCliJson<Array<{ path: string; title: string; snippet: string }>>([
        'search',
        vaultPath,
        '--query',
        query,
        '--limit',
        String(limit),
      ])
      return hits
    },
    readNote: async (path) => {
      const document = await runCliJson<{ metadata: { title: string; content_hash: string }; markdown: string }>([
        'read',
        vaultPath,
        '--note',
        path,
      ])
      return document
    },
    backlinks: async (path) => {
      return runCliJson<unknown[]>(['backlinks', vaultPath, '--note', path])
    },
    brokenLinks: async () => {
      const diagnostics = await runCliJson<{
        issues: Array<{ kind: string; path: string; detail: string; line: number | null }>
      }>(['health-diagnostics', vaultPath])
      return diagnostics.issues.filter((issue) => issue.kind === 'broken_link')
    },
    exportProfiles: async () => [],
  }
}

export function resolveStdioVaultPath(): string | null {
  const value = process.env.SCRIPTOR_VAULT?.trim()
  return value && value.length > 0 ? value : null
}
