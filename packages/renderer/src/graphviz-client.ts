import { validateGraphvizSource, validateGraphvizOutput } from './graphviz-policy.ts'

/** Each bounded request owns a worker; timeout or preview replacement kills it. */
export function renderGraphvizSvg(source: string, signal?: AbortSignal): Promise<string> {
  validateGraphvizSource(source)
  if (signal?.aborted) return Promise.reject(new Error('Graphviz rendering cancelled'))
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./graphviz.worker.ts', import.meta.url), { type: 'module' })
    const finish = (error?: Error, svg?: string) => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort); worker.terminate()
      if (error) reject(error); else resolve(svg!)
    }
    const abort = () => finish(new Error('Graphviz rendering cancelled'))
    const timer = setTimeout(() => finish(new Error('Graphviz rendering exceeded 10 seconds')), 10_000)
    signal?.addEventListener('abort', abort, { once: true })
    worker.onerror = () => finish(new Error('Graphviz worker could not render this source'))
    worker.onmessage = (event: MessageEvent<unknown>) => {
      try {
        const data = event.data as { svg?: unknown; error?: unknown }
        if (typeof data?.svg === 'string') finish(undefined, validateGraphvizOutput(data.svg))
        else finish(new Error(typeof data?.error === 'string' ? data.error.slice(0, 2048) : 'Invalid Graphviz response'))
      } catch (error) { finish(error instanceof Error ? error : new Error('Invalid Graphviz response')) }
    }
    worker.postMessage(source)
  })
}

export async function renderGraphvizDiagrams(root: HTMLElement, signal?: AbortSignal): Promise<void> {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('pre > code.language-dot, pre > code.language-graphviz'))
  for (const [index, code] of nodes.entries()) {
    if (signal?.aborted) return
    const parent = code.parentElement
    if (!parent) continue
    const source = code.textContent ?? ''
    try {
      if (index >= 16) throw new Error('A preview can render at most 16 Graphviz diagrams')
      const svg = await renderGraphvizSvg(source, signal)
      if (signal?.aborted || !root.contains(parent)) return
      // Image context disables active SVG content, links and external resources.
      const image = root.ownerDocument.createElement('img')
      image.alt = 'Graphviz diagram'; image.decoding = 'async'
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      parent.replaceChildren(image)
    } catch (error) {
      if (signal?.aborted) return
      const caption = root.ownerDocument.createElement('strong')
      caption.textContent = `Graphviz: ${error instanceof Error ? error.message : 'Could not render diagram'}`
      parent.prepend(caption)
    }
  }
}
