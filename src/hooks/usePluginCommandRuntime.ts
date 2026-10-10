import { useEffect, useMemo, useRef } from 'react'

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
  vaultId?: string | null
  refreshHealth: () => Promise<void>
  fixVaultLint: () => Promise<unknown>
  exportWithProfile: (profileId: string, dryRun?: boolean) => Promise<void>
  setStatusDockTab: (tab: StatusDockTab) => void
  setHealthDashboardOpen: (open: boolean) => void
  setCanvasOpen: (open: boolean) => void
  setBibliographyOpen: (open: boolean) => void
  setGmailManagerOpen?: (open: boolean) => void
  createNote?: (title?: string, initialMarkdown?: string, options?: { requireMissing?: boolean; isCurrent?: () => boolean }) => Promise<string | null>
  showToast?: (message: string) => void
}

/** Normalize arbitrary command input into a plain record. */
function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}
}

/** Read and trim a required non-empty string field. */
function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Gmail command requires a non-empty ${key}`)
  return value.trim()
}

/** Read and trim an optional string field. */
function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Read a validated array of non-empty string values. */
function stringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`Gmail command ${key} must be an array of strings`)
  }
  return value.map((entry) => entry.trim()).filter(Boolean)
}

/** Open the interactive Gmail surface and report fields a structured caller must provide. */
function inputRequired(openGmailManager: (() => void) | undefined, required: string[]) {
  openGmailManager?.()
  return { status: 'input-required' as const, required }
}

/** Build the memoized runtime handlers used by plugin commands and MCP dispatch. */
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
    vaultId,
  } = options
  const currentVaultId = useRef(vaultId)
  const gmailGeneration = useRef(0)
  const mounted = useRef(true)
  useEffect(() => { currentVaultId.current = vaultId }, [vaultId])
  useEffect(() => {
    mounted.current = true
    const accountChanged = (event: Event) => {
      if ((event as CustomEvent<{ service?: string }>).detail?.service === 'gmail') gmailGeneration.current += 1
    }
    window.addEventListener('scriptor:google-account-changed', accountChanged)
    return () => {
      mounted.current = false
      gmailGeneration.current += 1
      window.removeEventListener('scriptor:google-account-changed', accountChanged)
    }
  }, [])
  return useMemo(() => {
    const openGmailManager = setGmailManagerOpen ? () => setGmailManagerOpen(true) : undefined

    return {
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
        window.dispatchEvent(new CustomEvent('scriptor:google-account-changed', { detail: { service: 'gmail', origin: 'plugin' } }))
        return { status: 'connected', result }
      },
      gmailImport: async (input: unknown) => {
        const record = asRecord(input)
        const messageId = optionalString(record, 'messageId')
        if (!messageId) return inputRequired(openGmailManager, ['messageId'])
        const originatingVaultId = currentVaultId.current
        if (!originatingVaultId) throw new Error('Open a vault before importing Gmail messages.')
        const accountGeneration = gmailGeneration.current
        const isCurrent = () => mounted.current && currentVaultId.current === originatingVaultId && gmailGeneration.current === accountGeneration
        const message = await googleGmailGetMessage(messageId)
        if (currentVaultId.current !== originatingVaultId) throw new Error('Vault changed; review this Gmail import again.')
        if (!isCurrent()) throw new Error('Gmail account changed; review this import again.')
        const title = gmailImportedNoteTitle(message.subject, message.id)
        const markdown = buildGmailMarkdown(message)
        let path: string | null

        if (createNote) {
          path = await createNote(title, markdown, { requireMissing: true, isCurrent })
        } else {
          path = `Email/${defaultNotePath(title)}`
          await vaultSaveNote(path, markdown, '<missing>', false, originatingVaultId)
          if (!isCurrent()) return { status: 'saved-in-originating-vault', messageId, path }
          await indexerUpdateNote(path)
        }

        if (!path) throw new Error(`Could not import Gmail message ${messageId}; target note already exists or could not be saved`)
        if (!isCurrent()) return { status: 'saved-in-originating-vault', messageId, path }
        showToast?.(`Imported Gmail message to ${path}`)
        return { status: 'imported', messageId, path }
      },
      gmailModify: async (input: unknown) => {
        const record = asRecord(input)
        const messageId = optionalString(record, 'messageId')
        const action = optionalString(record, 'action')
        if (!messageId || !action) {
          const missing = [
            ...(!messageId ? ['messageId'] : []),
            ...(!action ? ['action'] : []),
          ]
          return inputRequired(openGmailManager, missing)
        }
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
          case 'labels': {
            const addLabelIds = stringArray(record, 'addLabelIds')
            const removeLabelIds = stringArray(record, 'removeLabelIds')
            if (addLabelIds.length === 0 && removeLabelIds.length === 0) {
              throw new Error('Gmail labels action requires addLabelIds or removeLabelIds')
            }
            await googleGmailModifyMessage(messageId, addLabelIds, removeLabelIds)
            break
          }
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
    }
  }, [
    createNote,
    exportWithProfile,
    fixVaultLint,
    setGmailManagerOpen,
    refreshHealth,
    setBibliographyOpen,
    setCanvasOpen,
    setHealthDashboardOpen,
    setStatusDockTab,
    showToast,
  ])
}
