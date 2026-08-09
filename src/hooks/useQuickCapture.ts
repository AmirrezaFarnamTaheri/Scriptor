/**
 * useQuickCapture
 * ---------------
 * Implements the "Field Notes / Quick Capture" feature (10.8).
 *
 * Appends a timestamped entry to a configurable inbox note. The inbox note
 * path defaults to `inbox/inbox.md` relative to the vault root.
 *
 * Usage:
 *  ```tsx
 *  const { capture, isPending, lastError, lastCapturedAt } =
 *    useQuickCapture({ inboxPath: 'inbox/inbox.md', readNote, saveNote })
 *
 *  // On submit:
 *  await capture('My quick thought')
 *  ```
 *
 * The entry format is:
 *  ```markdown
 *  - 2026-08-09T15:04:00 My quick thought
 *  ```
 * appended at the bottom of the inbox note. The note is created if it does
 * not yet exist, with a `# Inbox` heading.
 */

import { useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuickCaptureConfig {
  /** Vault-relative path of the inbox note. Default: `inbox/inbox.md`. */
  inboxPath?: string
  /** Bridge delegate for reading a note's content. */
  readNote: (path: string) => Promise<{ content: string }>
  /** Bridge delegate for writing a note's content. */
  saveNote: (path: string, content: string) => Promise<void>
  /** Optional prefix tag to add to each entry. */
  tag?: string
}

export interface QuickCaptureResult {
  /** Append a text entry to the inbox note. */
  capture: (text: string) => Promise<void>
  isPending: boolean
  lastError?: string
  /** ISO string of the last successful capture. */
  lastCapturedAt?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_INBOX_PATH = 'inbox/inbox.md'
const INITIAL_CONTENT = '# Inbox\n\n'

function buildEntry(text: string, tag?: string): string {
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const tagStr = tag ? ` #${tag}` : ''
  return `- ${ts}${tagStr} ${text.trim()}`
}

function appendToContent(existing: string, entry: string): string {
  const trimmed = existing.trimEnd()
  return trimmed ? `${trimmed}\n${entry}\n` : `${INITIAL_CONTENT}${entry}\n`
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQuickCapture({
  inboxPath = DEFAULT_INBOX_PATH,
  readNote,
  saveNote,
  tag,
}: QuickCaptureConfig): QuickCaptureResult {
  const [isPending, setIsPending] = useState(false)
  const [lastError, setLastError] = useState<string | undefined>()
  const [lastCapturedAt, setLastCapturedAt] = useState<string | undefined>()

  const capture = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      setIsPending(true)
      setLastError(undefined)
      try {
        let existing = INITIAL_CONTENT
        try {
          const doc = await readNote(inboxPath)
          existing = doc.content
        } catch {
          // Note doesn't exist yet — we'll create it with the initial content.
        }

        const entry = buildEntry(trimmed, tag)
        const updated = appendToContent(existing, entry)
        await saveNote(inboxPath, updated)
        setLastCapturedAt(new Date().toISOString())
      } catch (err) {
        setLastError(err instanceof Error ? err.message : 'Failed to save capture.')
      } finally {
        setIsPending(false)
      }
    },
    [inboxPath, readNote, saveNote, tag],
  )

  return { capture, isPending, lastError, lastCapturedAt }
}
