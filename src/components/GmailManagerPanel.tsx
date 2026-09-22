import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  googleGmailGetAuthedEmail,
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
import { buildRfc5322Message, toYamlScalar } from '../lib/gmailRfc5322.ts'
import { googleAuthErrorMessage, isGoogleAuthRequiredError } from '../lib/googleAuthErrors.ts'
import { useI18n } from '../lib/i18n/index.ts'
import { UnifiedPanelShell, type PanelTab } from './chrome/UnifiedPanelShell.tsx'
import type { PanelPresentation } from '../hooks/usePanelPresentation.ts'

export interface GmailManagerPanelProps {
  onClose: () => void
  onImportNote?: (subject: string, markdown: string, messageId: string) => Promise<void>
  presentation?: PanelPresentation
  defaultClientId?: string
}

type GmailTab = 'messages' | 'compose' | 'account'

function effectiveGmailQuery(query: string): string {
  return query.trim()
}

function formatGmailDate(raw: string): string {
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleString()
}

export function GmailManagerPanel({
  onClose,
  onImportNote,
  presentation = 'modal',
  defaultClientId = '',
}: GmailManagerPanelProps) {
  const { t } = useI18n()
  const nativeReady = isNativeBridgeAvailable()
  const [activeTab, setActiveTab] = useState<GmailTab>('messages')
  const [clientIdOverride, setClientIdOverride] = useState<string | null>(null)
  const clientId = clientIdOverride ?? defaultClientId
  const [isAuthed, setIsAuthed] = useState(false)
  const [accountEmail, setAccountEmail] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(nativeReady)
  const [searchQuery, setSearchQuery] = useState('')
  const [messages, setMessages] = useState<GmailMessagePreview[]>([])
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingContent, setLoadingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusText, setStatusText] = useState<string | null>(null)
  const refreshSequence = useRef(0)
  const selectionSequence = useRef(0)

  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [sending, setSending] = useState(false)

  const tabs = useMemo<PanelTab[]>(() => [
    { id: 'messages', label: t('integrations.gmail.tabs.messages') },
    { id: 'compose', label: t('integrations.gmail.tabs.compose') },
    { id: 'account', label: t('integrations.gmail.tabs.account') },
  ], [t])

  const loadMessages = useCallback(
    async (query: string) => {
      if (!nativeReady) return
      const sequence = ++refreshSequence.current
      setRefreshing(true)
      setError(null)
      try {
        const items = await googleGmailListMessages(effectiveGmailQuery(query), 25)
        if (sequence !== refreshSequence.current) return
        setMessages(items)
        setIsAuthed(true)
      } catch (err) {
        if (sequence !== refreshSequence.current) return
        if (isGoogleAuthRequiredError(err)) {
          setIsAuthed(false)
          setAccountEmail(null)
        } else {
          setError(googleAuthErrorMessage(err))
        }
      } finally {
        if (sequence === refreshSequence.current) setRefreshing(false)
      }
    },
    [nativeReady],
  )

  const handleRefreshMessages = useCallback(
    async (queryOverride?: string) => {
      await loadMessages(queryOverride !== undefined ? queryOverride : searchQuery)
    },
    [loadMessages, searchQuery],
  )

  useEffect(() => {
    if (!nativeReady) return
    let cancelled = false

    void (async () => {
      try {
        const email = await googleGmailGetAuthedEmail()
        if (cancelled) return
        setAccountEmail(email)
        setIsAuthed(true)
        await loadMessages('in:inbox')
      } catch (err) {
        if (cancelled) return
        if (isGoogleAuthRequiredError(err)) {
          setIsAuthed(false)
          setAccountEmail(null)
        } else {
          setError(googleAuthErrorMessage(err))
        }
      } finally {
        if (!cancelled) setCheckingAuth(false)
      }
    })()

    return () => {
      cancelled = true
      refreshSequence.current += 1
      selectionSequence.current += 1
    }
  }, [loadMessages, nativeReady])

  const handleStartAuth = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!clientId.trim() || !nativeReady) return
    setLoading(true)
    setError(null)
    setStatusText(t('integrations.gmail.status.openingBrowser'))
    try {
      const email = await googleGmailStartAuth(clientId.trim())
      setIsAuthed(true)
      setAccountEmail(email)
      setStatusText(t('integrations.gmail.status.connectedAs', { email }))
      setActiveTab('messages')
      await handleRefreshMessages()
    } catch (err) {
      setError(googleAuthErrorMessage(err))
      setStatusText(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!nativeReady) return
    setLoading(true)
    setError(null)
    try {
      await googleGmailDisconnect()
      refreshSequence.current += 1
      selectionSequence.current += 1
      setIsAuthed(false)
      setAccountEmail(null)
      setMessages([])
      setSelectedMessage(null)
      setStatusText(t('integrations.gmail.status.disconnected'))
    } catch (err) {
      setError(googleAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSelectMessage = async (preview: GmailMessagePreview) => {
    if (!nativeReady) return
    const sequence = ++selectionSequence.current
    setLoadingContent(true)
    setError(null)
    try {
      const full = await googleGmailGetMessage(preview.id)
      if (sequence !== selectionSequence.current) return
      setSelectedMessage(full)
    } catch (err) {
      if (sequence !== selectionSequence.current) return
      setError(googleAuthErrorMessage(err))
    } finally {
      if (sequence === selectionSequence.current) setLoadingContent(false)
    }
  }

  const handleImportToMarkdown = async (message: GmailMessageContent) => {
    if (!onImportNote) return
    setLoading(true)
    setError(null)
    try {
      const subject = message.subject || t('integrations.gmail.untitledEmail')
      const markdown = `---
title: ${toYamlScalar(subject)}
from: ${toYamlScalar(message.from || t('integrations.gmail.unknownSender'))}
date: ${toYamlScalar(message.date || '')}
gmail_id: ${toYamlScalar(message.id || '')}
thread_id: ${toYamlScalar(message.threadId || '')}
tags:
  - email
  - gmail
---

# ${subject}

**${t('integrations.gmail.from')}**: ${message.from}

**${t('integrations.gmail.date')}**: ${formatGmailDate(message.date)}

---

${message.plainText || message.snippet}
`
      await onImportNote(subject, markdown, message.id)
      setStatusText(t('integrations.gmail.status.imported', { subject }))
    } catch (err) {
      setStatusText(null)
      setError(googleAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async (id: string) => {
    if (!nativeReady || loadingContent) return
    setLoading(true)
    setError(null)
    try {
      await googleGmailModifyMessage(id, [], ['INBOX'])
      selectionSequence.current += 1
      setSelectedMessage(null)
      setStatusText(t('integrations.gmail.status.archived'))
      await handleRefreshMessages()
    } catch (err) {
      setError(googleAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleTrash = async (id: string) => {
    if (!nativeReady || loadingContent) return
    setLoading(true)
    setError(null)
    try {
      await googleGmailTrashMessage(id)
      selectionSequence.current += 1
      setSelectedMessage(null)
      setStatusText(t('integrations.gmail.status.trashed'))
      await handleRefreshMessages()
    } catch (err) {
      setError(googleAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault()
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
      setStatusText(t('integrations.gmail.status.sent'))
    } catch (err) {
      setError(googleAuthErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <UnifiedPanelShell
      title={t('integrations.gmail.title')}
      subtitle={t('integrations.gmail.subtitle')}
      icon={<Mail size={18} />}
      ariaLabel={t('integrations.gmail.ariaLabel')}
      helpTopic="gmail"
      onClose={onClose}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId as GmailTab)}
      className="gmail-manager-panel"
      wide
      presentation={presentation}
    >
      <div className="gmail-manager-content">
        <div className="gmail-manager-maturity" role="note">
          <strong>{t('integrations.google.experimental')}</strong>{' '}
          {t('integrations.gmail.experimentalNote')}
        </div>

        {statusText ? (
          <div className="gmail-manager-status gmail-manager-status--success" role="status">
            <CheckCircle size={16} />
            <span>{statusText}</span>
          </div>
        ) : null}

        {error ? (
          <div className="gmail-manager-status gmail-manager-status--error" role="alert">
            {error}
          </div>
        ) : null}

        {activeTab === 'messages' ? (
          <div className="gmail-manager-tab gmail-manager-tab--messages" data-help-topic="gmail-messages">
            <div>
              <label htmlFor="gmail-search-input" className="gmail-manager-search-label">
                {t('integrations.gmail.searchLabel')}
              </label>
              <div className="gmail-manager-search-row">
                <div className="gmail-manager-search-box">
                  <input
                    id="gmail-search-input"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !refreshing) void handleRefreshMessages()
                    }}
                    placeholder={t('integrations.gmail.searchPlaceholder')}
                    aria-label={t('integrations.gmail.searchAria')}
                    disabled={!nativeReady || checkingAuth || !isAuthed}
                  />
                  <Search size={16} aria-hidden="true" />
                </div>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => void handleRefreshMessages()}
                  disabled={refreshing || !nativeReady || checkingAuth || !isAuthed}
                  title={t('integrations.gmail.refresh')}
                  aria-label={t('integrations.gmail.refresh')}
                >
                  <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
                </button>
              </div>
            </div>

            {checkingAuth ? (
              <div className="gmail-manager-empty">
                <RefreshCw size={24} className="spinning" aria-hidden="true" />
                <p>{t('integrations.gmail.checkingConnection')}</p>
              </div>
            ) : null}

            {!checkingAuth && !isAuthed ? (
              <div className="gmail-manager-empty empty-state">
                <Key size={32} aria-hidden="true" />
                <h3>{t('integrations.gmail.notConnected')}</h3>
                <p>{t('integrations.gmail.connectPrompt')}</p>
                <button type="button" className="action-button" onClick={() => setActiveTab('account')}>
                  {t('integrations.gmail.connectAccount')}
                </button>
              </div>
            ) : null}

            {!checkingAuth && isAuthed ? (
              <div className={`gmail-manager-message-layout${selectedMessage ? ' gmail-manager-message-layout--detail' : ''}`}>
                <div className="gmail-manager-message-list" aria-label={t('integrations.gmail.messageListAria')}>
                  {messages.length === 0 && !refreshing ? (
                    <div className="gmail-manager-empty">
                      <Inbox size={28} aria-hidden="true" />
                      <p>{t('integrations.gmail.noMessages')}</p>
                    </div>
                  ) : null}

                  {messages.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void handleSelectMessage(item)}
                      disabled={loading}
                      className={`gmail-manager-message-row${selectedMessage?.id === item.id ? ' is-selected' : ''}`}
                    >
                      <span className="gmail-manager-message-row-head">
                        <strong>{item.from}</strong>
                        <time>{formatGmailDate(item.date)}</time>
                      </span>
                      <span className="gmail-manager-message-subject">
                        {item.subject || t('integrations.gmail.noSubject')}
                      </span>
                      <span className="gmail-manager-message-snippet">{item.snippet}</span>
                    </button>
                  ))}
                </div>

                {selectedMessage ? (
                  <article className="gmail-manager-message-detail">
                    <header className="gmail-manager-message-detail-header">
                      <div className="gmail-manager-message-detail-title-row">
                        <h3>{selectedMessage.subject || t('integrations.gmail.noSubject')}</h3>
                        <div className="gmail-manager-message-actions">
                          {onImportNote ? (
                            <button
                              type="button"
                              className="action-button"
                              onClick={() => void handleImportToMarkdown(selectedMessage)}
                              disabled={loading || loadingContent}
                              title={t('integrations.gmail.importTitle')}
                            >
                              <FileDown size={14} />
                              <span>{t('integrations.gmail.import')}</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="toolbar-button"
                            onClick={() => void handleArchive(selectedMessage.id)}
                            disabled={loading || loadingContent}
                            aria-label={t('integrations.gmail.archive')}
                            title={t('integrations.gmail.archive')}
                          >
                            <Archive size={14} />
                          </button>
                          <button
                            type="button"
                            className="toolbar-button"
                            onClick={() => void handleTrash(selectedMessage.id)}
                            disabled={loading || loadingContent}
                            aria-label={t('integrations.gmail.trash')}
                            title={t('integrations.gmail.trash')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <dl className="gmail-manager-message-meta">
                        <div><dt>{t('integrations.gmail.from')}</dt><dd>{selectedMessage.from}</dd></div>
                        <div><dt>{t('integrations.gmail.date')}</dt><dd>{formatGmailDate(selectedMessage.date)}</dd></div>
                      </dl>
                    </header>
                    <div className="gmail-manager-message-body">
                      {selectedMessage.plainText || selectedMessage.snippet}
                    </div>
                  </article>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'compose' ? (
          <form onSubmit={handleSend} className="gmail-manager-compose" data-help-topic="gmail-compose">
            <label className="settings-field">
              {t('integrations.gmail.recipient')}
              <input
                type="email"
                value={composeTo}
                onChange={(event) => setComposeTo(event.target.value)}
                placeholder="recipient@example.com"
                required
                disabled={sending}
              />
            </label>
            <label className="settings-field">
              {t('integrations.gmail.subject')}
              <input
                type="text"
                value={composeSubject}
                onChange={(event) => setComposeSubject(event.target.value)}
                placeholder={t('integrations.gmail.subjectPlaceholder')}
                required
                disabled={sending}
              />
            </label>
            <label className="settings-field gmail-manager-compose-body-field">
              {t('integrations.gmail.messageBody')}
              <textarea
                value={composeBody}
                onChange={(event) => setComposeBody(event.target.value)}
                placeholder={t('integrations.gmail.bodyPlaceholder')}
                required
                disabled={sending}
              />
            </label>
            <div className="gmail-manager-compose-actions">
              <button
                type="submit"
                className="action-button gmail-manager-inline-action"
                disabled={sending || !composeTo.trim() || !composeSubject.trim() || !isAuthed}
              >
                <Send size={14} />
                <span>{sending ? t('integrations.gmail.sending') : t('integrations.gmail.send')}</span>
              </button>
            </div>
          </form>
        ) : null}

        {activeTab === 'account' ? (
          <div className="gmail-manager-account" data-help-topic="gmail-account">
            <div className="gmail-manager-account-card">
              <h4>{t('integrations.gmail.connectionStatus')}</h4>
              <p>
                {isAuthed
                  ? t('integrations.gmail.connectedAccount', { email: accountEmail ?? t('integrations.gmail.connectedUnknown') })
                  : t('integrations.gmail.notConnectedStatus')}
              </p>
              {isAuthed ? (
                <button
                  type="button"
                  className="toolbar-button gmail-manager-disconnect"
                  onClick={() => void handleDisconnect()}
                  disabled={loading}
                >
                  <LogOut size={14} />
                  <span>{t('integrations.gmail.disconnect')}</span>
                </button>
              ) : (
                <form onSubmit={handleStartAuth} className="gmail-manager-account-form">
                  <label className="settings-field">
                    {t('integrations.gmail.clientId')}
                    <input
                      type="text"
                      value={clientId}
                      onChange={(event) => setClientIdOverride(event.target.value)}
                      placeholder="1234567890-abc.apps.googleusercontent.com"
                      required
                    />
                  </label>
                  <p className="gmail-manager-help">{t('integrations.gmail.clientHelp')}</p>
                  <div>
                    <button type="submit" className="action-button" disabled={loading || !clientId.trim()}>
                      {loading ? t('integrations.gmail.startingAuth') : t('integrations.gmail.connectGoogle')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </UnifiedPanelShell>
  )
}
