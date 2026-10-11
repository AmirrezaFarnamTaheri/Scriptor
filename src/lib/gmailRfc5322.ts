/**
 * Helpers for formatting Gmail messages and Markdown imports.
 */

export interface GmailMarkdownSource {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  plainText: string
}

/** Encode bytes as unpadded URL-safe base64 for Gmail's raw message API. */
export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function assertSingleLineHeader(label: string, value: string): void {
  if (/[\r\n]/.test(value)) {
    throw new Error(`Gmail ${label} must not contain a line break`)
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new Error(`Gmail ${label} must not contain control characters`)
  }
}

/** RFC 2047 encoded words, folded only between complete UTF-8 characters. */
function encodeSubject(subject: string): string {
  if (/^[\x20-\x7e]*$/.test(subject) && subject.length <= 900) return subject
  const encoder = new TextEncoder()
  const words: string[] = []
  const encodedWord = (value: string) => {
    const bytes = encoder.encode(value)
    const base64 = encodeBase64Url(bytes).replace(/-/g, '+').replace(/_/g, '/')
      .padEnd(Math.ceil(bytes.byteLength / 3) * 4, '=')
    return `=?UTF-8?B?${base64}?=`
  }
  let chunk = ''
  let bytes = 0
  for (const character of subject) {
    const size = encoder.encode(character).byteLength
    if (bytes + size > 42) {
      words.push(encodedWord(chunk))
      chunk = ''
      bytes = 0
    }
    chunk += character
    bytes += size
  }
  if (chunk) words.push(encodedWord(chunk))
  return words.join('\r\n ')
}

/** Build a plain-text RFC 5322 envelope and encode it for Gmail send. */
export function buildRfc5322Message(to: string, subject: string, body: string): string {
  assertSingleLineHeader('recipient', to)
  assertSingleLineHeader('subject', subject)
  if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) || to.length > 320) {
    throw new Error('Gmail recipient must be one email address')
  }
  if (!subject.trim() || subject.length > 1024) throw new Error('Gmail subject must contain 1–1024 characters')
  const normalizedBody = body.replace(/\r\n|\r|\n/g, '\r\n')
  const encoder = new TextEncoder()
  const longLine = normalizedBody.split('\r\n').some(line => encoder.encode(line).byteLength > 998)
  const bytes = longLine ? encoder.encode(normalizedBody) : null
  const transferBody = bytes ? encodeBase64Url(bytes).replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(Math.ceil(bytes.byteLength / 3) * 4, '=').match(/.{1,76}/g)!.join('\r\n') : normalizedBody
  const email = `To: ${to}\r\nSubject: ${encodeSubject(subject)}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: ${longLine ? 'base64' : '8bit'}\r\n\r\n${transferBody}\r\n`
  return encodeBase64Url(encoder.encode(email))
}

/** Safely encodes a scalar value as a YAML double-quoted flow scalar. */
export function toYamlScalar(value: unknown): string {
  return JSON.stringify(String(value ?? ''))
}

/** Produce a deterministic note title keyed by the immutable Gmail message ID. */
export function gmailImportedNoteTitle(subject: string, messageId: string): string {
  const base = subject.trim() || 'Untitled Email'
  return `${base} -- gmail-${messageId}`
}

/** Render a Gmail message as Markdown with YAML-safe front matter. */
export function buildGmailMarkdown(msg: GmailMarkdownSource, labels = { untitled: 'Untitled Email', unknown: 'Unknown', from: 'From', date: 'Date' }): string {
  const literal = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}[\]()#+.!|~-])/g, '\\$1')
  const subject = msg.subject || labels.untitled
  return `---
title: ${toYamlScalar(subject)}
from: ${toYamlScalar(msg.from || labels.unknown)}
date: ${toYamlScalar(msg.date || '')}
gmail_id: ${toYamlScalar(msg.id || '')}
thread_id: ${toYamlScalar(msg.threadId || '')}
tags:
  - email
  - gmail
---

# ${literal(subject.replace(/[\r\n]+/g, ' '))}

**${labels.from}**: ${literal(msg.from)}

**${labels.date}**: ${literal(msg.date)}

---

${literal(msg.plainText || msg.snippet)}
`
}
