import { visit } from 'unist-util-visit'

const ALERT_PATTERN = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|AI|INFO|SUCCESS|DANGER|QUESTION|BUG|EXAMPLE|QUOTE)\]/i

const ALERT_CLASS: Record<string, string> = {
  note: 'alert-note',
  tip: 'alert-tip',
  important: 'alert-important',
  warning: 'alert-warning',
  caution: 'alert-caution',
  ai: 'alert-ai',
  info: 'alert-info',
  success: 'alert-success',
  danger: 'alert-danger',
  question: 'alert-question',
  bug: 'alert-bug',
  example: 'alert-example',
  quote: 'alert-quote',
}

type MdNode = {
  type?: string
  value?: string
  children?: MdNode[]
  data?: Record<string, unknown>
}

/** GitHub / md-main style alert blocks: `> [!note] Title` */
export function remarkAlerts() {
  return (tree: MdNode) => {
    visit(tree as never, 'blockquote', (node: MdNode, index, parent: MdNode | undefined) => {
      if (!parent || index === undefined || !Array.isArray(node.children) || node.children.length === 0) {
        return
      }
      const first = node.children[0]
      if (first.type !== 'paragraph' || !Array.isArray(first.children) || first.children.length === 0) {
        return
      }
      const lead = first.children[0]
      if (lead.type !== 'text' || typeof lead.value !== 'string') return
      const match = lead.value.match(ALERT_PATTERN)
      if (!match) return

      const kind = match[1].toLowerCase()
      const className = ALERT_CLASS[kind] ?? 'alert-note'
      const remainder = lead.value.slice(match[0].length).trim()
      lead.value = remainder.length > 0 ? remainder : kind.toUpperCase()

      node.data = {
        ...(node.data ?? {}),
        hName: 'aside',
        hProperties: {
          className: ['markdown-alert', className],
          role: 'note',
          'data-alert-kind': kind,
        },
      }
    })
  }
}
