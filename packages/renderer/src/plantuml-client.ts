/** Renders PlantUML blocks via local sidecar when available, else plantuml.com. */
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
      let svg: string | null = null
      if (renderLocal) {
        svg = await renderLocal(source)
      }
      if (!svg) {
        const { encode } = (await import('plantuml-encoder')) as { encode: (source: string) => string }
        const encoded = encode(source)
        const response = await fetch(`https://www.plantuml.com/plantuml/svg/${encoded}`)
        if (!response.ok) throw new Error('remote PlantUML failed')
        svg = await response.text()
      }
      const image = document.createElement('img')
      image.alt = 'PlantUML diagram'
      image.loading = 'lazy'
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      node.replaceChildren(image)
    } catch {
      node.textContent = source
    }
  }
}
