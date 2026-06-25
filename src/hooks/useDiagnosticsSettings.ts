import { useCallback, useEffect, useState } from 'react'

import { diagnosticsAppendEvent } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'

const STORAGE_KEY = 'scriptor.diagnostics.optIn'

export type ClientDiagnosticEvent = {
  id: string
  ts: number
  type: string
  message: string
  detail?: string
}

function readOptIn(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.localStorage.getItem(STORAGE_KEY) === 'true'
}

export function useDiagnosticsSettings(vaultOpen: boolean) {
  const [optIn, setOptInState] = useState(readOptIn)
  const [events, setEvents] = useState<ClientDiagnosticEvent[]>([])

  const setOptIn = useCallback((enabled: boolean) => {
    setOptInState(enabled)
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
    if (!enabled) {
      setEvents([])
    }
  }, [])

  const recordEvent = useCallback(
    (type: string, message: string, detail?: string) => {
      if (!optIn) {
        return
      }

      const entry: ClientDiagnosticEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        type,
        message,
        detail,
      }

      setEvents((current) => [entry, ...current].slice(0, 50))

      if (vaultOpen && isNativeBridgeAvailable()) {
        void diagnosticsAppendEvent(type, message, detail ?? null).catch(() => {
          // Best-effort local diagnostics only.
        })
      }
    },
    [optIn, vaultOpen],
  )

  useEffect(() => {
    if (!optIn) {
      return
    }

    const onError = (event: ErrorEvent) => {
      recordEvent('renderer.error', event.message, event.error?.stack ?? undefined)
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.stack ?? event.reason.message
          : String(event.reason)
      recordEvent('renderer.unhandledrejection', 'Unhandled promise rejection', reason)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [optIn, recordEvent])

  return {
    optIn,
    setOptIn,
    events,
    recordEvent,
  }
}
