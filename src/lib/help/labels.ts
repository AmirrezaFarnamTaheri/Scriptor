const en = {
  title: 'Help & guides', search: 'Search guides and questions', category: 'Guide category', all: 'All categories',
  guide: 'Guide', tour: 'Tour', questions: 'Questions & answers', close: 'Close help', back: 'Back', next: 'Next',
  start: 'Start tour', resume: 'Resume tour', restart: 'Restart tour', finish: 'Finish tour', read: 'Walkthrough read',
  entry: 'Where to open', prerequisite: 'Before you start', safety: 'Scope and consequences', related: 'Related guides',
  locate: 'Show this control', missing: 'This control is not currently visible. Open the feature using the route above; Help will not enable it or run an action for you.',
  returnHint: 'Show this control closes Help without clicking the control. Press F1 to return and resume.',
  noResults: 'No matching guides. Try a feature name, a shorter phrase, or another category.', results: 'Matching guides',
reset: 'Reset guide progress', resetAsk: 'Reset all guide progress? Notes, accounts, and application settings will not change.',
  confirmReset: 'Reset help only', experimental: 'Experimental', cancel: 'Cancel', storage: 'Help preferences cannot be saved reliably. Guidance still works for this session.',
  offline: 'Offline product guidance. Searches stay here; no notes or credentials are read or sent.',
  language: 'Detailed guides are currently authored in English. Help controls follow your language preference.',
step: 'Step', of: 'of', newHere: 'New here?', firstOpen: 'A short guide is available for this feature.', openGuide: 'Open guide', notNow: 'Not now',

}
export type HelpLabels = { [Key in keyof typeof en]: string }
const de: HelpLabels = {
  title: 'Hilfe & Anleitungen', search: 'Anleitungen und Fragen durchsuchen', category: 'Kategorie', all: 'Alle Kategorien',
  guide: 'Anleitung', tour: 'Tour', questions: 'Fragen & Antworten', close: 'Hilfe schließen', back: 'Zurück', next: 'Weiter',
  start: 'Tour starten', resume: 'Tour fortsetzen', restart: 'Tour neu starten', finish: 'Tour abschließen', read: 'Anleitung gelesen',
  entry: 'Hier öffnen', prerequisite: 'Vorbereitung', safety: 'Umfang und Folgen', related: 'Verwandte Anleitungen',
  locate: 'Dieses Steuerelement zeigen', missing: 'Dieses Steuerelement ist derzeit nicht sichtbar. Öffnen Sie die Funktion über den beschriebenen Weg. Die Hilfe aktiviert nichts und führt keine Aktion aus.',
  returnHint: 'Anzeigen schließt die Hilfe, ohne das Steuerelement anzuklicken. Mit F1 kehren Sie zur Tour zurück.',
  noResults: 'Keine passende Anleitung. Versuchen Sie einen Funktionsnamen, einen kürzeren Begriff oder eine andere Kategorie.', results: 'Passende Anleitungen',
reset: 'Anleitungsfortschritt zurücksetzen', resetAsk: 'Gesamten Anleitungsfortschritt zurücksetzen? Notizen, Konten und Anwendungseinstellungen bleiben unverändert.',
  confirmReset: 'Nur Hilfe zurücksetzen', experimental: 'Experimentell', cancel: 'Abbrechen', storage: 'Hilfe-Einstellungen können nicht zuverlässig gespeichert werden. Die Hilfe funktioniert in dieser Sitzung weiterhin.',
  offline: 'Offline-Produkthilfe. Suchanfragen bleiben hier; Notizen und Zugangsdaten werden weder gelesen noch gesendet.',
  language: 'Ausführliche Anleitungen sind derzeit auf Englisch. Die Bedienelemente folgen Ihrer Spracheinstellung.',
step: 'Schritt', of: 'von', newHere: 'Neu hier?', firstOpen: 'Für diese Funktion ist eine kurze Anleitung verfügbar.', openGuide: 'Anleitung öffnen', notNow: 'Nicht jetzt',

}
const fa: HelpLabels = {
  title: 'راهنما و آموزش', search: 'جست‌وجوی راهنماها و پرسش‌ها', category: 'دستهٔ راهنما', all: 'همهٔ دسته‌ها',
  guide: 'راهنما', tour: 'آموزش گام‌به‌گام', questions: 'پرسش و پاسخ', close: 'بستن راهنما', back: 'قبلی', next: 'بعدی',
  start: 'شروع آموزش', resume: 'ادامهٔ آموزش', restart: 'شروع دوباره', finish: 'پایان آموزش', read: 'آموزش خوانده شد',
  entry: 'مسیر دسترسی', prerequisite: 'پیش‌نیازها', safety: 'دامنه و پیامدها', related: 'راهنماهای مرتبط',
  locate: 'نمایش این کنترل', missing: 'این کنترل اکنون دیده نمی‌شود. قابلیت را از مسیر بالا باز کنید؛ راهنما چیزی را فعال نمی‌کند و هیچ عملیاتی انجام نمی‌دهد.',
  returnHint: 'نمایش کنترل، راهنما را می‌بندد اما روی کنترل کلیک نمی‌کند. برای بازگشت و ادامه F1 را بزنید.',
  noResults: 'راهنمایی پیدا نشد. نام قابلیت، عبارت کوتاه‌تر یا دستهٔ دیگری را امتحان کنید.', results: 'راهنماهای مرتبط',
reset: 'بازنشانی پیشرفت راهنماها', resetAsk: 'پیشرفت همهٔ راهنماها بازنشانی شود؟ یادداشت‌ها، حساب‌ها و تنظیمات برنامه تغییر نمی‌کنند.',
  confirmReset: 'فقط راهنما بازنشانی شود', experimental: 'آزمایشی', cancel: 'انصراف', storage: 'ذخیرهٔ تنظیمات راهنما مطمئن نیست. راهنما در این نشست همچنان کار می‌کند.',
  offline: 'راهنمای آفلاین برنامه؛ جست‌وجوها همین‌جا می‌مانند و هیچ یادداشت یا اطلاعات ورود خوانده یا ارسال نمی‌شود.',
  language: 'متن تفصیلی راهنماها فعلاً انگلیسی است. کنترل‌های راهنما از زبان انتخابی شما پیروی می‌کنند.',
step: 'گام', of: 'از', newHere: 'اولین بار است؟', firstOpen: 'برای این قابلیت یک راهنمای کوتاه در دسترس است.', openGuide: 'باز کردن راهنما', notNow: 'فعلاً نه',

}
export function helpLabels(locale: string): HelpLabels { return locale === 'fa' ? fa : locale === 'de' ? de : en }
