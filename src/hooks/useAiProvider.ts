import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  aiProviderDeleteApiKey,
  aiProviderHasApiKey,
  aiProviderProposeDraft,
  aiProviderSetApiKey,
} from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { translate } from '../lib/i18n'

export type AiProviderId = 'openai-compatible' | 'off'

const PROVIDER_KEY = 'scriptor.ai.provider'
const ENDPOINT_KEY = 'scriptor.ai.endpoint'
const REQUEST_TIMEOUT_MS = 30_000

function readProvider(): AiProviderId {
  if (typeof window === 'undefined') return 'off'
  const value = window.localStorage.getItem(PROVIDER_KEY)
  return value === 'openai-compatible' ? 'openai-compatible' : 'off'
}

function readEndpoint(): string {
  if (typeof window === 'undefined') return 'https://api.openai.com/v1/chat/completions'
  return window.localStorage.getItem(ENDPOINT_KEY) ?? 'https://api.openai.com/v1/chat/completions'
}

export function useAiProvider() {
  const [provider, setProviderState] = useState<AiProviderId>(readProvider)
  const [endpoint, setEndpointState] = useState(readEndpoint)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const abortControllersRef = useRef<Set<AbortController>>(new Set())

  useEffect(() => {
    const controllers = abortControllersRef.current
    return () => {
      for (const controller of controllers) {
        controller.abort()
      }
      controllers.clear()
    }
  }, [])

  const checkHttps = useCallback((url: string) => {
    try {
      const parsed = new URL(url)
      const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
      if (parsed.protocol === 'http:' && !isLocalhost) {
        return translate('en', 'aiProvider.httpWarning')
      }
    } catch {
      // invalid URL — let the request fail naturally
    }
    return null
  }, [])

  const refreshKeyState = useCallback(async () => {
    if (!isNativeBridgeAvailable()) {
      setHasApiKey(false)
      return
    }
    try {
      setHasApiKey(await aiProviderHasApiKey())
    } catch (error) {
      setHasApiKey(false)
      setLastError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  useEffect(() => {
    if (!isNativeBridgeAvailable()) return
    let cancelled = false
    void aiProviderHasApiKey()
      .then((available) => {
        if (!cancelled) setHasApiKey(available)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setHasApiKey(false)
          setLastError(error instanceof Error ? error.message : String(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const httpWarning = useMemo(() => checkHttps(endpoint), [checkHttps, endpoint])

  const setProvider = useCallback((next: AiProviderId) => {
    setProviderState(next)
    window.localStorage.setItem(PROVIDER_KEY, next)
  }, [])

  const setEndpoint = useCallback((next: string) => {
    setEndpointState(next)
    window.localStorage.setItem(ENDPOINT_KEY, next)
  }, [])

  const saveApiKey = useCallback(async (secret: string) => {
    setBusy(true)
    setLastError(null)
    try {
      await aiProviderSetApiKey(secret)
      setHasApiKey(secret.length > 0)
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }, [])

  const clearApiKey = useCallback(async () => {
    setBusy(true)
    setLastError(null)
    try {
      await aiProviderDeleteApiKey()
      setHasApiKey(false)
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }, [])

  const proposeDraftFromPrompt = useCallback(
    async (prompt: string, currentMarkdown: string) => {
      if (provider === 'off') {
        throw new Error('AI provider is disabled')
      }
      if (!isNativeBridgeAvailable()) {
        throw new Error('AI provider requires the desktop app')
      }
      let parsedEndpoint: URL
      try {
        parsedEndpoint = new URL(endpoint)
      } catch {
        throw new Error('AI provider endpoint is not a valid URL')
      }
      const isLocalhost =
        parsedEndpoint.hostname === 'localhost' || parsedEndpoint.hostname === '127.0.0.1'
      if (parsedEndpoint.protocol !== 'https:' && !isLocalhost) {
        const message = 'AI provider endpoint must use https:// (plain http is only allowed for localhost)'
        setLastError(message)
        throw new Error(message)
      }

      const controller = new AbortController()
      abortControllersRef.current.add(controller)
      const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      try {
        return await Promise.race([
          aiProviderProposeDraft(endpoint, prompt, currentMarkdown),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener(
              'abort',
              () => reject(new Error('AI provider request timed out')),
              { once: true },
            )
          }),
        ])
      } finally {
        window.clearTimeout(timeoutId)
        abortControllersRef.current.delete(controller)
      }
    },
    [endpoint, provider],
  )

  const enabled = useMemo(() => provider !== 'off' && hasApiKey, [hasApiKey, provider])

  return {
    provider,
    endpoint,
    hasApiKey,
    enabled,
    busy,
    lastError,
    httpWarning,
    setProvider,
    setEndpoint,
    saveApiKey,
    clearApiKey,
    refreshKeyState,
    proposeDraftFromPrompt,
  }
}
