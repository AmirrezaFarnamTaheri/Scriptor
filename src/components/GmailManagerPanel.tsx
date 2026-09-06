import { useCallback, useEffect, useState } from 'react'
import {
  Archive,
  CheckCircle,
  FileDown,
  Inbox,
  Key,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from 'lucide-react'

import {
  googleGmailDisconnect,
  googleGmailGetMessage,
  googleGmailListMessages,
  googleGmailModifyMessage,
  googleGmailSendMessage,
  googleGmailStartAuth,
  googleGmailTrashMessage,
  type GmailMessageContent,
  type GmailMessagePreview,
} from '../bridge/commands/google_gmail.ts'
import { isNativeBridgeAvailable } from '../bridge/platform.ts'
import { buildRfc5322Message } from '../lib/gmailRfc5322.ts'
import { UnifiedPanelShell, type PanelTab } from './chrome/UnifiedPanelShell.tsx'
import type { PanelPresentation } from '../hooks/usePanelPresentation.ts'

export interface GmailManagerPanelProps {
  onClose: () => void
  onImportNote?: (subject: string, markdown: string) => Promise<void>
  presentation?: PanelPresentation
}

type GmailTab = 'messages' | 'compose' | 'account'

const TABS: PanelTab[] = [
  { id: 'messages', label: 'Messages' },
  { id: 'compose', label: 'Compose' },
  { id: 'account', label: 'Account' },
]

export function GmailManagerPanel({
  onClose,
  onImportNote,
  presentation = 'modal',
}: GmailManagerPanelProps) {
  const [activeTab, setActiveTab] = useState<GmailTab>('messages')
  const [clientId, setClientId] = useState('')
  const [isAuthed, setIsAuthed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [messages, setMessages] = useState<GmailMessagePreview[]>([])
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingContent, setLoadingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusText, setStatusText] = useState<string | null>(null)

  // Compose tab state
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [sending, setSending] = useState(false)

  const nativeReady = isNativeBridgeAvailable()

  const handleRefreshMessages = useCallback(
    async (queryOverride?: string) => {
      if (!nativeReady) return
      setLoading(true)
      setError(null)
      try {
        const query = queryOverride !== undefined ? queryOverride : searchQuery
        const items = await googleGmailListMessages(query, 25)
        setMessages(items)
        setIsAuthed(true)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('not authenticated') || msg.includes('no token')) {
          setIsAuthed(false)
        } else {
          setError(msg)
        }
      } finally {
        setLoading(false)
      }
    },
    [nativeReady, searchQuery],
  )

  useEffect(() => {
    if (!nativeReady) return
    let cancelled = false

    void (async () => {
      try {
        const items = await googleGmailListMessages('', 25)
        if (cancelled) return
        setMessages(items)
        setIsAuthed(true)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('not authenticated') || msg.includes('no token')) {
          setIsAuthed(false)
        } else {
          setError(msg)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [nativeReady])

  const handleStartAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId.trim() || !nativeReady) return
    setLoading(true)
    setError(null)
    setStatusText('Opening browser for Google OAuth PKCE authorization...')
    try {
      await googleGmailStartAuth(clientId.trim())
      setIsAuthed(true)
      setStatusText('Authentication successful!')
      setActiveTab('messages')
      void handleRefreshMessages()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatusText(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!nativeReady) return
    setLoading(true)
    try {
      await googleGmailDisconnect()
      setIsAuthed(false)
      setMessages([])
      setSelectedMessage(null)
      setStatusText('Disconnected from Gmail.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSelectMessage = async (preview: GmailMessagePreview) => {
    if (!nativeReady) return
    setLoadingContent(true)
    setError(null)
    try {
      const full = await googleGmailGetMessage(preview.id)
      setSelectedMessage(full)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingContent(false)
    }
  }

  const handleImportToMarkdown = async (msg: GmailMessageContent) => {
    if (!onImportNote) return
    setLoading(true)
    try {
      const safeTitle = (msg.subject || 'Untitled Email').replace(/"/g, '\\"')
      const safeFrom = (msg.from || 'Unknown').replace(/"/g, '\\"')
      const markdown = `---
title: "${safeTitle}"
from: "${safeFrom}"
date: "${msg.date}"
gmail_id: "${msg.id}"
thread_id: "${msg.threadId}"
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
      await onImportNote(msg.subject || 'Email', markdown)
      setStatusText(`Imported "${msg.subject || 'Email'}" to vault.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async (id: string) => {
    if (!nativeReady) return
    setLoading(true)
    try {
      await googleGmailModifyMessage(id, [], ['INBOX', 'UNREAD'])
      setMessages((prev) => prev.filter((m) => m.id !== id))
      if (selectedMessage?.id === id) {
        setSelectedMessage(null)
      }
      setStatusText('Archived message.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleTrash = async (id: string) => {
    if (!nativeReady) return
    setLoading(true)
    try {
      await googleGmailTrashMessage(id)
      setMessages((prev) => prev.filter((m) => m.id !== id))
      if (selectedMessage?.id === id) {
        setSelectedMessage(null)
      }
      setStatusText('Moved message to trash.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!composeTo.trim() || !composeSubject.trim() || !nativeReady) return
    setSending(true)
    setError(null)
    setStatusText(null)
    try {
      const raw = buildRfc5322Message(composeTo.trim(), composeSubject.trim(), composeBody)
      await googleGmailSendMessage(raw)
      setComposeTo('')
      setComposeSubject('')
      setComposeBody('')
      setStatusText('Email sent successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <UnifiedPanelShell
      title="Gmail Manager"
      subtitle="Connected Gmail mailbox integration & Markdown vault archiving"
      icon={<Mail size={18} />}
      ariaLabel="Gmail Manager panel"
      onClose={onClose}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId as GmailTab)}
      className="gmail-manager-panel"
      wide
      presentation={presentation}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', minHeight: 0 }}>
        {statusText && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--color-success-bg, rgba(16, 185, 129, 0.1))',
              color: 'var(--color-success, #10b981)',
              borderRadius: '6px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle size={16} />
            <span>{statusText}</span>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--color-error-bg, rgba(239, 68, 68, 0.1))',
              color: 'var(--color-error, #ef4444)',
              borderRadius: '6px',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Tab 1: Messages */}
        {activeTab === 'messages' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleRefreshMessages()
                  }}
                  placeholder="Search Gmail (e.g. is:unread, from:colleague)..."
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 32px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                  }}
                />
                <Search size={16} style={{ position: 'absolute', left: 10, top: 9, opacity: 0.5 }} />
              </div>
              <button
                type="button"
                className="toolbar-button"
                onClick={() => void handleRefreshMessages()}
                disabled={loading}
                title="Search / Refresh"
              >
                <RefreshCw size={14} className={loading ? 'spinning' : ''} />
              </button>
            </div>

            {!isAuthed && (
              <div className="empty-state" style={{ padding: '24px', textAlign: 'center' }}>
                <Key size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <h3>Gmail Not Connected</h3>
                <p style={{ margin: '6px 0 14px', color: 'var(--ink-muted)' }}>
                  Connect your Google account in the Account tab to read, import, and send emails.
                </p>
                <button type="button" className="action-button" onClick={() => setActiveTab('account')}>
                  Connect Gmail Account
                </button>
              </div>
            )}

            {isAuthed && (
              <div style={{ display: 'grid', gridTemplateColumns: selectedMessage ? '1fr 1fr' : '1fr', gap: '12px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {/* Messages List */}
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    overflowY: 'auto',
                    padding: '4px',
                    background: 'var(--surface)',
                  }}
                >
                  {messages.length === 0 && !loading && (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-muted)' }}>
                      <Inbox size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <p>No messages found.</p>
                    </div>
                  )}

                  {messages.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void handleSelectMessage(item)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: selectedMessage?.id === item.id ? 'var(--surface-raised)' : 'transparent',
                        color: 'var(--ink)',
                        cursor: 'pointer',
                        marginBottom: '4px',
                        borderLeft: selectedMessage?.id === item.id ? '3px solid var(--color-primary, #0f766e)' : '3px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '2px' }}>
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.from}</strong>
                        <span style={{ fontSize: '0.75rem', opacity: 0.6, flexShrink: 0 }}>{item.date}</span>
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.subject || '(No Subject)'}
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.snippet}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Message Content Viewer */}
                {selectedMessage && (
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      background: 'var(--surface)',
                    }}
                  >
                    <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{selectedMessage.subject || '(No Subject)'}</h3>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {onImportNote && (
                            <button
                              type="button"
                              className="action-button"
                              onClick={() => void handleImportToMarkdown(selectedMessage)}
                              title="Save into current Markdown vault"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '4px 8px' }}
                            >
                              <FileDown size={14} />
                              <span>Import</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="toolbar-button"
                            onClick={() => void handleArchive(selectedMessage.id)}
                            title="Archive message"
                          >
                            <Archive size={14} />
                          </button>
                          <button
                            type="button"
                            className="toolbar-button"
                            onClick={() => void handleTrash(selectedMessage.id)}
                            title="Move to trash"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
                        <div><strong>From:</strong> {selectedMessage.from}</div>
                        <div><strong>Date:</strong> {selectedMessage.date}</div>
                      </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: 1.5 }}>
                      {loadingContent ? (
                        <div style={{ textAlign: 'center', padding: '24px', opacity: 0.6 }}>Loading full message...</div>
                      ) : (
                        selectedMessage.plainText || selectedMessage.snippet
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Compose */}
        {activeTab === 'compose' && (
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            <label className="settings-field">
              Recipient (To)
              <input
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="recipient@example.com"
                required
                disabled={sending}
              />
            </label>
            <label className="settings-field">
              Subject
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject line"
                required
                disabled={sending}
              />
            </label>
            <label className="settings-field" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              Message Body (Plain Text)
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Type your message here..."
                required
                disabled={sending}
                style={{
                  flex: 1,
                  minHeight: '180px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                  padding: '8px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="submit"
                className="action-button"
                disabled={sending || !composeTo.trim() || !composeSubject.trim() || !isAuthed}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={14} />
                <span>{sending ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Account */}
        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '540px' }}>
            <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)' }}>
              <h4 style={{ margin: '0 0 8px' }}>OAuth Connection Status</h4>
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--ink-muted)' }}>
                {isAuthed ? 'Gmail account is connected via OS keychain credentials.' : 'Not connected to Gmail.'}
              </p>
              {isAuthed ? (
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => void handleDisconnect()}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-error)' }}
                >
                  <LogOut size={14} />
                  <span>Disconnect Account</span>
                </button>
              ) : (
                <form onSubmit={handleStartAuth} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label className="settings-field">
                    Google OAuth Client ID
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="e.g. 1234567890-abc.apps.googleusercontent.com"
                      required
                    />
                  </label>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                    Scriptor uses PKCE OAuth flow with system browser authorization. Tokens are stored securely in your OS keychain.
                  </p>
                  <div>
                    <button type="submit" className="action-button" disabled={loading || !clientId.trim()}>
                      {loading ? 'Starting Auth...' : 'Connect with Google'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </UnifiedPanelShell>
  )
}
