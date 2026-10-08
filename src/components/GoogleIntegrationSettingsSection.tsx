import { memo, useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { CalendarDays, ExternalLink, RefreshCw } from 'lucide-react'
import { useGoogleCalendarSync } from '../hooks/useGoogleCalendarSync'
import { useGoogleIntegrationAccounts } from '../hooks/useGoogleIntegrationAccounts'
import { mutateVaultConfig } from '../lib/vaultConfigMutation'
import { googleResourceOptions, mergeGoogleClientId } from '../lib/googleIntegrationSetup'
import { DEFAULT_VAULT_CONFIG } from '../lib/settingsDefaults'
import { useI18n } from '../lib/i18n'
import type { VaultConfig } from '../types/vault'

export type GoogleWorkspaceKind = 'collaboration' | 'planner' | 'gmail'
interface GoogleIntegrationSettingsSectionProps {
  config: VaultConfig
  setConfig: Dispatch<SetStateAction<VaultConfig>>
  vaultId: string
  onOpenGoogleWorkspace?: (kind: GoogleWorkspaceKind) => void
  gmailEnabled?: boolean
  workspaceLaunchDisabled?: boolean
}

/** A shared public client ID never implies shared credentials or permission. */
export const GoogleIntegrationSettingsSection = memo(function GoogleIntegrationSettingsSection({ config, setConfig, vaultId, onOpenGoogleWorkspace, gmailEnabled = true, workspaceLaunchDisabled = false }: GoogleIntegrationSettingsSectionProps) {
  const { t } = useI18n()
  const calendarSync = useGoogleCalendarSync({ config: config.calendar_sync, vaultId })
  const sync = config.calendar_sync ?? DEFAULT_VAULT_CONFIG.calendar_sync!
  const clientId = sync.google_client_id ?? ''
  const [savingConnection, setSavingConnection] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const persistClientId = useCallback(async (value: string) => {
    try {
      await mutateVaultConfig((current) => mergeGoogleClientId({ ...current, calendar_sync: { ...DEFAULT_VAULT_CONFIG.calendar_sync!, ...current.calendar_sync } }, value), vaultId)
    } catch (caught) {
      throw new Error(t('integrations.google.saveConnectionFailed', { error: caught instanceof Error ? caught.message : String(caught) }))
    }
  }, [t, vaultId])
  const accounts = useGoogleIntegrationAccounts({ vaultId, clientId, persistClientId, gmailEnabled })
  const calendarBusy = savingConnection || calendarSync.status === 'authorizing' || calendarSync.status === 'syncing'
  const setupBusy = calendarBusy || accounts.drive.busy || accounts.gmail.busy
  const calendarId = sync.google_calendar_id || 'primary'
  const taskListId = sync.google_task_list_id || '@default'
  const calendarOptions = googleResourceOptions('primary', t('integrations.google.primaryCalendar'), calendarId,
    calendarSync.calendars.map((resource) => ({ id: resource.id, label: `${resource.summary}${resource.accessRole === 'freeBusyReader' ? ` · ${t('integrations.google.busyOnly')}` : resource.writable ? '' : ` · ${t('integrations.google.readOnly')}`}` })))
  const taskOptions = googleResourceOptions('@default', t('integrations.google.defaultTaskList'), taskListId,
    calendarSync.taskLists.map((resource) => ({ id: resource.id, label: resource.title })))
  const patchSync = (patch: Partial<NonNullable<VaultConfig['calendar_sync']>>) => {
    setConfig((current) => ({ ...current, calendar_sync: { ...DEFAULT_VAULT_CONFIG.calendar_sync!, ...current.calendar_sync, ...patch } }))
  }
  const connectCalendar = async () => {
    if (!sync.enabled || !clientId.trim() || calendarBusy) return
    setSavingConnection(true)
    setSetupError(null)
    try {
      if (!await calendarSync.startAuth() || !mounted.current) return
      await mutateVaultConfig((current) => ({ ...current, calendar_sync: {
        ...DEFAULT_VAULT_CONFIG.calendar_sync!, ...current.calendar_sync,
        enabled: sync.enabled, google_client_id: clientId.trim(), google_calendar_id: sync.google_calendar_id,
        google_task_list_id: sync.google_task_list_id, lookahead_days: sync.lookahead_days,
        show_events_in_tasks: sync.show_events_in_tasks, push_vault_tasks: sync.push_vault_tasks,
        capture_note_path: sync.capture_note_path,
      } }), vaultId)
    } catch (caught) {
      if (mounted.current) setSetupError(t('integrations.google.saveConnectionFailed', { error: caught instanceof Error ? caught.message : String(caught) }))
    } finally {
      if (mounted.current) setSavingConnection(false)
    }
  }

  const accountControls = (service: 'drive' | 'gmail') => {
    const account = accounts[service]
    return <>
      <div className="calendar-sync-actions google-connection-actions">
        <span role="status">{account.email || t(`integrations.google.status.${account.status}`)}</span>
        <button type="button" className="primary-button" disabled={!clientId.trim() || account.busy} onClick={() => void accounts.connect(service)}>
          <ExternalLink size={14} aria-hidden="true" />{t(account.email ? 'integrations.google.reconnect' : 'integrations.google.connect')}
        </button>
        {account.email ? <button type="button" className="toolbar-button" disabled={account.busy} onClick={() => void accounts.disconnect(service)}>{t('integrations.google.disconnect')}</button> : null}
        <button type="button" className="toolbar-button" disabled={account.busy} onClick={() => void accounts.check(service)}>{t('integrations.google.checkConnection')}</button>
      </div>
      {account.error ? <p className="publish-error" role="alert">{account.error}</p> : null}
    </>
  }
  const workspaceButton = (kind: GoogleWorkspaceKind, label: string) => onOpenGoogleWorkspace
    ? <button type="button" className="toolbar-button" disabled={setupBusy || workspaceLaunchDisabled} title={workspaceLaunchDisabled ? t('settings.unsavedConfig') : undefined} onClick={() => onOpenGoogleWorkspace(kind)}>{t(label)}</button> : null

  return (
    <section className="settings-section google-integration-settings" aria-labelledby="google-integration-heading" data-help-topic="google">
      <div className="settings-section-heading-with-icon">
        <CalendarDays size={18} aria-hidden="true" />
        <div><h3 id="google-integration-heading">{t('integrations.google.title')}</h3><p className="health-subtitle">{t('integrations.google.description')}</p></div>
      </div>
      <div className="integration-maturity-note" role="note"><strong>{t('integrations.google.experimental')}</strong> {t('integrations.google.security')}</div>
      <label className="settings-field">{t('integrations.google.clientId')}
        <input value={clientId} placeholder="1234567890-….apps.googleusercontent.com" autoComplete="off" disabled={setupBusy} onChange={(event) => patchSync({ google_client_id: event.target.value.trim() || null })} />
      </label>
      <p className="health-subtitle">{t('integrations.google.clientHelp')}</p>
      <p className="health-subtitle">{t('integrations.google.clientLifecycle')}</p>
      <div className="settings-subgroup google-integration-fields" role="group" aria-labelledby="google-drive-heading">
        <h4 id="google-drive-heading">{t('integrations.google.driveDocs')}</h4>
        <p className="health-subtitle">{t('integrations.google.driveDocsHelp')}</p>
        {accountControls('drive')}
        {workspaceButton('collaboration', 'integrations.google.openCollaboration')}
      </div>
      <div className="settings-subgroup google-integration-fields" role="group" aria-labelledby="google-calendar-heading">
        <h4 id="google-calendar-heading">{t('integrations.google.calendarTasks')}</h4>
        <label className="diagnostics-opt-in"><input type="checkbox" checked={sync.enabled} disabled={calendarBusy} onChange={(event) => patchSync({ enabled: event.target.checked })} /><span>{t('integrations.google.enableCalendarTasks')}</span></label>
        {sync.enabled ? <>
          <div className="settings-grid google-integration-options">
            <label className="settings-field">{t('integrations.google.calendar')}<select value={calendarId} disabled={calendarBusy} onChange={(event) => patchSync({ google_calendar_id: event.target.value })}>
              {calendarOptions.map((entry) => <option key={entry.id} value={entry.id} disabled={calendarSync.calendars.some((resource) => resource.id === entry.id && resource.accessRole === 'freeBusyReader')}>{entry.label}</option>)}
            </select></label>
            <label className="settings-field">{t('integrations.google.taskList')}<select value={taskListId} disabled={calendarBusy} onChange={(event) => patchSync({ google_task_list_id: event.target.value })}>
              {taskOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select></label>
          </div>
          <p className="health-subtitle">{t('integrations.google.resourceHelp')}</p>
          <button type="button" className="toolbar-button" disabled={calendarBusy || calendarSync.discoveringResources || !calendarSync.authedEmail} onClick={() => void calendarSync.discoverResources()}>
            <RefreshCw size={14} aria-hidden="true" />{t(calendarSync.discoveringResources ? 'integrations.google.discoveringResources' : 'integrations.google.refreshResources')}
          </button>
          <details><summary>{t('integrations.google.manualResources')}</summary>
            <label className="settings-field">{t('integrations.google.calendarId')}<input value={sync.google_calendar_id ?? ''} placeholder="primary" disabled={calendarBusy} onChange={(event) => patchSync({ google_calendar_id: event.target.value.trim() || null })} /></label>
            <label className="settings-field">{t('integrations.google.taskListId')}<input value={sync.google_task_list_id ?? ''} placeholder="@default" disabled={calendarBusy} onChange={(event) => patchSync({ google_task_list_id: event.target.value.trim() || null })} /></label>
          </details>
          {calendarSync.discoveryError ? <p className="publish-error" role="alert">{calendarSync.discoveryError}</p> : null}
          <div className="settings-grid google-integration-options">
            <label className="settings-field">{t('integrations.google.lookahead')}<input type="number" min={1} max={365} value={sync.lookahead_days ?? 7} disabled={calendarBusy} onChange={(event) => patchSync({ lookahead_days: Math.min(365, Math.max(1, Number(event.target.value) || 7)) })} /></label>
            <label className="diagnostics-opt-in"><input type="checkbox" checked={sync.show_events_in_tasks} onChange={(event) => patchSync({ show_events_in_tasks: event.target.checked })} /><span>{t('integrations.google.showEvents')}</span></label>
            <label className="diagnostics-opt-in"><input type="checkbox" checked={sync.push_vault_tasks} onChange={(event) => patchSync({ push_vault_tasks: event.target.checked })} /><span>{t('integrations.google.mirrorTasks')}</span></label>
          </div>
          <div className="calendar-sync-actions google-connection-actions">
            <span role="status">{t(`integrations.google.status.${calendarSync.status}`)}{calendarSync.authedEmail ? ` · ${calendarSync.authedEmail}` : ''}</span>
            <button type="button" className="primary-button" disabled={!clientId.trim() || calendarBusy} onClick={() => void connectCalendar()}>{t(calendarSync.authedEmail ? 'integrations.google.reconnect' : 'integrations.google.connect')}</button>
            {calendarSync.authedEmail ? <>
              <button type="button" className="toolbar-button" disabled={calendarBusy} onClick={() => void calendarSync.refresh()}>{t('integrations.google.syncNow')}</button>
              <button type="button" className="toolbar-button" disabled={calendarBusy} onClick={() => void calendarSync.disconnect()}>{t('integrations.google.disconnect')}</button>
            </> : null}
          </div>
          {setupError ? <p className="publish-error" role="alert">{setupError}</p> : null}
          {calendarSync.error ? <p className="publish-error" role="alert">{calendarSync.error}</p> : null}
        </> : null}
        {workspaceButton('planner', 'integrations.google.openPlanner')}
      </div>
      <div className="settings-subgroup google-integration-fields" role="group" aria-labelledby="google-gmail-heading">
        <h4 id="google-gmail-heading">{t('integrations.gmail.title')}</h4>
        <p className="health-subtitle">{t('integrations.google.gmailNote')}</p>
        {gmailEnabled ? accountControls('gmail') : <p className="health-subtitle" role="status">{t('integrations.google.gmailDisabled')}</p>}
        {workspaceButton('gmail', 'integrations.google.openGmail')}
      </div>
    </section>
  )
})
