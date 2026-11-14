/** Suggestions explain reconciliation without choosing a write direction for the user. */
export type PlannerReviewDirection = 'create' | 'pull' | 'push' | 'conflict' | 'duplicate mapping' | 'missing event' | 'equal'
const LABELS: Record<'en' | 'de' | 'fa', Record<PlannerReviewDirection, string>> = {
  en: {
    create: 'Not linked — review sending a new copy to Google',
    pull: 'Google changed — consider importing its changes',
    push: 'Vault changed — consider sending your changes',
    conflict: 'Both copies differ — review and choose a direction',
    'duplicate mapping': 'Multiple Google matches — resolve the link before syncing',
    'missing event': 'Google event missing — refresh before changing anything',
    equal: 'Both copies are already aligned',
  },
  de: {
    create: 'Noch nicht verknüpft — neue Kopie für Google prüfen',
    pull: 'Google wurde geändert — Änderungen zum Import prüfen',
    push: 'Tresor wurde geändert — Übertragung zu Google prüfen',
    conflict: 'Beide Kopien unterscheiden sich — Änderungen und Richtung prüfen',
    'duplicate mapping': 'Mehrere Google-Treffer — Zuordnung vor der Synchronisierung klären',
    'missing event': 'Google-Termin fehlt — vor Änderungen aktualisieren',
    equal: 'Beide Kopien sind bereits abgeglichen',
  },
  fa: {
    create: 'هنوز پیوندی وجود ندارد — ایجاد نسخه در گوگل را بررسی کنید',
    pull: 'نسخهٔ گوگل تغییر کرده است — دریافت تغییرات را بررسی کنید',
    push: 'نسخهٔ مخزن تغییر کرده است — ارسال تغییرات را بررسی کنید',
    conflict: 'دو نسخه متفاوت‌اند — تغییرات و جهت همگام‌سازی را بررسی کنید',
    'duplicate mapping': 'چند مورد مطابق در گوگل وجود دارد — ابتدا پیوند را اصلاح کنید',
    'missing event': 'رویداد گوگل پیدا نشد — پیش از تغییر دوباره بررسی کنید',
    equal: 'دو نسخه از قبل یکسان هستند',
  },
}
export function plannerReviewDirectionLabel(direction: string, locale: 'en' | 'de' | 'fa'): string {
  return Object.prototype.hasOwnProperty.call(LABELS.en, direction)
    ? LABELS[locale][direction as PlannerReviewDirection]
    : direction
}
