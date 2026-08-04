/**
 * Renders PlantUML blocks only through the caller-provided local renderer.
 * Diagram source is never sent to a remote service implicitly.
 */
export async function renderPlantUmlDiagrams(
  root: HTMLElement,
  renderLocal?: (source: string) => Promise<string | null>,
): Promise<void> {
  const nodes = root.querySelectorAll<HTMLElement>('[data-plantuml], .plantuml-block[data-plantuml]')
  if (nodes.length === 0) return

  for (const node of nodes) {
    const source = node.getAttribute('data-plantuml') ?? node.textContent ?? ''
    if (!source.trim()) continue

    try {
      const svg = renderLocal ? await renderLocal(source) : null
      if (!svg) {
        showLocalRendererUnavailable(node, source)
        continue
      }

      const image = document.createElement('img')
      image.alt = 'PlantUML diagram'
      image.loading = 'lazy'
      image.decoding = 'async'
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      node.replaceChildren(image)
    } catch (error) {
      showLocalRendererUnavailable(
        node,
        source,
        error instanceof Error ? error.message : String(error),
      )
    }
  }
}

function showLocalRendererUnavailable(node: HTMLElement, source: string, detail?: string): void {
  const container = document.createElement('figure')
  container.className = 'plantuml-unavailable'

  const caption = document.createElement('figcaption')
  caption.textContent = detail
    ? `PlantUML local renderer failed: ${detail}`
    : 'PlantUML local renderer is unavailable. Install PlantUML locally to render this diagram.'

  const fallback = document.createElement('pre')
  fallback.textContent = source

  container.append(caption, fallback)
  node.replaceChildren(container)
}
