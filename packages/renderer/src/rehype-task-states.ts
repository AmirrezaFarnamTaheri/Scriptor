import type { Root } from 'hast'
import { visit } from 'unist-util-visit'

/**
 * Annotates task list items and their input checkboxes with `data-task-state`
 * ('in-progress' | 'cancelled' | 'forwarded') based on extended task markdown markers.
 */
export function rehypeTaskStates() {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'li') return
      const className = node.properties?.className
      const isTaskItem = Array.isArray(className)
        ? className.includes('task-list-item')
        : className === 'task-list-item'
      if (!isTaskItem) return

      const input = node.children.find(
        (child) => child.type === 'element' && child.tagName === 'input',
      )
      if (!input || input.type !== 'element') return

      let matchedState: 'in-progress' | 'cancelled' | 'forwarded' | null = null

      for (const child of node.children) {
        if (child.type === 'element' && child.tagName === 'em') {
          const first = child.children[0]
          if (first && first.type === 'text') {
            if (first.value === 'In progress') {
              matchedState = 'in-progress'
              break
            }
            if (first.value === 'Cancelled') {
              matchedState = 'cancelled'
              break
            }
            if (first.value === 'Forwarded') {
              matchedState = 'forwarded'
              break
            }
          }
        }
      }

      if (matchedState) {
        node.properties = { ...node.properties, dataTaskState: matchedState }
        input.properties = { ...input.properties, dataTaskState: matchedState }
      }
    })
  }
}
