import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, MoreHorizontal, Settings2, X } from 'lucide-react'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import type { AppLocale } from '../../lib/i18n'
import { defaultWorkspaceShortcutPreferences, getWorkspaceShortcutItems, type WorkspaceShortcutItem, type WorkspaceShortcutPreferences } from '../../lib/workspaceShortcuts'
import { ToolbarPopover } from '../ToolbarPopover'
import './workspace-shortcuts.css'

const COPY = {
  en: { navigation: 'Workspaces', customize: 'Customize workspace shortcuts', more: 'More workspaces', visible: 'Show workspace shortcut row', include: 'Include shortcut', pin: 'Pin to row', name: 'Button name', width: 'Width', size: 'Text size', auto: 'Auto', up: 'Move up', down: 'Move down', reset: 'Reset defaults', save: 'Save', cancel: 'Cancel', close: 'Close', unavailable: 'Unavailable', description: 'Choose shortcuts and their order. Unpinned shortcuts appear in More workspaces. All workspaces remain available through the command palette.', dimensions: 'Width: Auto or 64–320 px. Text size: 11–18 px.', error: 'Could not save workspace shortcuts. Your changes are still here; try again or cancel.' },
  de: { navigation: 'Arbeitsbereiche', customize: 'Arbeitsbereich-Verknüpfungen anpassen', more: 'Weitere Arbeitsbereiche', visible: 'Arbeitsbereich-Verknüpfungsleiste anzeigen', include: 'Verknüpfung aufnehmen', pin: 'In Leiste anheften', name: 'Schaltflächenname', width: 'Breite', size: 'Textgröße', auto: 'Automatisch', up: 'Nach oben', down: 'Nach unten', reset: 'Standard wiederherstellen', save: 'Speichern', cancel: 'Abbrechen', close: 'Schließen', unavailable: 'Nicht verfügbar', description: 'Verknüpfungen und Reihenfolge auswählen. Nicht angeheftete Verknüpfungen erscheinen unter Weitere Arbeitsbereiche. Alle Arbeitsbereiche bleiben über die Befehlspalette erreichbar.', dimensions: 'Breite: Automatisch oder 64–320 px. Textgröße: 11–18 px.', error: 'Die Verknüpfungen konnten nicht gespeichert werden. Ihre Änderungen sind noch vorhanden; erneut versuchen oder abbrechen.' },
  fa: { navigation: 'فضاهای کاری', customize: 'سفارشی‌سازی میانبرهای فضای کاری', more: 'فضاهای کاری بیشتر', visible: 'نمایش ردیف میانبرهای فضای کاری', include: 'افزودن میانبر', pin: 'سنجاق به ردیف', name: 'نام دکمه', width: 'عرض', size: 'اندازه متن', auto: 'خودکار', up: 'انتقال به بالا', down: 'انتقال به پایین', reset: 'بازنشانی پیش‌فرض‌ها', save: 'ذخیره', cancel: 'انصراف', close: 'بستن', unavailable: 'در دسترس نیست', description: 'میانبرها و ترتیب آن‌ها را انتخاب کنید. میانبرهای سنجاق‌نشده در فضاهای کاری بیشتر نمایش داده می‌شوند. همه فضاهای کاری از طریق پالت فرمان در دسترس می‌مانند.', dimensions: 'عرض: خودکار یا ۶۴ تا ۳۲۰ پیکسل. اندازه متن: ۱۱ تا ۱۸ پیکسل.', error: 'ذخیره میانبرها انجام نشد. تغییرات شما محفوظ است؛ دوباره تلاش کنید یا انصراف دهید.' },
} satisfies Record<AppLocale, Record<string, string>>

interface ShortcutCommand { id: string; label: string; disabled?: boolean; run(): void }
interface Props {
  catalog: ShortcutCommand[]
  preferences: WorkspaceShortcutPreferences
  open: boolean
  onOpen(): void
  onClose(): void
  onSave(preferences: WorkspaceShortcutPreferences): boolean
  locale: AppLocale
}

function shortcutStyle(item: WorkspaceShortcutItem): CSSProperties {
  return { width: item.width || undefined, fontSize: item.fontSize }
}

function ShortcutManager({ catalog, preferences, onClose, onSave, locale }: Omit<Props, 'open' | 'onOpen'>) {
  const copy = COPY[locale]
  const ids = catalog.map(command => command.id)
  const [draft, setDraft] = useState<WorkspaceShortcutPreferences>(() => ({ ...preferences, items: getWorkspaceShortcutItems(preferences, ids).map(item => ({ ...item })) }))
  const [error, setError] = useState(false)
  const dialogRef = useRef<HTMLFormElement>(null)
  const visibilityRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const boundsId = useId()
  useEscapeToClose(true, onClose)
  useFocusTrap(dialogRef, { active: true, initialFocus: () => visibilityRef.current })
  useEffect(() => {
    const opener = document.activeElement
    return () => {
      // Run after the trap's cleanup and any Escape restoration. Hiding the row
      // removes its gear button, so focus must move to a surviving workspace control.
      window.requestAnimationFrame(() => {
        if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected && opener.getClientRects().length > 0) return
        const selectors = ['button.command-search', '.workspace-writing-leaf .cm-content', '.workspace-leaf-dock .cm-content', '.editor-surface textarea', '.workspace-leaf-dock button']
        for (const selector of selectors) {
          const target = [...document.querySelectorAll<HTMLElement>(selector)].find(element => element.getClientRects().length > 0 && !element.closest('[hidden]') && !element.matches(':disabled'))
          if (target) { target.focus({ preventScroll: true }); break }
        }
      })
    }
  }, [])
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])
  const patch = (id: string, update: Partial<WorkspaceShortcutItem>) => setDraft(current => ({ ...current, items: current.items.map(item => item.id === id ? { ...item, ...update } : item) }))
  const move = (id: string, direction: number) => {
    setDraft(current => {
      const index = current.items.findIndex(item => item.id === id)
      const destination = index + direction
      if (destination < 0 || destination >= current.items.length) return current
      const items = [...current.items]
      ;[items[index], items[destination]] = [items[destination], items[index]]
      return { ...current, items }
    })
    // The clicked arrow becomes disabled at a boundary. Keep keyboard focus on
    // an enabled control in the moved item after React commits the new order.
    window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLInputElement>(`[data-shortcut-id="${CSS.escape(id)}"] input[type="text"]`)?.focus())
  }
  return createPortal(
    <div className="modal-backdrop workspace-shortcut-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <form ref={dialogRef} className="unified-panel-shell workspace-shortcut-manager" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} data-help-topic="workspace" dir={locale === 'fa' ? 'rtl' : 'ltr'} onSubmit={event => {
        event.preventDefault()
        if (onSave(draft)) onClose()
        else setError(true)
      }}>
        <header className="unified-panel-header">
          <h2 id={titleId}>{copy.customize}</h2>
          <button type="button" className="workspace-shortcut-icon" aria-label={copy.close} title={copy.close} onClick={onClose}><X size={16} aria-hidden="true" /></button>
        </header>
        <div className="unified-panel-body workspace-shortcut-settings">
          <p id={descriptionId}>{copy.description}</p>
          <label className="workspace-shortcut-checkbox"><input ref={visibilityRef} type="checkbox" checked={draft.visible} onChange={event => setDraft(current => ({ ...current, visible: event.target.checked }))} />{copy.visible}</label>
          <p id={boundsId} className="workspace-shortcut-hint">{copy.dimensions}</p>
          <div className="workspace-shortcut-items">
            {draft.items.map((item, index) => {
              const command = catalog.find(entry => entry.id === item.id)
              if (!command) return null
              return <fieldset key={item.id} data-shortcut-id={item.id} className="workspace-shortcut-entry">
                <legend>{command.label}{command.disabled ? ` (${copy.unavailable})` : ''}</legend>
                <div className="workspace-shortcut-entry-flags">
                  <label className="workspace-shortcut-checkbox"><input type="checkbox" checked={item.shown} onChange={event => patch(item.id, { shown: event.target.checked })} />{copy.include}</label>
                  <label className="workspace-shortcut-checkbox"><input type="checkbox" checked={item.pinned} onChange={event => patch(item.id, { pinned: event.target.checked })} />{copy.pin}</label>
                  <div className="workspace-shortcut-order">
                    <button type="button" className="workspace-shortcut-icon" aria-label={copy.up} title={copy.up} disabled={index === 0} onClick={() => move(item.id, -1)}><ArrowUp size={16} aria-hidden="true" /></button>
                    <button type="button" className="workspace-shortcut-icon" aria-label={copy.down} title={copy.down} disabled={index === draft.items.length - 1} onClick={() => move(item.id, 1)}><ArrowDown size={16} aria-hidden="true" /></button>
                  </div>
                </div>
                <div className="workspace-shortcut-fields">
                  <label className="workspace-shortcut-name">{copy.name}<input type="text" value={item.label} maxLength={80} placeholder={command.label} onChange={event => patch(item.id, { label: event.target.value })} /></label>
                  <label>{copy.width}<input type="number" min={64} max={320} step={1} value={item.width || ''} placeholder={copy.auto} aria-describedby={boundsId} onChange={event => patch(item.id, { width: event.target.value === '' ? 0 : Number(event.target.value) })} /></label>
                  <label>{copy.size}<input type="number" min={11} max={18} step={1} required value={item.fontSize || ''} aria-describedby={boundsId} onChange={event => patch(item.id, { fontSize: event.target.value === '' ? 0 : Number(event.target.value) })} /></label>
                </div>
              </fieldset>
            })}
          </div>
        </div>
        <footer className="unified-panel-footer workspace-shortcut-footer">
          {error && <p className="workspace-shortcut-error" role="alert">{copy.error}</p>}
          <button type="button" onClick={() => { setDraft({ ...defaultWorkspaceShortcutPreferences(), items: getWorkspaceShortcutItems(defaultWorkspaceShortcutPreferences(), ids) }); setError(false) }}>{copy.reset}</button>
          <button type="button" onClick={onClose}>{copy.cancel}</button>
          <button type="submit" className="workspace-shortcut-save">{copy.save}</button>
        </footer>
      </form>
    </div>, document.body,
  )
}

export function WorkspaceShortcutBar({ catalog, preferences, open, onOpen, onClose, onSave, locale }: Props) {
  const copy = COPY[locale]
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const triggerId = useId()
  const items = getWorkspaceShortcutItems(preferences, catalog.map(command => command.id)).filter(item => item.shown)
  const pinned = items.filter(item => item.pinned)
  const overflow = items.filter(item => !item.pinned)
  const menuVisible = moreOpen && preferences.visible && !open && overflow.length > 0
  const closeManager = () => { setMoreOpen(false); onClose() }
  const shortcut = (item: WorkspaceShortcutItem, inMenu: boolean) => {
    const command = catalog.find(entry => entry.id === item.id)
    if (!command) return null
    const label = item.label || command.label
    return <button type="button" role={inMenu ? 'menuitem' : undefined} key={item.id} disabled={command.disabled} title={command.disabled ? `${label} (${copy.unavailable})` : label} aria-label={label} className="workspace-shortcut-button" style={shortcutStyle(item)} onClick={() => { setMoreOpen(false); command.run() }}><span>{label}</span></button>
  }
  return <>
    {preferences.visible && <nav className="workspace-activity-bar workspace-shortcut-bar" aria-label={copy.navigation} dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      {pinned.map(item => shortcut(item, false))}
      {overflow.length > 0 && <button ref={moreRef} id={triggerId} type="button" className="workspace-shortcut-more" aria-label={copy.more} title={copy.more} aria-haspopup="menu" aria-expanded={menuVisible} aria-controls={menuVisible ? menuId : undefined} onClick={() => setMoreOpen(!menuVisible)} onKeyDown={event => {
        if (event.key !== 'ArrowDown') return
        event.preventDefault()
        setMoreOpen(true)
      }}><MoreHorizontal size={16} aria-hidden="true" /><span>{copy.more}</span></button>}
      <button type="button" className="workspace-shortcut-icon" aria-label={copy.customize} title={copy.customize} onClick={() => { setMoreOpen(false); onOpen() }}><Settings2 size={16} aria-hidden="true" /></button>
    </nav>}
    <ToolbarPopover open={menuVisible} id={menuId} className="workspace-shortcut-overflow" triggerRef={moreRef} labelledBy={triggerId} onClose={() => setMoreOpen(false)}>
      {overflow.map(item => <li role="none" key={item.id}>{shortcut(item, true)}</li>)}
    </ToolbarPopover>
    {open && <ShortcutManager catalog={catalog} preferences={preferences} onClose={closeManager} onSave={onSave} locale={locale} />}
  </>
}
