/**
 * useLatexCompiler
 * -----------------
 * LaTeX compile capability using Tectonic as the 3rd-party engine.
 * https://tectonic-typesetting.github.io/book/latest/
 *
 * Tectonic is a self-contained TeX/LaTeX engine that:
 *  - Auto-downloads required TeX Live packages on first use
 *  - Produces PDF output with a single command
 *  - Has no separate TeX installation required
 *
 * This hook invokes Tectonic via Tauri's `shell` sidecar or `Command` API,
 * wiring compile jobs into Scriptor's existing ExportJobRecord infrastructure.
 *
 * Usage:
 *  ```tsx
 *  const { compile, status, jobs, cancelJob, clearJobs, discoverTectonic } =
 *    useLatexCompiler({ config: vaultConfig?.latex, vaultRoot })
 *  ```
 */

import { useState, useCallback, useRef } from 'react'

import { latexCancelCompile, latexCompile, latexDiscoverTectonic } from '../bridge/commands/latex.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LatexJobStatus = 'idle' | 'compiling' | 'success' | 'error' | 'cancelled'

export interface LatexCompileJob {
  id: string
  inputPath: string
  outputPath: string | null
  status: LatexJobStatus
  startedAt: string
  finishedAt: string | null
  stdout: string
  stderr: string
  durationMs: number | null
}

export interface LatexCompilerConfig {
  enabled: boolean
  tectonic_path: string | null
  output_directory: string
  extra_flags: string[]
  compile_on_save: boolean
}

export interface LatexCompilerOptions {
  config: LatexCompilerConfig | undefined
  vaultRoot: string | null
}

export interface LatexCompileRequest {
  /** Absolute path to the .tex file to compile. */
  inputPath: string
  /** Optional output directory override. */
  outputDir?: string
  /** Additional flags to pass to tectonic. */
  extraFlags?: string[]
}

export interface LatexCompilerResult {
  /** All compile jobs (most-recent first). */
  jobs: LatexCompileJob[]
  /** Currently running job, or null. */
  activeJob: LatexCompileJob | null
  /** Compile a .tex file. Returns the job. */
  compile: (req: LatexCompileRequest) => Promise<LatexCompileJob>
  /** Cancel the currently running job. */
  cancelJob: () => void
  /** Remove finished jobs from history. */
  clearJobs: () => void
  /** Discover tectonic on PATH, return found path or null. */
  discoverTectonic: () => Promise<string | null>
  /** Whether tectonic was found on PATH. */
  tectonicAvailable: boolean | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJobId(): string {
  return `latex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLatexCompiler({ config, vaultRoot }: LatexCompilerOptions): LatexCompilerResult {
  const [jobs, setJobs] = useState<LatexCompileJob[]>([])
  const [activeJob, setActiveJob] = useState<LatexCompileJob | null>(null)
  const [tectonicAvailable, setTectonicAvailable] = useState<boolean | null>(null)
  const cancelRef = useRef(false)

  /** Discover tectonic binary. Tries config path first, then PATH. */
  const tectonicPath = config?.tectonic_path ?? null
  const discoverTectonic = useCallback(async (): Promise<string | null> => {
    try {
      const result = await latexDiscoverTectonic(tectonicPath)
      setTectonicAvailable(result !== null)
      return result
    } catch {
      setTectonicAvailable(false)
      return null
    }
  }, [tectonicPath])

  /** Compile a .tex file using Tectonic. */
  const compile = useCallback(
    async (req: LatexCompileRequest): Promise<LatexCompileJob> => {
      const id = makeJobId()
      const startedAt = new Date().toISOString()
      const outputDir =
        req.outputDir ??
        (vaultRoot && config
          ? `${vaultRoot}/${config.output_directory}`
          : '.scriptor/latex-out')

      const job: LatexCompileJob = {
        id,
        inputPath: req.inputPath,
        outputPath: null,
        status: 'compiling',
        startedAt,
        finishedAt: null,
        stdout: '',
        stderr: '',
        durationMs: null,
      }

      setActiveJob(job)
      setJobs((prev) => [job, ...prev])
      cancelRef.current = false

      try {
        const result = await latexCompile({
          inputPath: req.inputPath,
          outputDir,
          tectonicPath: config?.tectonic_path ?? null,
          extraFlags: [...(config?.extra_flags ?? []), ...(req.extraFlags ?? [])],
        })

        const finished: LatexCompileJob = {
          ...job,
          outputPath: result.output_path,
          status: cancelRef.current ? 'cancelled' : 'success',
          finishedAt: new Date().toISOString(),
          stdout: result.stdout,
          stderr: result.stderr,
          durationMs: result.duration_ms,
        }

        setActiveJob(null)
        setJobs((prev) => prev.map((j) => (j.id === id ? finished : j)))
        return finished
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        const failed: LatexCompileJob = {
          ...job,
          status: 'error',
          finishedAt: new Date().toISOString(),
          stderr: errMsg,
          durationMs: Date.now() - new Date(startedAt).getTime(),
        }
        setActiveJob(null)
        setJobs((prev) => prev.map((j) => (j.id === id ? failed : j)))
        return failed
      }
    },
    [config, vaultRoot],
  )

  const cancelJob = useCallback(() => {
    cancelRef.current = true
    void latexCancelCompile().catch(() => undefined)
  }, [])

  const clearJobs = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === 'compiling'))
  }, [])

  return {
    jobs,
    activeJob,
    compile,
    cancelJob,
    clearJobs,
    discoverTectonic,
    tectonicAvailable,
  }
}
