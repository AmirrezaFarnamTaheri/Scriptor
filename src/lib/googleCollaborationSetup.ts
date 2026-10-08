export interface GoogleResource { id: string; name: string }
export interface GoogleCollaborationSetup { folderId: string; transport: 'drive_json' | 'google_docs' }

/** Legacy vault/folder-only ancestors never establish ownership for a new account. */
export function googleCollaborationMappingKey(account: string, vaultId: string, folderId: string, path: string): string {
  if (!account.trim() || account.length > 320 || /[\r\n\u0000]/.test(account)) throw new Error('Confirm the Google Drive account before caching an ancestor')
  return `scriptor:google-collaboration:v2:${JSON.stringify([account.trim().toLowerCase(), vaultId, folderId, path])}`
}

export function parseGoogleCollaborationSetup(value: unknown): GoogleCollaborationSetup {
  if (value === undefined || value === null) return { folderId: '', transport: 'drive_json' }
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Google collaboration setup')
  const config = value as Record<string, unknown>
  const folderId = config.google_drive_folder_id ?? ''
  const transport = config.google_drive_transport ?? 'drive_json'
  if (typeof folderId !== 'string' || (folderId !== '' && !/^[A-Za-z0-9_-]{1,200}$/.test(folderId))) throw new Error('Invalid saved Drive folder. Choose the folder again.')
  if (transport !== 'drive_json' && transport !== 'google_docs') throw new Error('Invalid saved Drive transport. Choose the transport again.')
  return { folderId, transport }
}

export function appendGoogleResources(previous: readonly GoogleResource[], incoming: readonly GoogleResource[]): GoogleResource[] {
  const seen = new Set<string>()
  return [...previous, ...incoming].filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  }).slice(0, 1000)
}

/** A bounded listing must make progress; never hide a partial result as complete. */
export function acceptGoogleResourcePage(requested: string | undefined, next: string | undefined, seen: Set<string>): void {
  const marker = requested ?? ''
  if (seen.has(marker) || (next !== undefined && (next === requested || seen.has(next)))) throw new Error('Google repeated a resource page. Refresh the listing.')
  if (seen.size >= 10 || (seen.size >= 9 && next !== undefined)) throw new Error('Google listing exceeds ten pages. Use a smaller folder.')
  seen.add(marker)
}

export const GOOGLE_COLLABORATION_COPY = {
  en: { saved: 'Google setup saved.', folderCreated: 'Drive folder created. Save the folder and transport to retain this selection.', bindingSaved: 'Folder and revision transport saved for this vault.', removed: 'Local credential removed. To revoke Google access, use your Google account permissions.', accountChanged: 'Google Drive account changed. Browse this account’s resources and review incoming changes again.', openVault: 'Open a vault before saving Google setup.', repeatedPage: 'Google repeated a resource page. Refresh the listing.', pageLimit: 'Google listing exceeds ten pages. Use a smaller folder.' },
  de: { saved: 'Google-Einrichtung gespeichert.', folderCreated: 'Drive-Ordner erstellt. Speichern Sie Ordner und Übertragungsart, um diese Auswahl beizubehalten.', bindingSaved: 'Ordner und Übertragungsart für diesen Tresor gespeichert.', removed: 'Lokale Zugangsdaten entfernt. Widerrufen Sie den Google-Zugriff in den Berechtigungen Ihres Google-Kontos.', accountChanged: 'Das Google-Drive-Konto wurde geändert. Durchsuchen Sie die Ressourcen dieses Kontos und prüfen Sie eingehende Änderungen erneut.', openVault: 'Öffnen Sie vor dem Speichern der Google-Einrichtung einen Tresor.', repeatedPage: 'Google hat eine Ergebnisseite wiederholt. Aktualisieren Sie die Liste.', pageLimit: 'Die Google-Liste überschreitet zehn Seiten. Verwenden Sie einen kleineren Ordner.' },
  fa: { saved: 'تنظیمات گوگل ذخیره شد.', folderCreated: 'پوشه درایو ایجاد شد. برای حفظ این انتخاب، پوشه و روش انتقال را ذخیره کنید.', bindingSaved: 'پوشه و روش انتقال برای این مخزن ذخیره شد.', removed: 'اطلاعات ورود محلی حذف شد. برای لغو دسترسی گوگل، از بخش مجوزهای حساب گوگل استفاده کنید.', accountChanged: 'حساب گوگل درایو تغییر کرد. منابع این حساب را مرور و تغییرات دریافتی را دوباره بررسی کنید.', openVault: 'پیش از ذخیره تنظیمات گوگل یک مخزن باز کنید.', repeatedPage: 'گوگل یک صفحه از نتایج را تکرار کرد. فهرست را تازه کنید.', pageLimit: 'فهرست گوگل از ده صفحه بیشتر است. پوشه کوچک‌تری انتخاب کنید.' },
}
