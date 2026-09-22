import { memo, type Dispatch, type SetStateAction } from 'react'

import { DEFAULT_VAULT_CONFIG } from '../lib/settingsDefaults'
import type { VaultConfig } from '../types/vault'
import { useI18n } from '../lib/i18n'

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
  const { t } = useI18n()
  return (
    <div className="settings-section">
      <h3>{t('settings.vaultConfig')}</h3>
      <p className="health-subtitle">{t('settings.vaultConfigStored')}</p>
      <label className="settings-field">
        {t('settings.dailyNoteDirectory')}
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
        {t('settings.filenameFormat')}
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
        {t('settings.titleFormat')}
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
        {t('settings.dailyNotePreview', { path: dailyNotePreview.path, title: dailyNotePreview.title })}
      </p>
      <label className="settings-field">
        {t('settings.dailyTemplatePath')}
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
        {t('settings.templatesDirectory')}
        <input
          value={config.templates_directory}
          onChange={(event) =>
            setConfig((current) => ({ ...current, templates_directory: event.target.value }))
          }
        />
      </label>
      <h4 className="settings-subheading">{t('settings.inboxWorkflow')}</h4>
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
        {t('settings.enableInboxTriage')}
      </label>
      <label className="settings-field">
        {t('settings.inboxPeriod')}
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
          <option value="all">{t('settings.inboxPeriods.all')}</option>
          <option value="week">{t('settings.inboxPeriods.week')}</option>
          <option value="month">{t('settings.inboxPeriods.month')}</option>
          <option value="quarter">{t('settings.inboxPeriods.quarter')}</option>
        </select>
      </label>
      <label className="settings-field">
        {t('settings.newNoteDirectory')}
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
        {t('settings.autoAdvance')}
      </label>
      <label className="settings-field">
        {t('settings.noteTypesDirectory')}
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
      <h4 className="settings-subheading">{t('settings.exportDefaults')}</h4>
      <p className="health-subtitle">{t('settings.exportDefaultsDescription')}</p>
      <label className="settings-field">
        {t('settings.bibliographyPath')}
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
        {t('settings.cslStylePath')}
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
        <span>{t('settings.exportOnSave')}</span>
      </label>
      <label className="settings-field">
        {t('settings.exportOnSaveProfile')}
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
      <h4 className="settings-subheading">{t('settings.writingTargets')}</h4>
      <label className="settings-field">
        {t('settings.dailyWordTarget')}
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
        {t('settings.statsHistoryPath')}
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
      <h4 className="settings-subheading">{t('settings.graphGroups')}</h4>
      <p className="health-subtitle">{t('settings.graphGroupsDescription')}</p>
      <textarea
        className="settings-textarea"
        rows={4}
        aria-label={t('settings.graphGroups')}
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
      <h4 className="settings-subheading">{t('settings.canvasCollaboration')}</h4>
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
        <span>{t('settings.enableCrdtSync')}</span>
      </label>
      <h4 className="settings-subheading">{t('settings.extraScanRoots')}</h4>
      <p className="health-subtitle">{t('settings.extraScanRootsDescription')}</p>
      <textarea
        className="settings-textarea"
        rows={3}
        aria-label={t('settings.extraScanRoots')}
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
