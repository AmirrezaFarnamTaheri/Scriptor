import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

function parseHtmlBody(html: string): HTMLElement | null {
  if (typeof DOMParser === 'undefined') {
    return null
  }
  return new DOMParser().parseFromString(html, 'text/html').body
}

function htmlToMarkdownFallback(html: string): string {
  const text = html
    .replace(/<\/?(p|div|br)\s*[^>]*>/gi, (match) => (match.startsWith('</') ? '\n\n' : ''))
    .replace(/<(strong|b)\s*[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)\s*[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li\s*[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<\/?(ul|ol)\s*[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function inlineChildren(node: Node): string {
  let result = ''
  node.childNodes.forEach((child) => {
    result += nodeToMarkdown(child)
  })
  return result
}

export function htmlToMarkdown(html: string): string {
  const body = parseHtmlBody(html)
  if (!body) {
    return htmlToMarkdownFallback(html)
  }
  return nodeToMarkdown(body).replace(/\n{3,}/g, '\n\n').trim()
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const element = node as HTMLElement
  const tag = element.tagName.toLowerCase()
  const children = inlineChildren(element)

  switch (tag) {
    case 'p':
      return `${children.trim()}\n\n`
    case 'br':
      return '\n'
    case 'strong':
    case 'b':
      return `**${children.trim()}**`
    case 'em':
    case 'i':
      return `*${children.trim()}*`
    case 'a': {
      const href = element.getAttribute('href')?.trim()
      const label = children.trim() || href || 'link'
      return href ? `[${label}](${href})` : label
    }
    case 'ul':
      return listItems(element, '- ')
    case 'ol':
      return listItems(element, null)
    case 'li': {
      const parent = element.parentElement
      if (parent?.tagName.toLowerCase() === 'ol') {
        const index = Array.from(parent.children).indexOf(element) + 1
        return `${index}. ${children.trim()}\n`
      }
      return `- ${children.trim()}\n`
    }
    case 'div':
    case 'span':
    case 'body':
      return children
    default:
      return children
  }
}

function listItems(list: HTMLElement, marker: string | null): string {
  let result = ''
  let index = 1
  list.querySelectorAll(':scope > li').forEach((item) => {
    const text = inlineChildren(item).trim()
    if (marker === null) {
      result += `${index}. ${text}\n`
      index += 1
    } else {
      result += `${marker}${text}\n`
    }
  })
  return result ? `${result}\n` : ''
}

export type SaveImageFromClipboard = (file: File) => Promise<string | null>

let saveImageHandler: SaveImageFromClipboard | null = null

export function setPasteImageHandler(handler: SaveImageFromClipboard | null): void {
  saveImageHandler = handler
}

function insertAtSelection(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
    userEvent: 'input.paste',
  })
}

async function handleImageFile(view: EditorView, file: File): Promise<boolean> {
  if (!saveImageHandler || !file.type.startsWith('image/')) {
    return false
  }
  const relativePath = await saveImageHandler(file)
  if (!relativePath) return false
  insertAtSelection(view, `![${file.name || 'image'}](${relativePath})`)
  return true
}

export function pasteHandlerExtension(): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const items = event.clipboardData?.items
      if (items) {
        for (const item of items) {
          if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
          const file = item.getAsFile()
          if (!file) continue
          event.preventDefault()
          void handleImageFile(view, file)
          return true
        }
      }

      const html = event.clipboardData?.getData('text/html')
      if (!html?.trim()) {
        return false
      }

      const markdown = htmlToMarkdown(html)
      if (!markdown) {
        return false
      }

      event.preventDefault()
      insertAtSelection(view, markdown)
      return true
    },
    drop(event, view) {
      const files = event.dataTransfer?.files
      if (!files?.length) return false
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        event.preventDefault()
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from
        view.dispatch({ selection: { anchor: pos } })
        void handleImageFile(view, file)
        return true
      }
      return false
    },
  })
}
