import { memo, type Dispatch, type SetStateAction } from 'react'

import { DEFAULT_VAULT_CONFIG } from '../lib/settingsDefaults'
import { mutateVaultConfig } from '../lib/vaultConfigMutation'
import type { VaultConfig } from '../types/vault'
import { useGoogleCalendarSync } from '../hooks/useGoogleCalendarSync'

interface VaultConfigSettingsSectionProps {
  config: VaultConfig
  setConfig: Dispatch<SetStateAction<VaultConfig>>
  dailyNotePreview: { path: string; title: string }
  status?: string
  onSave?: () => Promise<void>
}

/** Owns editable vault workflow/export settings; persistence remains in SettingsPanel. */
export const VaultConfigSettingsSection = memo(function VaultConfigSettingsSection({
  config,
  setConfig,
  dailyNotePreview,
}: VaultConfigSettingsSectionProps) {
  const calendarSync = useGoogleCalendarSync({ config: config.calendar_sync })

  const connectGoogle = async () => {
    const calendarSyncConfig = config.calendar_sync
    if (!calendarSyncConfig?.enabled || !calendarSyncConfig.google_client_id) return
    // Persist only the Calendar/Tasks config before OAuth. Other unsaved
    // Settings edits remain drafts, while external credentials can never be
    // created against a client/calendar/task-list configuration that exists
    // only in component state.
    await mutateVaultConfig((current) => ({
      ...current,
      calendar_sync: calendarSyncConfig,
    }))
    await calendarSync.startAuth()
  }

  return (
    <div className="settings-section">
      <h3>Vault config</h3>
      <p className="health-subtitle">Stored in `.scriptor/config.json` (Foam-compatible daily note paths).</p>
      <label className="settings-field">
        Daily note directory
        <input
          value={config.daily_note.directory}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              daily_note: { ...current.daily_note, directory: event.target.value },
            }))
          }
        />
      </label>
      <label className="settings-field">
        Filename format
        <input
          value={config.daily_note.filename_format}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              daily_note: { ...current.daily_note, filename_format: event.target.value },
            }))
          }
        />
      </label>
      <label className="settings-field">
        Title format
        <input
          value={config.daily_note.title_format}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              daily_note: { ...current.daily_note, title_format: event.target.value },
            }))
          }
        />
      </label>
      <p className="settings-preview" role="status">
        Today&apos;s daily note: <code>{dailyNotePreview.path}</code> — title <code>{dailyNotePreview.title}</code>
      </p>
      <label className="settings-field">
        Daily template path (optional)
        <input
          value={config.daily_note.template_path ?? ''}
          placeholder=".scriptor/templates/daily.md"
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              daily_note: {
                ...current.daily_note,
                template_path: event.target.value.trim() || null,
              },
            }))
          }
        />
      </label>
      <label className="settings-field">
        Templates directory
        <input
          value={config.templates_directory}
          onChange={(event) =>
            setConfig((current) => ({ ...current, templates_directory: event.target.value }))
          }
        />
      </label>
      <h4 className="settings-subheading">Inbox workflow</h4>
      <label className="settings-checkbox">
        <input
          type="checkbox"
          checked={config.inbox?.enabled !== false}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              inbox: { ...DEFAULT_VAULT_CONFIG.inbox!, ...current.inbox, enabled: event.target.checked },
            }))
          }
        />
        Enable inbox triage (`_organized` frontmatter)
      </label>
      <label className="settings-field">
        Inbox period
        <select
          value={config.inbox?.period ?? 'all'}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              inbox: {
                ...DEFAULT_VAULT_CONFIG.inbox!,
                ...current.inbox,
                period: event.target.value as 'week' | 'month' | 'quarter' | 'all',
              },
            }))
          }
        >
          <option value="all">All time</option>
          <option value="week">Past week</option>
          <option value="month">Past month</option>
          <option value="quarter">Past quarter</option>
        </select>
      </label>
      <label className="settings-field">
        New note directory (optional)
        <input
          value={config.inbox?.new_note_directory ?? ''}
          placeholder="inbox"
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              inbox: {
                ...DEFAULT_VAULT_CONFIG.inbox!,
                ...current.inbox,
                new_note_directory: event.target.value.trim() || null,
              },
            }))
          }
        />
      </label>
      <label className="settings-checkbox">
        <input
          type="checkbox"
          checked={config.workflow?.auto_advance_inbox_after_organize === true}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              workflow: {
                ...DEFAULT_VAULT_CONFIG.workflow!,
                ...current.workflow,
                auto_advance_inbox_after_organize: event.target.checked,
              },
            }))
          }
        />
        Auto-advance to next inbox note after organize
      </label>
      <label className="settings-field">
        Note types directory
        <input
          value={config.note_types?.directory ?? 'type'}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              note_types: { directory: event.target.value },
            }))
          }
        />
      </label>
      <h4 className="settings-subheading">Export defaults</h4>
      <p className="health-subtitle">Bibliography and CSL paths used by HTML, PDF, and DOCX profiles.</p>
      <label className="settings-field">
        Bibliography path
        <input
          value={config.export.bibliography_path}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              export: { ...current.export, bibliography_path: event.target.value },
            }))
          }
        />
      </label>
      <label className="settings-field">
        CSL style path
        <input
          value={config.export.csl_style_path}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              export: { ...current.export, csl_style_path: event.target.value },
            }))
          }
        />
      </label>
      <label className="diagnostics-opt-in">
        <input
          type="checkbox"
          checked={config.export.export_on_save?.enabled ?? false}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              export: {
                ...current.export,
                export_on_save: {
                  enabled: event.target.checked,
                  profile_id: current.export.export_on_save?.profile_id ?? 'html',
                },
              },
            }))
          }
        />
        <span>Export on save (uses profile below)</span>
      </label>
      <label className="settings-field">
        Export-on-save profile id
        <input
          value={config.export.export_on_save?.profile_id ?? ''}
          placeholder="html"
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              export: {
                ...current.export,
                export_on_save: {
                  enabled: current.export.export_on_save?.enabled ?? false,
                  profile_id: event.target.value.trim() || null,
                },
              },
            }))
          }
        />
      </label>
      <h4 className="settings-subheading">Writing targets</h4>
      <label className="settings-field">
        Daily word target
        <input
          type="number"
          min={0}
          step={50}
          value={config.writing_targets?.daily_words ?? 500}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              writing_targets: {
                ...current.writing_targets,
                daily_words: Number(event.target.value),
                history_path: current.writing_targets?.history_path ?? '.scriptor/stats-history.json',
              },
            }))
          }
        />
      </label>
      <label className="settings-field">
        Stats history path
        <input
          value={config.writing_targets?.history_path ?? '.scriptor/stats-history.json'}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              writing_targets: {
                daily_words: current.writing_targets?.daily_words ?? 500,
                history_path: event.target.value.trim() || null,
              },
            }))
          }
        />
      </label>
      <h4 className="settings-subheading">Graph groups</h4>
      <p className="health-subtitle">Tag prefix → node color (one rule per line: prefix,color).</p>
      <textarea
        className="settings-textarea"
        rows={4}
        aria-label="Graph groups rules (one tag prefix,color pair per line)"
        value={(config.graph_groups ?? []).map((group) => `${group.tag_prefix},${group.color}`).join('\n')}
        onChange={(event) => {
          const graph_groups = event.target.value
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const [tag_prefix, color] = line.split(',').map((part) => part.trim())
              return { tag_prefix: tag_prefix ?? '', color: color ?? '#888888' }
            })
            .filter((group) => group.tag_prefix.length > 0)
          setConfig((current) => ({ ...current, graph_groups }))
        }}
      />
      <h4 className="settings-subheading">Canvas collaboration</h4>
      <label className="diagnostics-opt-in">
        <input
          type="checkbox"
          checked={config.canvas?.crdt_enabled ?? false}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              canvas: { crdt_enabled: event.target.checked },
            }))
          }
        />
        <span>Enable CRDT canvas sync (localStorage op log with cross-tab merge)</span>
      </label>
      <h4 className="settings-subheading">Google Calendar &amp; Tasks sync</h4>
      <label className="diagnostics-opt-in">
        <input
          type="checkbox"
          checked={config.calendar_sync?.enabled ?? false}
          onChange={(event) =>
            setConfig((current) => ({
              ...current,
              calendar_sync: {
                ...DEFAULT_VAULT_CONFIG.calendar_sync!,
                ...current.calendar_sync,
                enabled: event.target.checked,
              },
            }))
          }
        />
        <span>Enable Google Calendar &amp; Tasks integration</span>
      </label>
      {config.calendar_sync?.enabled ? (
        <div className="settings-subgroup">
          <label className="settings-field">
            Google Client ID (OAuth2)
            <input
              value={config.calendar_sync.google_client_id ?? ''}
              placeholder="OAuth2 Client ID"
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  calendar_sync: {
                    ...DEFAULT_VAULT_CONFIG.calendar_sync!,
                    ...current.calendar_sync,
                    google_client_id: event.target.value.trim() || null,
                  },
                }))
              }
            />
          </label>
          <label className="settings-field">
            Lookahead window (days)
            <input
              type="number"
              min={1}
              max={30}
              value={config.calendar_sync.lookahead_days ?? 7}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  calendar_sync: {
                    ...DEFAULT_VAULT_CONFIG.calendar_sync!,
                    ...current.calendar_sync,
                    lookahead_days: Number(event.target.value) || 7,
                  },
                }))
              }
            />
          </label>
          <label className="diagnostics-opt-in">
            <input
              type="checkbox"
              checked={config.calendar_sync.show_events_in_tasks}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  calendar_sync: {
                    ...DEFAULT_VAULT_CONFIG.calendar_sync!,
                    ...current.calendar_sync,
                    show_events_in_tasks: event.target.checked,
                  },
                }))
              }
            />
            <span>Show Calendar events in the Tasks workspace</span>
          </label>
          <label className="diagnostics-opt-in">
            <input
              type="checkbox"
              checked={config.calendar_sync.push_vault_tasks}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  calendar_sync: {
                    ...DEFAULT_VAULT_CONFIG.calendar_sync!,
                    ...current.calendar_sync,
                    push_vault_tasks: event.target.checked,
                  },
                }))
              }
            />
            <span>Mirror open vault tasks to Google Tasks</span>
          </label>
          <div className="calendar-sync-actions">
            <span className={`publish-status publish-status-${calendarSync.status}`}>
              {calendarSync.status.toUpperCase()}
              {calendarSync.authedEmail ? ` · ${calendarSync.authedEmail}` : ''}
            </span>
            {calendarSync.status === 'disconnected' || calendarSync.status === 'error' ? (
              <button
                type="button"
                className="toolbar-button"
                onClick={() => void connectGoogle()}
                disabled={!config.calendar_sync.google_client_id}
              >
                Save Calendar config &amp; connect
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => void calendarSync.refresh()}
                  disabled={calendarSync.status === 'syncing'}
                >
                  Sync Now
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => void calendarSync.disconnect()}
                >
                  Disconnect
                </button>
              </>
            )}
            {calendarSync.error ? <small className="publish-error">{calendarSync.error}</small> : null}
          </div>
        </div>
      ) : null}
      <h4 className="settings-subheading">Extra scan roots</h4>
      <p className="health-subtitle">Additional folders under the vault root to include in scans (one per line).</p>
      <textarea
        className="settings-textarea"
        rows={3}
        aria-label="Extra scan roots (one folder path per line)"
        value={(config.extra_roots ?? []).join('\n')}
        onChange={(event) =>
          setConfig((current) => ({
            ...current,
            extra_roots: event.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
          }))
        }
      />
    </div>
  )
})
