import { Component } from 'react';
import { TriangleAlert } from 'lucide-react';

/**
 * 攔截子樹的渲染錯誤，避免單一頁面（或單筆異常資料）讓整個 App 變成白畫面。
 * React 目前只支援以 class component 實作錯誤邊界。
 *
 * resetKey 變動時會清除錯誤狀態——切換路由後應該讓使用者能重新嘗試，
 * 而不是被卡在前一頁的錯誤畫面。
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl bg-white px-6 py-10 shadow-lg shadow-slate-200/60">
          <TriangleAlert className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="mt-4 text-lg font-bold text-slate-800">這個頁面載入時發生問題</h2>
          <p className="mt-2 text-sm text-slate-500">
            其他功能仍可正常使用。可以先切換到其他分頁，或重新整理再試一次。
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="btn-secondary btn-sm"
            >
              重試
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary btn-sm"
            >
              重新整理
            </button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-5 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-500">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}
        </div>
      </main>
    );
  }
}
