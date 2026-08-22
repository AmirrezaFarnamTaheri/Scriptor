/** Add copy buttons to fenced code blocks in preview HTML. */
export function attachPreviewCodeCopy(
  root: HTMLElement,
  copyText: (text: string) => Promise<void> = async (text) => {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(text)
  },
): () => void {
  const cleanups: Array<() => void> = []

  for (const block of root.querySelectorAll('pre')) {
    if (block.querySelector('.code-copy-button')) continue
    const code = block.querySelector('code')
    const text = code?.textContent ?? block.textContent ?? ''
    if (!text.trim()) continue

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'code-copy-button'
    button.textContent = 'Copy'
    button.setAttribute('aria-label', 'Copy code to clipboard')
    block.classList.add('has-copy-button')

    let resetTimer: number | undefined
    const showResult = (label: string, ariaLabel: string) => {
      button.textContent = label
      button.setAttribute('aria-label', ariaLabel)
      if (resetTimer !== undefined) window.clearTimeout(resetTimer)
      resetTimer = window.setTimeout(() => {
        button.textContent = 'Copy'
        button.setAttribute('aria-label', 'Copy code to clipboard')
      }, 1200)
    }
    const onClick = () => {
      void copyText(text).then(
        () => showResult('Copied', 'Code copied to clipboard'),
        () => showResult('Copy failed', 'Copy failed; try again'),
      )
    }
    button.addEventListener('click', onClick)
    block.appendChild(button)
    cleanups.push(() => {
      button.removeEventListener('click', onClick)
      if (resetTimer !== undefined) window.clearTimeout(resetTimer)
    })
  }

  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}
