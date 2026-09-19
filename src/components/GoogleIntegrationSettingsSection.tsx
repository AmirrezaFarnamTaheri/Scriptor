import { memo, useState, type Dispatch, type SetStateAction } from 'react'
import { CalendarDays, CheckCircle2, ExternalLink, Mail, RefreshCw } from 'lucide-react'

import { useGoogleCalendarSync } from '../hooks/useGoogleCalendarSync'
import { mutateVaultConfig } from '../lib/vaultConfigMutation'
import { DEFAULT_VAULT_CONFIG } from '../lib/settingsDefaults'
import { useI18n } from '../lib/i18n'
import type { VaultConfig } from '../types/vault'

interface GoogleIntegrationSettingsSectionProps {
  config: VaultConfig
  setConfig: Dispatch<SetStateAction<VaultConfig>>
}

/** Canonical Google account/configuration surface for Calendar, Tasks, and Gmail setup. */
export const GoogleIntegrationSettingsSection = memo(function GoogleIntegrationSettingsSection({
  config,
  setConfig,
}: GoogleIntegrationSettingsSectionProps) {
  const { t } = useI18n()
  const calendarSync = useGoogleCalendarSync({ config: config.calendar_sync })
  const sync = config.calendar_sync ?? DEFAULT_VAULT_CONFIG.calendar_sync!
  const clientId = sync.google_client_id ?? ''
  const [savingConnection, setSavingConnection] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  const patchSync = (patch: Partial<NonNullable<VaultConfig['calendar_sync']>>) => {
    setConfig((current) => ({
      ...current,
      calendar_sync: {
        ...DEFAULT_VAULT_CONFIG.calendar_sync!,
        ...current.calendar_sync,
        ...patch,
      },
    }))
  }

  const connectGoogle = async () => {
    if (!sync.enabled || !clientId.trim() || savingConnection) return
    setSavingConnection(true)
    setSetupError(null)
    try {
      // Persist the integration configuration before creating credentials. Other
      // vault-setting drafts remain untouched.
      await mutateVaultConfig((current) => ({ ...current, calendar_sync: sync }))
      await calendarSync.startAuth()
    } catch (caught) {
      setSetupError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSavingConnection(false)
    }
  }

  return (
    <section className="settings-section google-integration-settings" aria-labelledby="google-integration-heading">
      <div className="settings-section-heading-with-icon">
        <CalendarDays size={18} aria-hidden="true" />
        <div>
          <h3 id="google-integration-heading">{t('integrations.google.title')}</h3>
          <p className="health-subtitle">
            {t('integrations.google.description')}
          </p>
        </div>
      </div>

      <div className="integration-maturity-note" role="note">
        <strong>{t('integrations.google.experimental')}</strong> {t('integrations.google.security')}
      </div>

      <label className="diagnostics-opt-in">
        <input
          type="checkbox"
          checked={sync.enabled}
          onChange={(event) => patchSync({ enabled: event.target.checked })}
        />
        <span>{t('integrations.google.enableCalendarTasks')}</span>
      </label>

      {sync.enabled ? (
        <div className="settings-subgroup google-integration-fields">
          <label className="settings-field">
            {t('integrations.google.clientId')}
            <input
              value={clientId}
              placeholder="1234567890-….apps.googleusercontent.com"
              autoComplete="off"
              onChange={(event) => patchSync({ google_client_id: event.target.value.trim() || null })}
            />
          </label>
          <p className="health-subtitle">
            {t('integrations.google.clientHelp')}
          </p>

          <div className="settings-grid google-integration-options">
            <label className="settings-field">
              {t('integrations.google.lookahead')}
              <input
                type="number"
                min={1}
                max={365}
                value={sync.lookahead_days ?? 7}
                onChange={(event) => patchSync({ lookahead_days: Math.min(365, Math.max(1, Number(event.target.value) || 7)) })}
              />
            </label>
            <label className="diagnostics-opt-in">
              <input
                type="checkbox"
                checked={sync.show_events_in_tasks}
                onChange={(event) => patchSync({ show_events_in_tasks: event.target.checked })}
              />
              <span>{t('integrations.google.showEvents')}</span>
            </label>
            <label className="diagnostics-opt-in">
              <input
                type="checkbox"
                checked={sync.push_vault_tasks}
                onChange={(event) => patchSync({ push_vault_tasks: event.target.checked })}
              />
              <span>{t('integrations.google.mirrorTasks')}</span>
            </label>
          </div>

          <div className="calendar-sync-actions google-connection-actions">
            <span className={`publish-status publish-status-${calendarSync.status}`}>
              {calendarSync.status === 'synced' ? <CheckCircle2 size={13} aria-hidden="true" /> : null}
              {calendarSync.status.toUpperCase()}
              {calendarSync.authedEmail ? ` · ${calendarSync.authedEmail}` : ''}
            </span>
            {calendarSync.status === 'disconnected' || calendarSync.status === 'error' ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => void connectGoogle()}
                disabled={!clientId.trim() || savingConnection}
              >
                <ExternalLink size={14} aria-hidden="true" />
                {t('integrations.google.connect')}
              </button>
            ) : (
              <>
                <button type="button" className="toolbar-button" onClick={() => void calendarSync.refresh()} disabled={calendarSync.status === 'syncing'}>
                  <RefreshCw size={14} aria-hidden="true" />
                  {t('integrations.google.syncNow')}
                </button>
                <button type="button" className="toolbar-button" onClick={() => void calendarSync.disconnect()}>
                  {t('integrations.google.disconnect')}
                </button>
              </>
            )}
          </div>
          {setupError ? <p className="publish-error" role="alert">{setupError}</p> : null}
          {calendarSync.error ? <p className="publish-error" role="alert">{calendarSync.error}</p> : null}

          <div className="google-gmail-connection-note">
            <Mail size={16} aria-hidden="true" />
            <span>
              {t('integrations.google.gmailNote')}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  )
})
