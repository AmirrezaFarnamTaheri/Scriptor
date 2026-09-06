import { useMemo } from 'react'

import type { StatusDockTab } from '../components/StatusDockPanel'
import {
  googleGmailGetMessage,
  googleGmailModifyMessage,
  googleGmailSendMessage,
  googleGmailStartAuth,
  googleGmailTrashMessage,
} from '../bridge/commands/google_gmail'
import { indexerUpdateNote, vaultSaveNote } from '../bridge/commands'
import { buildGmailMarkdown, buildRfc5322Message, gmailImportedNoteTitle } from '../lib/gmailRfc5322'
import { defaultNotePath } from './vault/helpers'

interface PluginCommandRuntimeOptions {
  refreshHealth: () => Promise<void>
  fixVaultLint: () => Promise<unknown>
  exportWithProfile: (profileId: string, dryRun?: boolean) => Promise<void>
  setStatusDockTab: (tab: StatusDockTab) => void
  setHealthDashboardOpen: (open: boolean) => void
  setCanvasOpen: (open: boolean) => void
  setBibliographyOpen: (open: boolean) => void
  setGmailManagerOpen?: (open: boolean) => void
  createNote?: (title?: string, initialMarkdown?: string, options?: { requireMissing?: boolean }) => Promise<string | null>
  showToast?: (message: string) => void
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Gmail command requires a non-empty ${key}`)
  return value.trim()
}

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`Gmail command ${key} must be an array of strings`)
  }
  return value.map((entry) => entry.trim()).filter(Boolean)
}

function inputRequired(openGmailManager: (() => void) | undefined, required: string[]) {
  openGmailManager?.()
  return { status: 'input-required' as const, required }
}

export function usePluginCommandRuntime(options: PluginCommandRuntimeOptions) {
  const {
    refreshHealth,
    fixVaultLint,
    exportWithProfile,
    setStatusDockTab,
    setHealthDashboardOpen,
    setCanvasOpen,
    setBibliographyOpen,
    setGmailManagerOpen,
    createNote,
    showToast,
  } = options
  const openGmailManager = setGmailManagerOpen ? () => setGmailManagerOpen(true) : undefined

  return useMemo(() => ({
    refreshHealth: () => refreshHealth(),
    fixVaultLint: () => fixVaultLint(),
    exportWithProfile,
    setStatusDockTab,
    setHealthDashboardOpen,
    openCanvas: () => setCanvasOpen(true),
    openBibliography: () => setBibliographyOpen(true),
    openGmailManager,
    gmailConnect: async (input: unknown) => {
      const record = asRecord(input)
      const clientId = optionalString(record, 'clientId')
      if (!clientId) return inputRequired(openGmailManager, ['clientId'])
      const result = await googleGmailStartAuth(clientId)
      return { status: 'connected', result }
    },
    gmailImport: async (input: unknown) => {
      const record = asRecord(input)
      const messageId = optionalString(record, 'messageId')
      if (!messageId) return inputRequired(openGmailManager, ['messageId'])
      const message = await googleGmailGetMessage(messageId)
      const title = gmailImportedNoteTitle(message.subject, message.id)
      const markdown = buildGmailMarkdown(message)
      let path: string | null = null

      if (createNote) {
        path = await createNote(title, markdown, { requireMissing: true })
      } else {
        path = `Email/${defaultNotePath(title)}`
        await vaultSaveNote(path, markdown, '<missing>')
        await indexerUpdateNote(path)
      }

      if (!path) throw new Error(`Could not import Gmail message ${messageId}; target note already exists or could not be saved`)
      showToast?.(`Imported Gmail message to ${path}`)
      return { status: 'imported', messageId, path }
    },
    gmailModify: async (input: unknown) => {
      const record = asRecord(input)
      const messageId = optionalString(record, 'messageId')
      if (!messageId) return inputRequired(openGmailManager, ['messageId', 'action'])
      const action = typeof record.action === 'string' ? record.action : 'labels'
      switch (action) {
        case 'archive':
          await googleGmailModifyMessage(messageId, [], ['INBOX'])
          break
        case 'mark-read':
          await googleGmailModifyMessage(messageId, [], ['UNREAD'])
          break
        case 'mark-unread':
          await googleGmailModifyMessage(messageId, ['UNREAD'], [])
          break
        case 'trash':
          await googleGmailTrashMessage(messageId)
          break
        case 'labels':
          await googleGmailModifyMessage(
            messageId,
            stringArray(record, 'addLabelIds'),
            stringArray(record, 'removeLabelIds'),
          )
          break
        default:
          throw new Error(`Unsupported Gmail modify action: ${action}`)
      }
      return { status: 'modified', messageId, action }
    },
    gmailSend: async (input: unknown) => {
      const record = asRecord(input)
      const rawMessage = optionalString(record, 'rawMessage')
      if (!rawMessage && (!optionalString(record, 'to') || !optionalString(record, 'subject') || !optionalString(record, 'body'))) {
        return inputRequired(openGmailManager, ['to', 'subject', 'body'])
      }
      const raw = rawMessage ?? buildRfc5322Message(
        requiredString(record, 'to'),
        requiredString(record, 'subject'),
        requiredString(record, 'body'),
      )
      await googleGmailSendMessage(raw)
      return { status: 'sent' }
    },
    showToast,
  }), [
    createNote,
    exportWithProfile,
    fixVaultLint,
    openGmailManager,
    refreshHealth,
    setBibliographyOpen,
    setCanvasOpen,
    setHealthDashboardOpen,
    setStatusDockTab,
    showToast,
  ])
}
