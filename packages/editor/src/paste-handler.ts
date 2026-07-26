import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

const TEXT_NODE = 3
const ELEMENT_NODE = 1

const SAFE_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:'])

/**
 * Accepts http/https/mailto plus scheme-relative, relative and anchor URLs.
 * Everything else (javascript:, data:, vbscript:, …) is dropped so pasting from
 * a hostile page cannot smuggle an executable link into the note.
 */
function sanitizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Control characters are stripped: they are otherwise used to hide a scheme
  // (for example "java\nscript:") from a naive prefix check.
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (!cleaned) return null

  const probe = cleaned.replace(/\s+/g, '')
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(probe)
  if (schemeMatch) {
    if (!SAFE_URL_SCHEMES.has(`${schemeMatch[1].toLowerCase()}:`)) {
      return null
    }
  }
  return cleaned
}

/** Percent-encodes characters that would terminate or break a markdown link target. */
function encodeLinkTarget(url: string): string {
  // encodeURIComponent leaves "(" and ")" untouched, so map explicitly.
  return url.replace(/[()<>\s\\]/g, (char) => {
    const code = char.charCodeAt(0)
    return `%${code.toString(16).toUpperCase().padStart(2, '0')}`
  })
}

function markdownLink(rawHref: string | null | undefined, label: string, fallbackLabel = 'link'): string {
  const href = sanitizeUrl(rawHref)
  const text = label.trim()
  if (!href) {
    return text || fallbackLabel
  }
  return `[${text || href}](${encodeLinkTarget(href)})`
}

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
    .replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href: string, label: string) =>
      markdownLink(href, label.replace(/<[^>]+>/g, '')),
    )
    .replace(/<li\s*[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<\/?(ul|ol)\s*[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function inlineChildren(node: Node, depth: number): string {
  let result = ''
  Array.from(node.childNodes).forEach((child) => {
    result += nodeToMarkdown(child, depth)
  })
  return result
}

export function htmlToMarkdown(html: string): string {
  const body = parseHtmlBody(html)
  if (!body) {
    return htmlToMarkdownFallback(html)
  }
  return nodeToMarkdown(body, 0).replace(/\n{3,}/g, '\n\n').trim()
}

function tagNameOf(node: Node): string {
  if (node.nodeType !== ELEMENT_NODE) return ''
  return (node as HTMLElement).tagName.toLowerCase()
}

/** Exported for validation tests: converts a parsed DOM node to markdown. */
export function nodeToMarkdown(node: Node, depth = 0): string {
  if (node.nodeType === TEXT_NODE) {
    return node.textContent ?? ''
  }
  if (node.nodeType !== ELEMENT_NODE) {
    return ''
  }

  const element = node as HTMLElement
  const tag = element.tagName.toLowerCase()

  switch (tag) {
    case 'ul':
      return listItems(element, false, depth)
    case 'ol':
      return listItems(element, true, depth)
    case 'br':
      return '\n'
    default:
      break
  }

  const children = inlineChildren(element, depth)

  switch (tag) {
    case 'p':
      return `${children.trim()}\n\n`
    case 'strong':
    case 'b':
      return `**${children.trim()}**`
    case 'em':
    case 'i':
      return `*${children.trim()}*`
    case 'a':
      return markdownLink(element.getAttribute('href'), children)
    case 'li': {
      const parent = element.parentElement
      const indent = '  '.repeat(depth)
      if (parent && parent.tagName.toLowerCase() === 'ol') {
        const index = Array.from(parent.children).indexOf(element) + 1
        return `${indent}${index}. ${children.trim()}\n`
      }
      return `${indent}- ${children.trim()}\n`
    }
    case 'div':
    case 'span':
    case 'body':
      return children
    default:
      return children
  }
}

/**
 * Renders the direct `li` children of a list. Nested lists are recursed at
 * `depth + 1` so their markers stay indented instead of flattening into the
 * parent list.
 */
function listItems(list: HTMLElement, ordered: boolean, depth: number): string {
  const indent = '  '.repeat(depth)
  let result = ''
  let index = 1

  Array.from(list.children).forEach((child) => {
    if (tagNameOf(child) !== 'li') return
    let inline = ''
    let nested = ''
    Array.from(child.childNodes).forEach((grandChild) => {
      const childTag = tagNameOf(grandChild)
      if (childTag === 'ul' || childTag === 'ol') {
        nested += nodeToMarkdown(grandChild, depth + 1)
      } else {
        inline += nodeToMarkdown(grandChild, depth)
      }
    })
    const marker = ordered ? `${index}. ` : '- '
    index += 1
    result += `${indent}${marker}${inline.trim()}\n${nested}`
  })

  if (!result) return ''
  return depth === 0 ? `${result}\n` : result
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
        // DataTransferItemList is array-like but not iterable per spec.
        for (const item of Array.from(items)) {
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
      // FileList is array-like but not iterable per spec.
      for (const file of Array.from(files)) {
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
