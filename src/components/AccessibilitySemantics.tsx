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

  const