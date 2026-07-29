import { useEffect } from 'react'

function repairEditorSemantics(root: ParentNode) {
  const tabsRow = root.querySelector<HTMLElement>('.tabs-row')
  if (tabsRow) {
    const hasTabs = tabsRow.querySelector('[role="tab"]') !== null
    if (hasTabs) {
      tabsRow.setAttribute('role', 'tablist')
      tabsRow.setAttribute('aria-label', 'Open notes')
    } else {
      tabsRow.removeAttribute('role')
      tabsRow.removeAttribute('aria-label')
    }
  }

  const editorMode = root.querySelector<HTMLElement>('[aria-label="Editor mode"]')
  if (editorMode) {
    const buttons = editorMode.querySelectorAll<HTMLButtonElement>('button')
    const renameButton = buttons.item(8)
    const aiButton = buttons.item(9)
    const splitButton = buttons.item(10)

    if (renameButton) {
      renameButton.setAttribute('aria-label', 'Rename active note')
      renameButton.setAttribute('title', 'Rename active note')
    }
    if (aiButton) {
      aiButton.setAttribute('aria-label', 'Insert AI summary prompt')
      aiButton.setAttribute('title', 'Insert AI summary prompt')
    }
    if (splitButton) {
      splitButton.setAttribute('aria-label', 'Toggle split preview')
      splitButton.setAttribute('title', 'Toggle split preview')
    }
  }
}

export function AccessibilitySemantics() {
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return

    const repair = () => repairEditorSemantics(root)
    repair()

    const observer = new MutationObserver(repair)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
