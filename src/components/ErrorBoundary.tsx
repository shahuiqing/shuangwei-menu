import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义兜底界面；不传则用默认错误提示 */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 兜底错误边界：后台面板等子组件渲染抛错时，避免整个页面白屏/黑屏。
 * 历史问题：AdminPanel 通过 React.lazy 懒加载，且应用内没有错误边界，
 * 一旦其子组件（订单/菜单等 tab）渲染抛错，React 会卸载整棵树导致黑屏。
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
    this.props.onError?.(error);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="p-6 flex flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-zinc-400">
            界面加载出错，请重试。
            <br />
            Something went wrong while rendering.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            重试 / Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
