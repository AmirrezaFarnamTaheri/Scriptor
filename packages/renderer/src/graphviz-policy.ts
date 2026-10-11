export function validateGraphvizSource(source: string): string {
  if (!source.trim()) throw new Error('Enter Graphviz source')
  if (source.includes('\0')) throw new Error('Graphviz source contains NUL')
  if (new TextEncoder().encode(source).length > 65_536) throw new Error('Graphviz source exceeds 64 KiB')
  return source
}
export function validateGraphvizOutput(svg: string): string {
  if (new TextEncoder().encode(svg).length > 4_194_304) throw new Error('Graphviz output exceeds 4 MiB')
  if (!/<svg(?:\s|>)/.test(svg)) throw new Error('Graphviz did not produce SVG')
  return svg
}
