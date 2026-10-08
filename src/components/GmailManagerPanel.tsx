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
  googleGmailListMessagesPage,
  googleGmailModifyMessage,
  googleGmailSendMessage,
  googleGmailStartAuth,
  googleGmailTrashMessage,
  type GmailMessageContent,
  type GmailMessagePreview,
} from '../bridge/commands/google_gmail.ts'
import { isNativeBridgeAvailable } from '../bridge/platform.ts'
import { buildGmailMarkdown, buildRfc5322Message } from '../lib/gmailRfc5322.ts'
import { googleAuthErrorMessage, isGoogleAuthRequiredError } from '../lib/googleAuthErrors.ts'
import { useI18n } from '../lib/i18n/index.ts'
import { UnifiedPanelShell, type PanelTab } from './chrome/UnifiedPanelShell.tsx'
import type { PanelPresentation } from '../hooks/usePanelPresentation.ts'

export interface GmailManagerPanelProps {
  onClose: () => void
  onImportNote?: (subject: string, markdown: string, messageId: string, isCurrent?: () => boolean) => Promise<void>
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
  const [searchQuery, setSearchQuery] = useState('in:inbox')
  const [messages, setMessages] = useState<GmailMessagePreview[]>([])
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingContent, setLoadingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusText, setStatusText] = useState<string | null>(null)
  const refreshSequence = useRef(0)
  const selectionSequence = useRef(0)
  const accountSequence = useRef(0)
  const operationSequence = useRef(0)
  const mounted = useRef(true)
  const queryRef = useRef('in:inbox')
  const loadedQuery = useRef<string | null>(null)
  const visitedTokens = useRef(new Set<string>())
  const messagesRef = useRef<GmailMessagePreview[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [limitReached, setLimitReached] = useState(false)

  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [sending, setSending] = useState(false)

  const clearMessages = useCallback(() => {
    refreshSequence.current += 1
    selectionSequence.current += 1
    visitedTokens.current.clear()
    loadedQuery.current = null
    messagesRef.current = []
    setMessages([])
    setSelectedMessage(null)
    setNextPageToken(null)
    setRefreshing(false)
    setLoadingMore(false)
    setLoadingContent(false)
    setLimitReached(false)
  }, [])

  const clearAccount = useCallback(() => {
    clearMessages()
    setIsAuthed(false)
    setAccountEmail(null)
  }, [clearMessages])

  const tabs = useMemo<PanelTab[]>(() => [
    { id: 'messages', label: t('integrations.gmail.tabs.messages') },
    { id: 'compose', label: t('integrations.gmail.tabs.compose') },
    { id: 'account', label: t('integrations.gmail.tabs.account') },
  ], [t])

  const loadMessages = useCallback(
    async (query: string, pageToken: string | null = null) => {
      if (!nativeReady) return
      const normalizedQuery = effectiveGmailQuery(query)
      if (normalizedQuery !== effectiveGmailQuery(queryRef.current)) return
      if (!pageToken) clearMessages()
      const sequence = ++refreshSequence.current
      const account = accountSequence.current
      const current = () => mounted.current && account === accountSequence.current && sequence === refreshSequence.current
      if (pageToken) setLoadingMore(true)
      else {
        loadedQuery.current = normalizedQuery
        setRefreshing(true)
      }
      setError(null)
      try {
        const page = await googleGmailListMessagesPage(normalizedQuery, Math.min(25, 250 - (pageToken ? messagesRef.current.length : 0)), pageToken)
        if (!current()) return
        if (page.nextPageToken && (page.nextPageToken === pageToken || visitedTokens.current.has(page.nextPageToken))) {
          setNextPageToken(null)
          setError(t('integrations.gmail.paginationLoop'))
          return
        }
        if (pageToken) visitedTokens.current.add(pageToken)
        const combined = pageToken ? [...messagesRef.current, ...page.messages] : page.messages
        const unique = [...new Map(combined.map(item => [item.id, item])).values()].slice(0, 250)
        messagesRef.current = unique
        setMessages(unique)
        const capped = (unique.length >= 250 || visitedTokens.current.size >= 20) && Boolean(page.nextPageToken)
        setLimitReached(capped)
        setNextPageToken(capped ? null : page.nextPageToken)
        setIsAuthed(true)
      } catch (err) {
        if (!current()) return
        // A rejected continuation may contain a repeated or invalid token. Refresh
        // starts a new traversal without offering the failed continuation again.
        if (pageToken) setNextPageToken(null)
        if (isGoogleAuthRequiredError(err)) {
          clearAccount()
        } else {
          setError(googleAuthErrorMessage(err))
        }
      } finally {
        if (current()) {
          setRefreshing(false)
          setLoadingMore(false)
        }
      }
    },
    [nativeReady, clearMessages, clearAccount, t],
  )

  const handleRefreshMessages = useCallback(
    async (queryOverride?: string) => {
      await loadMessages(queryOverride !== undefined ? queryOverride : queryRef.current)
    },
    [loadMessages],
  )
  const loadMessagesRef = useRef(loadMessages)
  useEffect(() => { loadMessagesRef.current = loadMessages }, [loadMessages])

  useEffect(() => {
    if (!nativeReady) return
    mounted.current = true
    const check = async () => {
      const sequence = ++accountSequence.current
      try {
        const email = await googleGmailGetAuthedEmail()
        if (!mounted.current || sequence !== accountSequence.current) return
        setAccountEmail(email)
        setIsAuthed(true)
        await loadMessagesRef.current(queryRef.current)
      } catch (err) {
        if (!mounted.current || sequence !== accountSequence.current) return
        if (isGoogleAuthRequiredError(err)) {
          clearAccount()
        } else {
          setError(googleAuthErrorMessage(err))
        }
      } finally {
        if (mounted.current && sequence === accountSequence.current) setCheckingAuth(false)
      }
    }
    void check()
    const accountChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ service?: string; origin?: string }>).detail
      if (detail?.service !== 'gmail' || detail.origin === 'gmail-panel') return
      operationSequence.current += 1
      clearAccount()
      setCheckingAuth(true)
      setLoading(false)
      setSending(false)
      setComposeTo('')
      setComposeSubject('')
      setComposeBody('')
      setStatusText(null)
      void check()
    }
    window.addEventListener('scriptor:google-account-changed', accountChanged)

    return () => {
      mounted.current = false
      accountSequence.current += 1
      operationSequence.current += 1
      refreshSequence.current += 1
      selectionSequence.current += 1
      window.removeEventListener('scriptor:google-account-changed', accountChanged)
    }
  }, [nativeReady, clearAccount])

  const handleStartAuth = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!clientId.trim() || !nativeReady || loading || sending) return
    const operation = ++operationSequence.current
    const account = ++accountSequence.current
    const current = () => mounted.current && operation === operationSequence.current && account === accountSequence.current
    clearAccount()
    setLoading(true)
    setError(null)
    setStatusText(t('integrations.gmail.status.openingBrowser'))
    try {
      const email = await googleGmailStartAuth(clientId.trim())
      window.dispatchEvent(new CustomEvent('scriptor:google-account-changed', { detail: { service: 'gmail', origin: 'gmail-panel' } }))
      if (!current()) return
      setIsAuthed(true)
      setAccountEmail(email)
      setStatusText(t('integrations.gmail.status.connectedAs', { email }))
      setActiveTab('messages')
      await handleRefreshMessages()
    } catch (err) {
      if (!current()) return
      setError(googleAuthErrorMessage(err))
      setStatusText(null)
    } finally {
      if (current()) { setLoading(false); setCheckingAuth(false) }
    }
  }

  const handleDisconnect = async () => {
    if (!nativeReady || loading || sending) return
    const operation = ++operationSequence.current
    const account = ++accountSequence.current
    const current = () => mounted.current && operation === operationSequence.current && account === accountSequence.current
    clearMessages()
    setLoading(true)
    setError(null)
    setStatusText(null)
    try {
      await googleGmailDisconnect()
      window.dispatchEvent(new CustomEvent('scriptor:google-account-changed', { detail: { service: 'gmail', origin: 'gmail-panel' } }))
      if (!current()) return
      clearAccount()
      setComposeTo('')
      setComposeSubject('')
      setComposeBody('')
      setStatusText(t('integrations.gmail.status.disconnected'))
    } catch (err) {
      if (!current()) return
      setError(googleAuthErrorMessage(err))
    } finally {
      if (current()) { setLoading(false); setCheckingAuth(false) }
    }
  }

  const handleSelectMessage = async (preview: GmailMessagePreview) => {
    if (!nativeReady || !isAuthed || loading || refreshing) return
    const sequence = ++selectionSequence.current
    const account = accountSequence.current
    const current = () => mounted.current && sequence === selectionSequence.current && account === accountSequence.current
    setLoadingContent(true)
    setSelectedMessage(null)
    setError(null)
    setStatusText(null)
    try {
      const full = await googleGmailGetMessage(preview.id)
      if (!current()) return
      setSelectedMessage(full)
    } catch (err) {
      if (!current()) return
      if (isGoogleAuthRequiredError(err)) clearAccount()
      else setError(googleAuthErrorMessage(err))
    } finally {
      if (current()) setLoadingContent(false)
    }
  }

  const handleImportToMarkdown = async (message: GmailMessageContent) => {
    if (!onImportNote || loading || sending || loadingContent || !isAuthed) return
    const operation = ++operationSequence.current
    const account = accountSequence.current
    const current = () => mounted.current && operation === operationSequence.current && account === accountSequence.current
    setLoading(true)
    setError(null)
    setStatusText(null)
    try {
      const subject = message.subject || t('integrations.gmail.untitledEmail')
      const markdown = buildGmailMarkdown(message, { untitled: t('integrations.gmail.untitledEmail'),
        unknown: t('integrations.gmail.unknownSender'), from: t('integrations.gmail.from'), date: t('integrations.gmail.date') })
      await onImportNote(subject, markdown, message.id, current)
      if (!current()) return
      setStatusText(t('integrations.gmail.status.imported', { subject }))
    } catch (err) {
      if (!current()) return
      setStatusText(null)
      setError(googleAuthErrorMessage(err))
    } finally {
      if (current()) setLoading(false)
    }
  }

  const handleArchive = async (id: string) => {
    if (!nativeReady || !isAuthed || loadingContent || loading || sending) return
    const operation = ++operationSequence.current
    const account = accountSequence.current
    const current = () => mounted.current && operation === operationSequence.current && account === accountSequence.current
    setLoading(true)
    setError(null)
    setStatusText(null)
    try {
      await googleGmailModifyMessage(id, [], ['INBOX'])
      if (!current()) return
      selectionSequence.current += 1
      setSelectedMessage(null)
      setStatusText(t('integrations.gmail.status.archived'))
      await handleRefreshMessages()
    } catch (err) {
      if (!current()) return
      if (isGoogleAuthRequiredError(err)) clearAccount()
      setError(googleAuthErrorMessage(err))
    } finally {
      if (current()) setLoading(false)
    }
  }

  const handleTrash = async (id: string) => {
    if (!nativeReady || !isAuthed || loadingContent || loading || sending) return
    const operation = ++operationSequence.current
    const account = accountSequence.current
    const current = () => mounted.current && operation === operationSequence.current && account === accountSequence.current
    setLoading(true)
    setError(null)
    setStatusText(null)
    try {
      await googleGmailTrashMessage(id)
      if (!current()) return
      selectionSequence.current += 1
      setSelectedMessage(null)
      setStatusText(t('integrations.gmail.status.trashed'))
      await handleRefreshMessages()
    } catch (err) {
      if (!current()) return
      if (isGoogleAuthRequiredError(err)) clearAccount()
      setError(googleAuthErrorMessage(err))
    } finally {
      if (current()) setLoading(false)
    }
  }

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim() || !nativeReady || !isAuthed || loading || sending) return
    const operation = ++operationSequence.current
    const account = accountSequence.current
    const current = () => mounted.current && operation === operationSequence.current && account === accountSequence.current
    setSending(true)
    setError(null)
    setStatusText(null)
    try {
      const raw = buildRfc5322Message(composeTo.trim(), composeSubject.trim(), composeBody)
      await googleGmailSendMessage(raw)
      if (!current()) return
      setComposeTo('')
      setComposeSubject('')
      setComposeBody('')
      setStatusText(t('integrations.gmail.status.sent'))
    } catch (err) {
      if (!current()) return
      if (isGoogleAuthRequiredError(err)) clearAccount()
      setError(googleAuthErrorMessage(err))
    } finally {
      if (current()) setSending(false)
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
          <div className="gmail-manager-tab gmail-manager-tab--messages">
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
                    onChange={(event) => {
                      queryRef.current = event.target.value
                      setSearchQuery(event.target.value)
                      clearMessages()
                      setError(null)
                      setStatusText(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !refreshing && !loading && !sending) void handleRefreshMessages()
                    }}
                    placeholder={t('integrations.gmail.searchPlaceholder')}
                    aria-label={t('integrations.gmail.searchAria')}
                    maxLength={512}
                    disabled={!nativeReady || checkingAuth || !isAuthed || loading || sending}
                  />
                  <Search size={16} aria-hidden="true" />
                </div>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => void handleRefreshMessages()}
                  disabled={refreshing || loadingMore || loading || sending || !nativeReady || checkingAuth || !isAuthed}
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
                <div className="gmail-manager-message-list" aria-label={t('integrations.gmail.messageListAria')} aria-busy={refreshing || loadingMore}>
                  {refreshing ? <p role="status" className="gmail-manager-page-status">{t('integrations.gmail.loadingMessages')}</p> : null}
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
                      disabled={loading || sending || refreshing}
                      aria-pressed={selectedMessage?.id === item.id}
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
                  {nextPageToken ? (
                    <button type="button" className="action-button gmail-manager-load-more"
                      onClick={() => {
                        if (loadedQuery.current === effectiveGmailQuery(queryRef.current) && !loadingMore) {
                          void loadMessages(queryRef.current, nextPageToken)
                        }
                      }}
                      disabled={loadingMore || refreshing || loading || sending}>
                      {t(loadingMore ? 'integrations.gmail.loadingMessages' : 'integrations.gmail.loadMore')}
                    </button>
                  ) : null}
                  {limitReached ? <p role="status" className="gmail-manager-page-status">{t('integrations.gmail.resultLimit')}</p> : null}
                </div>

                {loadingContent ? <div className="gmail-manager-empty" role="status">{t('integrations.gmail.loadingMessage')}</div> : null}

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
                              disabled={loading || sending || loadingContent}
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
                            disabled={loading || sending || loadingContent}
                            aria-label={t('integrations.gmail.archive')}
                            title={t('integrations.gmail.archive')}
                          >
                            <Archive size={14} />
                          </button>
                          <button
                            type="button"
                            className="toolbar-button"
                            onClick={() => void handleTrash(selectedMessage.id)}
                            disabled={loading || sending || loadingContent}
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
          <form onSubmit={handleSend} className="gmail-manager-compose">
            <label className="settings-field">
              {t('integrations.gmail.recipient')}
              <input
                type="email"
                value={composeTo}
                onChange={(event) => setComposeTo(event.target.value)}
                placeholder="recipient@example.com"
                required
                maxLength={320}
                disabled={sending || loading || !isAuthed}
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
                maxLength={1024}
                disabled={sending || loading || !isAuthed}
              />
            </label>
            <label className="settings-field gmail-manager-compose-body-field">
              {t('integrations.gmail.messageBody')}
              <textarea
                value={composeBody}
                onChange={(event) => setComposeBody(event.target.value)}
                placeholder={t('integrations.gmail.bodyPlaceholder')}
                required
                maxLength={500_000}
                disabled={sending || loading || !isAuthed}
              />
            </label>
            <div className="gmail-manager-compose-actions">
              <button
                type="submit"
                className="action-button gmail-manager-inline-action"
                disabled={sending || loading || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim() || !isAuthed}
              >
                <Send size={14} />
                <span>{sending ? t('integrations.gmail.sending') : t('integrations.gmail.send')}</span>
              </button>
            </div>
          </form>
        ) : null}

        {activeTab === 'account' ? (
          <div className="gmail-manager-account">
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
                  disabled={loading || sending || checkingAuth}
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
                      disabled={loading || sending || checkingAuth}
                    />
                  </label>
                  <p className="gmail-manager-help">{t('integrations.gmail.clientHelp')}</p>
                  <div>
                    <button type="submit" className="action-button" disabled={loading || sending || checkingAuth || !nativeReady || !clientId.trim()}>
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
