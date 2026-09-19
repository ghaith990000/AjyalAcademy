import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorScreen } from './ErrorScreen'

/** The last line of defence: an error thrown while rendering shows a way out instead of a white screen. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error ?? new Error('unknown render error') }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('The app crashed while rendering', error, info.componentStack)
  }

  render() {
    return this.state.error ? <ErrorScreen error={this.state.error} /> : this.props.children
  }
}
