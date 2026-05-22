import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // no-op
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-6 rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">
          页面加载异常，请刷新后重试。
        </div>
      );
    }
    return this.props.children;
  }
}
