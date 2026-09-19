import { memo } from 'react'
import type { AiProviderId } from '../hooks/useAiProvider'
import { useI18n } from '../lib/i18n'

interface AiProviderSettingsProps {
  provider: AiProviderId
  endpoint: string
  hasApiKey: boolean
  busy: boolean
  lastError: string | null
  httpWarning?: string | null
  onProviderChange: (provider: AiProviderId) => void
  onEndpointChange: (endpoint: string) => void
  onSaveApiKey: (secret: string) => void
  onClearApiKey: () => void
}

export const AiProviderSettings = memo(function AiProviderSettings({
  provider,
  endpoint,
  hasApiKey,
  busy,
  lastError,
  httpWarning,
  onProviderChange,
  onEndpointChange,
  onSaveApiKey,
  onClearApiKey,
}: AiProviderSettingsProps) {
  const { t } = useI18n()
  return (
    <section className="settings-section">
      <h3>{t('aiSettings.title')}</h3>
      <p className="health-subtitle">
        {t('aiSettings.description')}
      </p>
      <label className="settings-field">
        <span>{t('aiSettings.provider')}</span>
        <select value={provider} onChange={(event) => onProviderChange(event.target.value as AiProviderId)}>
          <option value="off">{t('aiSettings.off')}</option>
          <option value="openai-compatible">{t('aiSettings.openaiCompatible')}</option>
        </select>
      </label>
      <label className="settings-field">
        <span>{t('aiSettings.endpoint')}</span>
        <input
          type="url"
          value={endpoint}
          disabled={provider === 'off'}
          onChange={(event) => onEndpointChange(event.target.value)}
        />
      </label>
      <label className="settings-field">
        <span>{t('aiSettings.apiKey')}</span>
        <input
          type="password"
          placeholder={hasApiKey ? t('aiSettings.keyStored') : t('aiSettings.pasteKey')}
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
          {t('aiSettings.clearCredential')}
        </button>
      </div>
      {lastError ? <p className="preview-error">{lastError}</p> : null}
      {httpWarning ? <p className="settings-status warn" role="alert">{httpWarning}</p> : null}
    </section>
  )
})

