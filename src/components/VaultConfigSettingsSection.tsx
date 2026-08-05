import type { Dispatch, SetStateAction } from 'react'

import { DEFAULT_VAULT_CONFIG } from '../lib/settingsDefaults'
import type { VaultConfig } from '../types/vault'

interface VaultConfigSettingsSectionProps {
  config: VaultConfig
  setConfig: Dispatch<SetStateAction<VaultConfig>>
  dailyNotePreview: { path: string; title: string }
  status: string
  onSave: () => Promise<void>
}

/** Owns editable vault workflow/export settings; persistence remains in SettingsPanel. */
export function VaultConfigSettingsSection({
  config,
  setConfig,
  dailyNotePreview,
  status,
  onSave,
}: VaultConfigSettingsSectionProps) {
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
      <h4 className="settings-subheading">Extra scan roots</h4>
      <p className="health-subtitle">Additional folders under the vault root to include in scans (one per line).</p>
      <textarea
        className="settings-textarea"
        rows={3}
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
      <button type="button" className="primary-button" onClick={() => void onSave()}>
        Save vault config
      </button>
      {status ? <p className="settings-status">{status}</p> : null}
    </div>
  )
}
