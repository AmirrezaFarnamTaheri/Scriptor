import type { AiProviderId } from '../hooks/useAiProvider'

interface AiProviderSettingsProps {
  provider: AiProviderId
  endpoint: string
  hasApiKey: boolean
  busy: boolean
  lastError: string | null
  onProviderChange: (provider: AiProviderId) => void
  onEndpointChange: (endpoint: string) => void
  onSaveApiKey: (secret: string) => void
  onClearApiKey: () => void
}

export function AiProviderSettings({
  provider,
  endpoint,
  hasApiKey,
  busy,
  lastError,
  onProviderChange,
  onEndpointChange,
  onSaveApiKey,
  onClearApiKey,
}: AiProviderSettingsProps) {
  return (
    <section className="settings-section">
      <h3>AI provider (optional)</h3>
      <p className="health-subtitle">
        Credentials are stored in the OS keychain. Draft proposals still require MCP write-approved approval.
      </p>
      <label>
        <span>Provider</span>
        <select value={provider} onChange={(event) => onProviderChange(event.target.value as AiProviderId)}>
          <option value="off">Off</option>
          <option value="openai-compatible">OpenAI-compatible HTTP API</option>
        </select>
      </label>
      <label>
        <span>Endpoint</span>
        <input
          type="url"
          value={endpoint}
          disabled={provider === 'off'}
          onChange={(event) => onEndpointChange(event.target.value)}
        />
      </label>
      <label>
        <span>API key</span>
        <input
          type="password"
          placeholder={hasApiKey ? 'Key stored in keychain' : 'Paste API key'}
          disabled={provider === 'off' || busy}
          onBlur={(event) => {
            const secret = event.target.value.trim()
            if (secret) {
              onSaveApiKey(secret)
              event.target.value = ''
            }
          }}
        />
      </label>
      <div className="rename-actions">
        <button type="button" className="toolbar-button" disabled={!hasApiKey || busy} onClick={onClearApiKey}>
          Clear keychain credential
        </button>
      </div>
      {lastError && <p className="preview-error">{lastError}</p>}
    </section>
  )
}
