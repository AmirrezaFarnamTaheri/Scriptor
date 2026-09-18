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
 * This hook invokes Tectonic via Tauri's native process bridge and wires
 * compile jobs into Scriptor's existing export/job presentation.
 */

import { useState, useCallback, useRef } from 'react'

import { latexCancelCompile, latexCompile, latexDiscoverTectonic } from '../bridge/commands/latex.ts'

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
}

export interface LatexCompileRequest {
  /** Vault-relative source path (preferred), or an absolute path inside the active vault. */
  inputPath: string
  /** Optional output directory override. */
  outputDir?: string
  /** Additional flags to pass to tectonic. */
  extraFlags?: string[]
}

export interface LatexCompilerResult {
  jobs: LatexCompileJob[]
  activeJob: LatexCompileJob | null
  compile: (req: LatexCompileRequest) => Promise<LatexCompileJob>
  cancelJob: () => void
  clearJobs: () => void
  discoverTectonic: () => Promise<string | null>
  tectonicAvailable: boolean | null
}

function makeJobId(): string {
  return `latex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Reports whether a native compiler error represents user cancellation. */
function isCancellationError(message: string): boolean {
  return /\b(cancelled|canceled)\b/i.test(message)
}

/** Manages Tectonic discovery, compile jobs, cancellation, and job history. */
export function useLatexCompiler({ config }: LatexCompilerOptions): LatexCompilerResult {
  const [jobs, setJobs] = useState<LatexCompileJob[]>([])
  const [activeJob, setActiveJob] = useState<LatexCompileJob | null>(null)
  const [tectonicAvailable, setTectonicAvailable] = useState<boolean | null>(null)
  const cancelRef = useRef(false)

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

  const compile = useCallback(
    async (req: LatexCompileRequest): Promise<LatexCompileJob> => {
      const id = makeJobId()
      const startedAt = new Date().toISOString()
      // Vault-relative: the native command resolves this under the canonical
      // vault root and rejects anything that would escape it, so the frontend
      // never composes an absolute output path.
      const outputDir =
        req.outputDir?.trim() || config?.output_directory?.trim() || '.scriptor/latex-out'

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
          // A resolved native compile is a success even if Cancel raced with
          // process completion. Real cancellation rejects with the canonical
          // cancellation error below.
          status: 'success',
          finishedAt: new Date().toISOString(),
          stdout: result.stdout,
          stderr: result.stderr,
          durationMs: result.duration_ms,
        }

        cancelRef.current = false
        setActiveJob(null)
        setJobs((prev) => prev.map((j) => (j.id === id ? finished : j)))
        return finished
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        const cancelled = cancelRef.current || isCancellationError(errMsg)
        const failed: LatexCompileJob = {
          ...job,
          status: cancelled ? 'cancelled' : 'error',
          finishedAt: new Date().toISOString(),
          stderr: errMsg,
          durationMs: Date.now() - new Date(startedAt).getTime(),
        }
        cancelRef.current = false
        setActiveJob(null)
        setJobs((prev) => prev.map((j) => (j.id === id ? failed : j)))
        return failed
      }
    },
    [config],
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
