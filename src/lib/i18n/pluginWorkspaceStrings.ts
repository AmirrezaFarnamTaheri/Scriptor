import type { AppLocale } from './index'

const en = {
  open: 'Open', opening: 'Opening workspace…', unavailable: 'Workspace permission is unavailable.',
  safeMode: 'Plugin workspaces are unavailable in safe mode.',
  consent: 'Review this plugin’s permissions in the marketplace first.',
  disabled: 'Plugin is disabled.', read: 'Plugin read permission is required.',
  vault: 'Vault is outside plugin consent scope.', identity: 'Plugin identity does not match the workspace.',
  registration: 'This workspace is not registered for the current vault.',
  failed: 'Unable to open workspace.', refused: 'Navigation was declined. Your current workspace is preserved.',
  toggleRefused: 'The module change was declined. Review its permissions before enabling it.', toggleFailed: 'The module state could not be saved.',
}
type Strings = typeof en
const de: Strings = {
  open: 'Öffnen', opening: 'Arbeitsbereich wird geöffnet…', unavailable: 'Die Berechtigung für diesen Arbeitsbereich fehlt.',
  safeMode: 'Plugin-Arbeitsbereiche sind im abgesicherten Modus nicht verfügbar.',
  consent: 'Prüfen Sie zuerst die Plugin-Berechtigungen im Marktplatz.',
  disabled: 'Das Plugin ist deaktiviert.', read: 'Die Leseberechtigung des Plugins ist erforderlich.',
  vault: 'Der Tresor liegt außerhalb der erteilten Plugin-Freigabe.', identity: 'Die Plugin-Identität stimmt nicht mit dem Arbeitsbereich überein.',
  registration: 'Dieser Arbeitsbereich ist für den aktuellen Tresor nicht registriert.',
  failed: 'Der Arbeitsbereich konnte nicht geöffnet werden.', refused: 'Der Wechsel wurde abgelehnt. Der aktuelle Arbeitsbereich bleibt erhalten.',
  toggleRefused: 'Die Moduländerung wurde abgelehnt. Prüfen Sie die Berechtigungen vor der Aktivierung.', toggleFailed: 'Der Modulstatus konnte nicht gespeichert werden.',
}
const fa: Strings = {
  open: 'باز کردن', opening: 'در حال باز کردن فضای کاری…', unavailable: 'مجوز فضای کاری در دسترس نیست.',
  safeMode: 'فضاهای کاری افزونه در حالت امن در دسترس نیستند.',
  consent: 'ابتدا مجوزهای این افزونه را در بازارچه بررسی کنید.',
  disabled: 'افزونه غیرفعال است.', read: 'مجوز خواندن افزونه لازم است.',
  vault: 'مخزن خارج از محدودهٔ مجوز افزونه است.', identity: 'شناسهٔ افزونه با فضای کاری مطابقت ندارد.',
  registration: 'این فضای کاری برای مخزن فعلی ثبت نشده است.',
  failed: 'باز کردن فضای کاری ممکن نشد.', refused: 'تغییر فضای کاری رد شد. فضای کاری فعلی حفظ شده است.',
  toggleRefused: 'تغییر ماژول رد شد. پیش از فعال‌سازی مجوزهای آن را بررسی کنید.', toggleFailed: 'ذخیرهٔ وضعیت ماژول ممکن نشد.',
}
export function pluginWorkspaceStrings(locale: AppLocale): Strings { return { en, de, fa }[locale] }

export function localizedWorkspaceReason(reason: string | null, strings: Strings): string | null {
  if (!reason) return null
  if (reason.includes('safe mode')) return strings.safeMode
  if (reason.includes('marketplace')) return strings.consent
  if (reason.includes('disabled')) return strings.disabled
  if (reason.includes('read permission')) return strings.read
  if (reason.includes('consent scope')) return strings.vault
  if (reason.includes('identity')) return strings.identity
  if (reason.includes('registered')) return strings.registration
  return strings.unavailable
}
