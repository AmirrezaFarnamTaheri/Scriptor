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

      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        if (child && child.type === 'element' && child.tagName === 'em') {
          const first = child.children[0]
          if (first && first.type === 'text') {
            const nextChild = node.children[i + 1]
            const hasDash =
              nextChild &&
              nextChild.type === 'text' &&
              (nextChild.value.startsWith(' — ') ||
                nextChild.value.startsWith(' \u2014 ') ||
                nextChild.value.startsWith(' —'))

            if (first.value === 'In progress' && hasDash) {
              matchedState = 'in-progress'
              break
            }
            if (first.value === 'Cancelled' && hasDash) {
              matchedState = 'cancelled'
              break
            }
            if (first.value === 'Forwarded' && hasDash) {
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
