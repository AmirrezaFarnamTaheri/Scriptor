import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'

import { createSlugger } from './remark-toc.ts'

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

function collectText(node: Element): string {
  let text = ''
  visit(node, 'text', (child: { value?: string }) => {
    if (typeof child.value === 'string') text += child.value
  })
  return text
}

/**
 * Local stand-in for rehype-slug: adds `id` attributes to headings using the
 * same slugify/de-duplication as {@link createSlugger}, so `[TOC]` anchors
 * emitted by remark-toc resolve to real heading ids.
 */
export function rehypeHeadingIds() {
  return (tree: Root) => {
    const slugger = createSlugger()
    visit(tree, 'element', (node: Element) => {
      if (!HEADING_TAGS.has(node.tagName)) return
      const text = collectText(node).trim()
      if (text.length === 0) return
      const id = slugger(text)
      node.properties = { ...node.properties }
      if (node.properties.id == null) {
        node.properties.id = id
      }
    })
  }
}
