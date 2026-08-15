/**
 * CaptureTarget — where a captured note lands in the vault.
 *
 * Three kinds (D2):
 * - `folder`  — write to a fixed vault folder, filename derived from title.
 * - `template` — expand a template file; the template may set the folder.
 * - `active-note` — append to the currently open note (QuickAdd inline capture).
 *
 * Resolution order (for `resolveTarget`):
 * 1. Explicit `CaptureTarget` supplied by the caller.
 * 2. Per-command default registered in the command registry.
 * 3. Fallback: `folder` pointing to the vault root inbox (`00-inbox/`).
 */

export type TargetKind = 'folder' | 'template' | 'active-note'

export interface FolderTarget {
  kind: 'folder'
  /** Vault-relative folder path. Trailing slash optional. */
  folderPath: string
  /**
   * Optional filename template (supports `{{title}}`, `{{date}}`, `{{time}}`).
   * Defaults to `{{date}}-{{title}}.md`.
   */
  filenameTemplate?: string
}

export interface TemplateTarget {
  kind: 'template'
  /** Vault-relative path to the template file. */
  templatePath: string
}

export interface ActiveNoteTarget {
  kind: 'active-note'
  /**
   * Where in the active note to insert the captured content.
   * `'append'` adds to end; `'cursor'` inserts at the editor cursor position.
   */
  insertPosition: 'append' | 'cursor'
}

export type CaptureTarget = FolderTarget | TemplateTarget | ActiveNoteTarget

const INBOX_FOLDER = '00-inbox'
const DEFAULT_FILENAME_TEMPLATE = '{{date}}-{{title}}.md'

/**
 * Resolve a `CaptureTarget`, filling in defaults where the caller left gaps.
 *
 * This function is pure — no I/O. It only performs default-filling logic so
 * that callers do not need to know the fallback policy.
 */
export function resolveTarget(partial: Partial<CaptureTarget> | undefined): CaptureTarget {
  if (!partial) {
    return {
      kind: 'folder',
      folderPath: INBOX_FOLDER,
      filenameTemplate: DEFAULT_FILENAME_TEMPLATE,
    }
  }

  switch (partial.kind) {
    case 'folder':
      return {
        kind: 'folder',
        folderPath: partial.folderPath ?? INBOX_FOLDER,
        filenameTemplate: partial.filenameTemplate ?? DEFAULT_FILENAME_TEMPLATE,
      }
    case 'template':
      if (!partial.templatePath) {
        // Malformed — fall back to inbox.
        return { kind: 'folder', folderPath: INBOX_FOLDER, filenameTemplate: DEFAULT_FILENAME_TEMPLATE }
      }
      return { kind: 'template', templatePath: partial.templatePath }
    case 'active-note':
      return { kind: 'active-note', insertPosition: partial.insertPosition ?? 'append' }
    default:
      return { kind: 'folder', folderPath: INBOX_FOLDER, filenameTemplate: DEFAULT_FILENAME_TEMPLATE }
  }
}

// ── Filename resolution ───────────────────────────────────────────────────────

/** Interpolate a filename template with capture metadata. */
export function resolveFilename(template: string, title: string, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`

  // Slugify title: lowercase, replace non-alphanumeric with hyphen, trim.
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  return template
    .replace(/\{\{date\}\}/gi, date)
    .replace(/\{\{time\}\}/gi, time)
    .replace(/\{\{title\}\}/gi, slug)
}
