export interface CodeChunkRunResult {
  exit_code: number
  stdout: string
  stderr: string
  duration_ms: number
  language: string
}

export async function hydrateMpeCodeChunks(
  root: HTMLElement,
  runChunk: (language: string, code: string) => Promise<CodeChunkRunResult>,
): Promise<void> {
  const chunks = root.querySelectorAll<HTMLElement>('[data-mpe-chunk="true"]')
  for (const chunk of chunks) {
    const button = chunk.querySelector<HTMLButtonElement>('[data-mpe-run="true"]')
    const code = chunk.querySelector('code')?.textContent ?? ''
    const language = chunk.dataset.mpeLang ?? 'powershell'
    const output = chunk.querySelector<HTMLElement>('.mpe-code-chunk-output')
    if (!button || !output) continue

    button.addEventListener('click', () => {
      void (async () => {
        button.disabled = true
        output.hidden = false
        output.textContent = 'Running…'
        try {
          const result = await runChunk(language, code)
          output.textContent = [
            `exit ${result.exit_code} (${result.duration_ms}ms)`,
            result.stdout.trim(),
            result.stderr.trim(),
          ]
            .filter(Boolean)
            .join('\n')
        } catch (error) {
          output.textContent = error instanceof Error ? error.message : 'Run failed'
        } finally {
          button.disabled = false
        }
      })()
    })
  }
}
