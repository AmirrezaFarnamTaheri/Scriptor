import { invoke } from '@tauri-apps/api/core'

import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'

export interface LatexCompileOutput {
  output_path: string
  stdout: string
  stderr: string
  duration_ms: number
}

/**
 * Discover the Tectonic engine. Tries the configured path first, then PATH.
 * Returns the resolved path, or null when Tectonic is unavailable.
 */
export async function latexDiscoverTectonic(configPath: string | null): Promise<string | null> {
  requireNative()
  return invoke<string | null>('latex_discover_tectonic', { configPath })
}

/** Compile a `.tex` file to PDF using Tectonic (authorization-gated). */
export async function latexCompile(args: {
  inputPath: string
  outputDir: string
  tectonicPath: string | null
  extraFlags: string[]
}): Promise<LatexCompileOutput> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('latex_compilation', args.inputPath)
  return invoke<LatexCompileOutput>('latex_compile', {
    inputPath: args.inputPath,
    outputDir: args.outputDir,
    tectonicPath: args.tectonicPath,
    extraFlags: args.extraFlags,
    authorizationToken,
  })
}

/** Request best-effort cancellation of a queued LaTeX compile. */
export async function latexCancelCompile(): Promise<boolean> {
  requireNative()
  return invoke<boolean>('latex_cancel_compile')
}
