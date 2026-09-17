import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'

type ExtendedTaskState = 'in-progress' | 'cancelled' | 'forwarded'

const VALID_STATES = new Set<ExtendedTaskState>(['in-progress', 'cancelled', 'forwarded'])

function consumeGeneratedStateMarker(element: Element): ExtendedTaskState | null {
  for (let index = 0; index < element.children.length; index++) {
    const child = element.children[index]
    if (!child || child.type !== 'element') continue

    if (child.tagName === 'span') {
      const raw = child.properties?.dataScriptorGeneratedTaskState
      if (typeof raw === 'string' && VALID_STATES.has(raw as ExtendedTaskState)) {
        element.children.splice(index, 1)
        return raw as ExtendedTaskState
      }
    }

    const nested = consumeGeneratedStateMarker(child)
    if (nested) return nested
  }
  return null
}

/**
 * Annotates extended task list items and their input checkboxes with
 * `data-task-state`. State is derived only from the private provenance marker
 * emitted by `preprocessExtendedTaskStates`; visible prose is never interpreted
 * as structured task state. The marker is consumed before sanitization so it
 * cannot leak into rendered/exported HTML.
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

      const state = consumeGeneratedStateMarker(node)
      if (!state) return

      node.properties = { ...node.properties, dataTaskState: state }
      input.properties = { ...input.properties, dataTaskState: state }
    })
  }
}
