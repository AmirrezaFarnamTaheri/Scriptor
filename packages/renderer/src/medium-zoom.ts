/** Medium-zoom style image enlargement for preview panes. */
export function attachMediumZoom(root: HTMLElement): () => void {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
  const cleanups: Array<() => void> = []

  for (const image of images) {
    image.style.cursor = 'zoom-in'
    const onClick = () => {
      const overlay = document.createElement('div')
      overlay.className = 'medium-zoom-overlay'
      overlay.setAttribute('role', 'dialog')
      overlay.setAttribute('aria-label', 'Enlarged image')
      const clone = image.cloneNode(true) as HTMLImageElement
      clone.style.maxWidth = '92vw'
      clone.style.maxHeight = '92vh'
      clone.style.cursor = 'zoom-out'
      overlay.appendChild(clone)
      const close = () => overlay.remove()
      overlay.addEventListener('click', close)
      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Escape') close()
        },
        { once: true },
      )
      document.body.appendChild(overlay)
    }
    image.addEventListener('click', onClick)
    cleanups.push(() => image.removeEventListener('click', onClick))
  }

  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}
