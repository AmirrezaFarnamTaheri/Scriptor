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

/** Build a plain-text RFC 5322 envelope and encode it for Gmail send. */
export function buildRfc5322Message(to: string, subject: string, body: string): string {
  const normalizedBody = body.replace(/\r?\n/g, '\r\n')
  const email = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${normalizedBody}\r\n`
  const encoder = new TextEncoder()
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
export function buildGmailMarkdown(msg: GmailMarkdownSource): string {
  return `---
title: ${toYamlScalar(msg.subject || 'Untitled Email')}
from: ${toYamlScalar(msg.from || 'Unknown')}
date: ${toYamlScalar(msg.date || '')}
gmail_id: ${toYamlScalar(msg.id || '')}
thread_id: ${toYamlScalar(msg.threadId || '')}
tags:
  - email
  - gmail
---

# ${msg.subject || 'Untitled Email'}

**From**: ${msg.from}  
**Date**: ${msg.date}  

---

${msg.plainText || msg.snippet}
`
}
