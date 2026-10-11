import type { MermaidConfig } from 'mermaid'

/** The singleton API needed by both preview enhancement and SVG export. */
export interface MermaidRuntime {
  initialize(config: MermaidConfig): void
  mermaidAPI: { getSiteConfig(): MermaidConfig }
  run(options: { nodes: HTMLElement[] }): Promise<unknown>
  render(id: string, source: string): Promise<{ svg: string }>
}

type MermaidLoader = () => Promise<MermaidRuntime>

async function loadMermaid(): Promise<MermaidRuntime> {
  const { default: mermaid } = await import('mermaid')
  return mermaid
}

// Mermaid queues rendering internally, but initialize() changes shared settings
// immediately. Keep configuration and its entire asynchronous render together.
let pending: Promise<void> = Promise.resolve()

function withMermaidConfig<T>(
  load: MermaidLoader,
  configuration: (previous: MermaidConfig) => MermaidConfig,
  render: (mermaid: MermaidRuntime) => Promise<T>,
): Promise<T> {
  const result = pending.then(async () => {
    const mermaid = await load()
    // Mermaid returns a copy, including nested site settings.
    const previous = mermaid.mermaidAPI.getSiteConfig()
    try {
      mermaid.initialize(configuration(previous))
      return await render(mermaid)
    } finally {
      mermaid.initialize(previous)
    }
  })
  // Rejected imports, initialization and renders must all release the queue.
  pending = result.then(() => undefined, () => undefined)
  return result
}

export function createMermaidPreviewRenderer(
  load: MermaidLoader = loadMermaid,
): Pick<MermaidRuntime, 'run'> {
  return {
    run: options => withMermaidConfig(
      load,
      () => ({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' }),
      mermaid => mermaid.run(options),
    ),
  }
}

/** Render export SVG while preventing author directives from adding HTML labels. */
export function renderMermaidSvgWithLoader(
  source: string,
  load: MermaidLoader = loadMermaid,
): Promise<string> {
  return withMermaidConfig(
    load,
    previous => ({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'strict',
      // HTML labels use foreignObject, which taints an SVG-backed canvas.
      htmlLabels: false,
      secure: [...new Set([...(previous.secure ?? []), 'htmlLabels'])],
    }),
    async mermaid => {
      const id = `scriptor-mermaid-${crypto.randomUUID()}`
      const rendered = await mermaid.render(id, source)
      return rendered.svg
    },
  )
}
