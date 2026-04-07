import { Component, type ErrorInfo, type ReactNode } from 'react'

type ErrorBoundaryProps = {
  fallback?: ReactNode
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-box">
            <p>This section failed to load.</p>
            <p>Try refreshing the page.</p>
          </div>
        )
      )
    }

    return this.props.children
  }
}
