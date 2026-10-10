import { useId } from 'react'
import { useI18n } from '../lib/i18n'
import type { GoogleResource } from '../lib/googleCollaborationSetup'

const COPY = {
  en: { folders: 'Choose a Drive folder', browse: 'Browse accessible folders', more: 'More folders', name: 'New folder name', create: 'Create Drive folder', select: 'Select a folder', save: 'Save folder and transport', manual: 'Shared folder ID', empty: 'No folders found on this page. Create one or enter its ID.', docs: 'Choose a Google document', browseDocs: 'Browse documents in this folder', moreDocs: 'More documents', chooseDoc: 'Select a document', emptyDocs: 'No Google documents found in this folder.' },
  de: { folders: 'Drive-Ordner auswählen', browse: 'Verfügbare Ordner durchsuchen', more: 'Weitere Ordner', name: 'Name des neuen Ordners', create: 'Drive-Ordner erstellen', select: 'Ordner auswählen', save: 'Ordner und Übertragung speichern', manual: 'ID des gemeinsamen Ordners', empty: 'Auf dieser Seite wurden keine Ordner gefunden. Erstellen Sie einen oder geben Sie seine ID ein.', docs: 'Google-Dokument auswählen', browseDocs: 'Dokumente in diesem Ordner durchsuchen', moreDocs: 'Weitere Dokumente', chooseDoc: 'Dokument auswählen', emptyDocs: 'Keine Google-Dokumente in diesem Ordner gefunden.' },
  fa: { folders: 'انتخاب پوشه درایو', browse: 'مرور پوشه‌های در دسترس', more: 'پوشه‌های بیشتر', name: 'نام پوشه جدید', create: 'ایجاد پوشه درایو', select: 'انتخاب پوشه', save: 'ذخیره پوشه و روش انتقال', manual: 'شناسه پوشه مشترک', empty: 'در این صفحه پوشه‌ای یافت نشد. پوشه‌ای ایجاد کنید یا شناسه آن را وارد کنید.', docs: 'انتخاب سند گوگل', browseDocs: 'مرور اسناد این پوشه', moreDocs: 'اسناد بیشتر', chooseDoc: 'انتخاب سند', emptyDocs: 'در این پوشه سند گوگل یافت نشد.' },
}

interface Props {
  kind: 'folders' | 'docs'
  resources: GoogleResource[] | null
  selectedId: string
  busy: boolean
  canAccess?: boolean
  hasMore: boolean
  onSelect(id: string): void
  onBrowse(next: boolean): void
  newFolderName?: string
  onNameChange?(name: string): void
  onCreate?(): void
  onSave?(): void
}

export function CollaborationResources(props: Props) {
  const { locale } = useI18n()
  const copy = COPY[locale]
  const id = useId()
  const folders = props.kind === 'folders'
  return <fieldset className="collaboration-resources">
    <legend>{folders ? copy.folders : copy.docs}</legend>
    <div className="collaboration-actions">
      <button type="button" disabled={props.busy || props.canAccess === false} onClick={() => props.onBrowse(false)}>{folders ? copy.browse : copy.browseDocs}</button>
      {props.hasMore && <button type="button" disabled={props.busy || props.canAccess === false || (props.resources?.length ?? 0) >= 1000} onClick={() => props.onBrowse(true)}>{folders ? copy.more : copy.moreDocs}</button>}
    </div>
    {props.resources && <>
      <label htmlFor={id}>{folders ? copy.folders : copy.docs}</label>
      <select id={id} value={props.resources.some(item => item.id === props.selectedId) ? props.selectedId : ''} disabled={props.busy} onChange={event => props.onSelect(event.target.value)}>
        <option value="">{folders ? copy.select : copy.chooseDoc}</option>
        {props.resources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {!props.resources.length && <p role="status">{folders ? copy.empty : copy.emptyDocs}</p>}
    </>}
    {folders && <>
      <label>{copy.manual}<input value={props.selectedId} disabled={props.busy} maxLength={200} autoComplete="off" onChange={event => props.onSelect(event.target.value.trim())} /></label>
      <label>{copy.name}<input value={props.newFolderName ?? ''} disabled={props.busy} maxLength={128} onChange={event => props.onNameChange?.(event.target.value)} /></label>
      <div className="collaboration-actions">
        <button type="button" disabled={props.busy || props.canAccess === false || !props.newFolderName?.trim()} onClick={props.onCreate}>{copy.create}</button>
        <button type="button" disabled={props.busy || !/^[A-Za-z0-9_-]{1,200}$/.test(props.selectedId)} onClick={props.onSave}>{copy.save}</button>
      </div>
    </>}
  </fieldset>
}
