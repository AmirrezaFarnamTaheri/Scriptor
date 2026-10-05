import { renderMermaidSvgWithLoader } from './mermaid-coordinator.ts'

/** SVG suitable for browser rasterization, coordinated with interactive previews. */
export function renderMermaidSvg(source: string): Promise<string> {
  return renderMermaidSvgWithLoader(source)
}
