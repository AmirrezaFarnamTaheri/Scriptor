export interface EscapeKeyEvent {
  key: string
  preventDefault(): void
  stopPropagation(): void
  stopImmediatePropagation(): void
}

export interface FocusRestorer {
  readonly isConnected?: boolean
  focus(options?: FocusOptions): void
}

interface EscapeSurface {
  id: symbol
  onClose: () => void
  restoreFocus: FocusRestorer | null
}

interface KeyTarget {
  addEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void, options?: boolean | AddEventListenerOptions): void
  removeEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void, options?: boolean | EventListenerOptions): void
}

export class OverlayEscapeCoordinator {
  private readonly surfaces: EscapeSurface[] = []
  private listening = false
  private readonly target: KeyTarget | null
  private readonly schedule: (callback: () => void) => void

  constructor(
    target: KeyTarget | null,
    schedule: (callback: () => void) => void = (callback) => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => callback())
      else queueMicrotask(callback)
    },
  ) {
    this.target = target
    this.schedule = schedule
  }

  register(onClose: () => void, restoreFocus: FocusRestorer | null = null): () => void {
    const surface: EscapeSurface = { id: Symbol('escape-surface'), onClose, restoreFocus }
    this.surfaces.push(surface)
    this.ensureListening()
    return () => {
      const index = this.surfaces.findIndex((entry) => entry.id === surface.id)
      if (index >= 0) this.surfaces.splice(index, 1)
      this.stopListeningIfIdle()
    }
  }

  handleEscape(event: EscapeKeyEvent): boolean {
    if (event.key !== 'Escape') return false
    const top = this.surfaces.at(-1)
    if (!top) return false

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    top.onClose()
    this.schedule(() => this.restoreFocus(top.restoreFocus))
    return true
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.handleEscape(event)
  }

  private ensureListening(): void {
    if (this.listening || !this.target || this.surfaces.length === 0) return
    this.target.addEventListener('keydown', this.onKeyDown, true)
    this.listening = true
  }

  private stopListeningIfIdle(): void {
    if (!this.listening || !this.target || this.surfaces.length > 0) return
    this.target.removeEventListener('keydown', this.onKeyDown, true)
    this.listening = false
  }

  private restoreFocus(target: FocusRestorer | null): void {
    if (!target || target.isConnected === false) return
    target.focus({ preventScroll: true })
  }
}

export const overlayEscapeCoordinator = new OverlayEscapeCoordinator(
  typeof window === 'undefined' ? null : window,
)
