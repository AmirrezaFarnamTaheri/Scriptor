import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import { findTableBlock } from './transform-logic.ts'
import { runTableContextAction, TABLE_CONTEXT_MENU, type TableContextAction } from './table-commands.ts'

function docLines(view: EditorView): string[] {
  const lines: string[] = []
  for (let line = 1; line <= view.state.doc.lines; line += 1) {
    lines.push(view.state.doc.line(line).text)
  }
  return lines
}

function isInTable(view: EditorView): boolean {
  const lineIndex = view.state.doc.lineAt(view.state.selection.main.head).number - 1
  return Boolean(findTableBlock(docLines(view), lineIndex))
}

function showTableMenu(view: EditorView, clientX: number, clientY: number): void {
  const menu = document.createElement('div')
  menu.className = 'scriptor-table-context-menu'
  menu.setAttribute('role', 'menu')
  menu.style.position = 'fixed'
  menu.style.left = `${clientX}px`
  menu.style.top = `${clientY}px`
  menu.style.zIndex = '10000'

  let lastGroup: string | undefined
  for (const item of TABLE_CONTEXT_MENU) {
    if (item.group && item.group !== lastGroup) {
      const divider = document.createElement('hr')
      menu.appendChild(divider)
      lastGroup = item.group
    }
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = item.label
    button.setAttribute('role', 'menuitem')
    button.addEventListener('click', () => {
      runTableContextAction(view, item.id as TableContextAction)
      cleanup()
      view.focus()
    })
    menu.appendChild(button)
  }

  const cleanup = () => {
    menu.remove()
    document.removeEventListener('click', onOutside, true)
    document.removeEventListener('keydown', onEscape, true)
  }

  const onOutside = (event: MouseEvent) => {
    if (!menu.contains(event.target as Node)) cleanup()
  }

  const onEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') cleanup()
  }

  document.body.appendChild(menu)
  window.setTimeout(() => {
    document.addEventListener('click', onOutside, true)
    document.addEventListener('keydown', onEscape, true)
  }, 0)
}

export function tableContextMenuExtension(): Extension {
  return EditorView.domEventHandlers({
    contextmenu(event, view) {
      if (!isInTable(view)) return false
      event.preventDefault()
      showTableMenu(view, event.clientX, event.clientY)
      return true
    },
  })
}
