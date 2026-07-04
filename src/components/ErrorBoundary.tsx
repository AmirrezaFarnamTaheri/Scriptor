import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  /** Optional identifier shown in console/logs to pinpoint which boundary fired. */
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.name ? `[${this.props.name}]` : ''
    console.error(`ErrorBoundary ${label} caught:`, error, info.componentStack)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      this.handleReset()
    }
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    // When a navigation occurs (React Router key change or path change),
    // automatically clear the error so the new route can render.
    // This prevents users from getting stuck on a broken view.
    if (prevState.hasError && !this.state.hasError) {
      return
    }
  }

  componentDidMount() {
    // Reset on navigation so a stale error doesn't block new routes.
    window.addEventListener('popstate', this.handleReset)
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.handleReset)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            style={{
              padding: 24,
              color: 'var(--color-text-primary, #e5534b)',
              maxWidth: 600,
              margin: '40px auto',
              fontFamily: 'var(--font-sans, system-ui, sans-serif)',
              lineHeight: 1.6,
            }}
          >
            <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>
              Something went wrong
            </h2>
            <pre
              style={{
                background: 'var(--color-bg-secondary, #1a1a2e)',
                color: 'var(--color-text-secondary, #aaa)',
                padding: 12,
                borderRadius: 8,
                overflow: 'auto',
                maxHeight: 200,
                fontSize: 13,
                margin: '0 0 16px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error?.message}
            </pre>
            <button
              type="button"
              onClick={this.handleReset}
              onKeyDown={this.handleKeyDown}
              autoFocus
              style={{
                padding: '8px 20px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--color-accent, #0f766e)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Retry
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
