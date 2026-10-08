import { useCallback, useEffect, useRef, useState } from 'react'
import { collaborationConnect, collaborationDisconnect, collaborationGetAccount } from '../bridge/commands/collaboration'
import { googleGmailDisconnect, googleGmailGetAuthedEmail, googleGmailStartAuth } from '../bridge/commands/google_gmail'
import { googleAuthErrorMessage, isGoogleAuthRequiredError } from '../lib/googleAuthErrors'

type Service = 'drive' | 'gmail'
interface AccountState {
  status: 'disconnected' | 'checking' | 'authorizing' | 'connected' | 'error'
  email: string | null
  error: string | null
  busy: boolean
}
const disconnected: AccountState = { status: 'disconnected', email: null, error: null, busy: false }

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
      const email = service === 'drive' ? await collaborationGetAccount() : await googleGmailGetAuthedEmail()
      if (sequence !== generation.current[service]) return
      update(service, { ...disconnected, status: email ? 'connected' : 'disconnected', email })
    } catch (error) {
      if (sequence !== generation.current[service]) return
      update(service, isGoogleAuthRequiredError(error) ? disconnected
        : { ...disconnected, status: 'error', error: googleAuthErrorMessage(error) })
    }
  }, [gmailEnabled, update])

  useEffect(() => {
    void check('drive')
    void check('gmail')
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
      generation.current.drive++
      generation.current.gmail++
      running.current.drive = 0
      running.current.gmail = 0
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
    const notifyCredentialChange = () => window.dispatchEvent(new CustomEvent('scriptor:google-account-changed', { detail: { service, origin: 'settings' } }))
    update(service, { ...disconnected, status: connect ? 'authorizing' : 'checking', busy: true })
    try {
      if (connect) {
        email = service === 'drive' ? await collaborationConnect(clientId.trim()) : await googleGmailStartAuth(clientId.trim())
        notifyCredentialChange()
        if (sequence !== generation.current[service]) return
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
      update(service, { ...disconnected, status: 'error', email: email ?? previousEmail, error: googleAuthErrorMessage(error) })
    } finally {
      if (running.current[service] === sequence) running.current[service] = 0
    }
  }, [accounts, clientId, gmailEnabled, persistClientId, update])

  return { ...accounts, gmail: gmailEnabled ? accounts.gmail : disconnected, check, connect: (service: Service) => operate(service, true), disconnect: (service: Service) => operate(service, false) }
}
