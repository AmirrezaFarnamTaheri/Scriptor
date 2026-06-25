export async function renderMermaidDiagrams(root: HTMLElement): Promise<void> {
  const nodes = root.querySelectorAll<HTMLElement>('.mermaid')
  if (nodes.length === 0) return

  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'strict',
  })
  await mermaid.run({ nodes: Array.from(nodes) })
}
