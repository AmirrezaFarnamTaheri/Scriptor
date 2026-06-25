import { useCallback, useEffect, useMemo, useState } from 'react'

import { keychainDeleteSecret, keychainGetSecret, keychainSetSecret } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'

export type AiProviderId = 'openai-compatible' | 'off'

const PROVIDER_KEY = 'scriptor.ai.provider'
const ENDPOINT_KEY = 'scriptor.ai.endpoint'
const KEYCHAIN_ACCOUNT = 'ai.openai-compatible.api_key'

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

  const refreshKeyState = useCallback(async () => {
    if (!isNativeBridgeAvailable()) {
      setHasApiKey(false)
      return
    }
    const secret = await keychainGetSecret(KEYCHAIN_ACCOUNT)
    setHasApiKey(Boolean(secret))
  }, [])

  useEffect(() => {
    void refreshKeyState()
  }, [refreshKeyState])

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
      await keychainSetSecret(KEYCHAIN_ACCOUNT, secret)
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
      await keychainDeleteSecret(KEYCHAIN_ACCOUNT)
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
      const apiKey = await keychainGetSecret(KEYCHAIN_ACCOUNT)
      if (!apiKey) {
        throw new Error('Add an API key in Settings before using AI draft proposals')
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You rewrite Markdown notes. Return only the updated Markdown body with no commentary.',
            },
            {
              role: 'user',
              content: `Current note:\n\n${currentMarkdown}\n\nInstruction:\n${prompt}`,
            },
          ],
          temperature: 0.2,
        }),
      })

      if (!response.ok) {
        throw new Error(`AI provider request failed (${response.status})`)
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const proposed = payload.choices?.[0]?.message?.content?.trim()
      if (!proposed) {
        throw new Error('AI provider returned an empty draft')
      }
      return proposed
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
    setProvider,
    setEndpoint,
    saveApiKey,
    clearApiKey,
    refreshKeyState,
    proposeDraftFromPrompt,
  }
}
