import { useCallback, useEffect, useRef, useState } from 'react'
import { collaborationConnect, collaborationDisconnect, collaborationGetAccount } from '../bridge/commands/collaboration'
import { googleGmailDisconnect, googleGmailGetAuthedEmail, googleGmailStartAuth } from '../bridge/commands/google_gmail'
import { googleAuthErrorMessage, isGoogleAuthRequiredError, isGoogleAccountNotConnectedError } from '../lib/googleAuthErrors'

type Service = 'drive' | 'gmail'
interface AccountState {
  status: 'disconnected' | 'checking' | 'authorizing' | 'connected' | 'error' | 'reconnect-required'
  email: string | null
  error: string | null
  busy: boolean
}
const disconnected: AccountState = { status: 'disconnected', email: null, error: null, busy: false }

/** IPC account identity is runtime evidence, not trusted from TypeScript types. */
function verifiedGoogleAccountEmail(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 254 || /[\u0000-\u001F\u007F]/.test(value)) return null
  const email = value.trim()
  return /^[^\s@<>]+@[^\s@<>]+$/.test(email) ? email : null
}

/** Independent credential lanes; configuration stores only the shared public client ID. */
export function useGoogleIntegrationAccounts({ vaultId, clientId, persistClientId, gmailEnabled = true }: {
  vaultId: string
  clientId: string
  persistClientId: (clientId: string) => Promise<void>
  gmailEnabled?: boolean
}) {
  const [accounts, setAccounts] = useState<Record<Service, AccountState>>({ drive: disconnected, gmail: disconnected })
  const generation = useRef({ drive: 0, gmail: 0 })
  const running = useRef({ drive: 0, gmail: 0 })
  const update = useCallback((service: Service, next: AccountState) => {
    setAccounts((current) => ({ ...current, [service]: next }))
  }, [])

  const check = useCallback(async (service: Service) => {
    if (service === 'gmail' && !gmailEnabled) return
    if (running.current[service]) return
    const sequence = ++generation.current[service]
    update(service, { ...disconnected, status: 'checking', busy: true })
    try {
      const rawEmail = service === 'drive' ? await collaborationGetAccount() : await googleGmailGetAuthedEmail()
      if (sequence !== generation.current[service]) return
      const email = rawEmail === null ? null : verifiedGoogleAccountEmail(rawEmail)
      if (rawEmail !== null && email === null) {
        throw new Error('Google account identity cannot be verified. Refresh or reconnect before trusting this connection.')
      }
      update(service, { ...disconnected, status: email ? 'connected' : 'disconnected', email })
    } catch (error) {
      if (sequence !== generation.current[service]) return
      update(service, isGoogleAccountNotConnectedError(error) ? disconnected
        : isGoogleAuthRequiredError(error)
          ? { ...disconnected, status: 'reconnect-required', error: googleAuthErrorMessage(error) }
          : { ...disconnected, status: 'error', error: googleAuthErrorMessage(error) })
    }
  }, [gmailEnabled, update])

  useEffect(() => {
    let live = true
    const generations = generation.current
    const operations = running.current
    void Promise.resolve().then(() => {
      if (!live) return
      void check('drive')
      void check('gmail')
    })
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ service?: Service; origin?: string }>).detail
      if (detail?.origin === 'settings') return
      if (detail?.service === 'drive' || detail?.service === 'gmail') {
        generation.current[detail.service]++
        running.current[detail.service] = 0
        void check(detail.service)
      }
    }
    window.addEventListener('scriptor:google-account-changed', changed)
    return () => {
      live = false
      generations.drive++
      generations.gmail++
      operations.drive = 0
      operations.gmail = 0
      window.removeEventListener('scriptor:google-account-changed', changed)
    }
  }, [check, vaultId, clientId])

  const operate = useCallback(async (service: Service, connect: boolean) => {
    if (service === 'gmail' && !gmailEnabled) return
    if (running.current[service] || (connect && !clientId.trim())) return
    const sequence = ++generation.current[service]
    running.current[service] = sequence
    const previousEmail = accounts[service].email
    let email: string | null = null
    let invalidIdentity = false
    const notifyCredentialChange = () => window.dispatchEvent(new CustomEvent('scriptor:google-account-changed', { detail: { service, origin: 'settings' } }))
    update(service, { ...disconnected, status: connect ? 'authorizing' : 'checking', busy: true })
    try {
      if (connect) {
        const rawEmail = service === 'drive' ? await collaborationConnect(clientId.trim()) : await googleGmailStartAuth(clientId.trim())
        // The native credential owner may have changed globally even when this
        // vault panel is stale. Invalidate other consumers, but never persist
        // an unverified account or an old vault's public client ID.
        notifyCredentialChange()
        if (sequence !== generation.current[service]) return
        email = verifiedGoogleAccountEmail(rawEmail)
        if (!email) {
          invalidIdentity = true
          throw new Error('Google account identity cannot be verified. Refresh or reconnect before trusting this connection.')
        }
        await persistClientId(clientId)
      } else {
        if (service === 'drive') await collaborationDisconnect()
        else await googleGmailDisconnect()
        notifyCredentialChange()
      }
      if (sequence !== generation.current[service]) return
      update(service, { ...disconnected, status: email ? 'connected' : 'disconnected', email })
    } catch (error) {
      if (sequence !== generation.current[service]) return
      update(service, isGoogleAccountNotConnectedError(error) ? disconnected
        : isGoogleAuthRequiredError(error)
          ? { ...disconnected, status: 'reconnect-required', error: googleAuthErrorMessage(error) }
          : { ...disconnected, status: 'error', email: invalidIdentity ? null : email ?? previousEmail, error: googleAuthErrorMessage(error) })
    } finally {
      if (running.current[service] === sequence) running.current[service] = 0
    }
  }, [accounts, clientId, gmailEnabled, persistClientId, update])

  return { ...accounts, gmail: gmailEnabled ? accounts.gmail : disconnected, check, connect: (service: Service) => operate(service, true), disconnect: (service: Service) => operate(service, false) }
}
