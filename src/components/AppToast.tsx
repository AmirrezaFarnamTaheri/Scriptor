interface AppToastProps {
  message: string
  onDismiss: () => void
}

export function AppToast({ message, onDismiss }: AppToastProps) {
  return (
    <div className="app-toast" role="status" aria-live="polite">
      <p>{message}</p>
      <button type="button" className="icon-button" onClick={onDismiss} aria-label="Dismiss notification">
        ×
      </button>
    </div>
  )
}
