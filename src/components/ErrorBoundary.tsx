import {
  Component,
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
} from 'react'
import { CircleAlert, RotateCcw } from 'lucide-react'

import { PanelErrorFallback } from './PanelErrorFallback'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  /** Optional identifier shown in console/logs to pinpoint which boundary fired. */
  name?: string
  /** When any value in this array changes, a caught error is cleared so children can re-render. */
  resetKeys?: unknown[]
  /** Set false when retrying would reuse a rejected lazy-module loader. */
  autoRetryPanelFallback?: boolean
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
    if (
      import.meta.env.VITE_E2E_MODE === 'true' &&
      this.props.name === 'markdown-editor' &&
      window.sessionStorage.getItem('e2e:editor-render-failure') === '1'
    ) {
      window.sessionStorage.setItem('e2e:editor-render-failure', 'consumed')
    }
    this.setState({ hasError: false, error: null })
  }

  componentDidUpdate(prevProps: Props) {
    // When a navigation occurs (route key or path change surfaced via resetKeys),
    // automatically clear the error so the new view can render.
    // This prevents users from getting stuck on a broken view.
    if (!this.state.hasError) return
    const prevKeys = prevProps.resetKeys
    const nextKeys = this.props.resetKeys
    if (prevKeys === nextKeys) return
    const changed =
      !prevKeys ||
      !nextKeys ||
      prevKeys.length !== nextKeys.length ||
      nextKeys.some((key, index) => !Object.is(key, prevKeys[index]))
    if (changed) {
      this.handleReset()
    }
  }

  componentDidMount() {
    // Reset on navigation so a stale error doesn't block new routes.
    window.addEventListener('popstate', this.handleReset)
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.handleReset)
  }

  private renderCustomFallback(): ReactNode {
    const fallback = this.props.fallback
    if (!isValidElement(fallback) || fallback.type !== PanelErrorFallback) {
      return fallback
    }

    const panelFallback = fallback as ReactElement<ComponentProps<typeof PanelErrorFallback>>
    if (this.props.autoRetryPanelFallback === false && !panelFallback.props.onRetry) {
      return panelFallback
    }
    return cloneElement(panelFallback, {
      onRetry: () => {
        panelFallback.props.onRetry?.()
        this.handleReset()
      },
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.renderCustomFallback()

      return (
        <section role="alert" aria-live="assertive" aria-atomic="true" className="error-boundary">
          <span className="error-boundary-mark" aria-hidden="true">
            <CircleAlert />
          </span>
          <div className="error-boundary-content">
            <h2>Something went wrong</h2>
            <p>This surface stopped unexpectedly. Retry it without reloading the rest of your workspace.</p>
            <pre>{this.state.error?.message}</pre>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            autoFocus
            className="primary-button error-boundary-retry"
          >
            <RotateCcw aria-hidden="true" />
            Retry
          </button>
        </section>
      )
    }
    return this.props.children
  }
}
