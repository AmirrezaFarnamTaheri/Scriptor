import type { AppLocale } from './i18n'
export function workspaceCopy(locale: AppLocale) {
  return locale === 'de' ? { navigation: 'Arbeitsbereiche', writing: 'Schreiben', source: 'Quelldatei', open: 'Arbeitsbereich öffnen', restore: 'Gespeicherter Tab. Zum Öffnen auswählen.', unavailable: 'Dieser Arbeitsbereich ist nicht mehr verfügbar.', main: 'Hauptarbeitsbereich', side: 'Nebenarbeitsbereich', preview: 'Notizvorschau', edit: 'Im Editor öffnen', failed: 'Notiz konnte nicht geladen werden.' }
    : locale === 'fa' ? { navigation: 'فضاهای کاری', writing: 'نوشتن', source: 'فایل منبع', open: 'باز کردن فضای کاری', restore: 'زبانه ذخیره شده است. برای باز کردن انتخاب کنید.', unavailable: 'این فضای کاری دیگر در دسترس نیست.', main: 'فضای کاری اصلی', side: 'فضای کاری کناری', preview: 'پیش‌نمایش یادداشت', edit: 'باز کردن در ویرایشگر', failed: 'یادداشت بارگیری نشد.' }
      : { navigation: 'Workspaces', writing: 'Writing', source: 'Source file', open: 'Open workspace', restore: 'Saved tab. Select it to open its workspace.', unavailable: 'This workspace is no longer available.', main: 'Main workspace', side: 'Side workspace', preview: 'Note preview', edit: 'Open in editor', failed: 'Note could not be loaded.' }
}

export function workspaceTransitionCopy(locale: AppLocale, pending: boolean, limit: boolean) {
  return locale === 'de' ? pending ? 'Änderung wird geprüft…' : limit ? 'Maximal 24 Tabs. Schließen Sie zuerst einen Tab.' : 'Die Änderung wurde nicht übernommen. Beenden Sie den Dialog oder Vorgang und versuchen Sie es erneut.'
    : locale === 'fa' ? pending ? 'در حال بررسی تغییر…' : limit ? 'حداکثر ۲۴ زبانه. ابتدا یک زبانه را ببندید.' : 'تغییر انجام نشد. پنجره یا عملیات جاری را تمام کنید و دوباره تلاش کنید.'
      : pending ? 'Reviewing workspace change…' : limit ? 'Up to 24 tabs can be open. Close a tab first.' : 'Workspace change was not applied. Finish the current dialog or operation and try again.'
}
