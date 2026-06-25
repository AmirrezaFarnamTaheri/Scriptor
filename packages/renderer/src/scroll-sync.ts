export function findPreviewAnchor(previewRoot: HTMLElement, line: number): Element | null {
  let target: Element | null = null
  let best = -1
  for (const node of previewRoot.querySelectorAll('[data-source-line]')) {
    const nodeLine = Number(node.getAttribute('data-source-line'))
    if (!Number.isFinite(nodeLine)) continue
    if (nodeLine <= line && nodeLine > best) {
      best = nodeLine
      target = node
    }
  }
  return target
}

export function scrollPreviewToLine(
  scrollContainer: HTMLElement,
  previewRoot: HTMLElement,
  line: number,
): void {
  const anchor = findPreviewAnchor(previewRoot, line)
  if (!anchor) return
  const containerTop = scrollContainer.getBoundingClientRect().top
  const anchorTop = anchor.getBoundingClientRect().top
  scrollContainer.scrollTop += anchorTop - containerTop - 8
}

export function getPreviewTopSourceLine(
  scrollContainer: HTMLElement,
  previewRoot: HTMLElement,
): number | null {
  const containerTop = scrollContainer.getBoundingClientRect().top + 8
  let best: { line: number; top: number } | null = null
  for (const node of previewRoot.querySelectorAll('[data-source-line]')) {
    const rect = node.getBoundingClientRect()
    const line = Number(node.getAttribute('data-source-line'))
    if (!Number.isFinite(line)) continue
    if (rect.top < containerTop - 1) continue
    if (!best || rect.top < best.top) best = { line, top: rect.top }
  }
  return best?.line ?? null
}
