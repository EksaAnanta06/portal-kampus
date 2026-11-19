// FILE: client/src/components/common/ErrorBoundary.jsx
import { Component } from 'react';
import Button from '@mui/material/Button';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';

/**
 * Menangkap error render di pohon komponen agar seluruh aplikasi tidak blank.
 * `resetKey` (mis. pathname) akan mereset state error saat berpindah halaman.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="card-surface w-full max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pasim-50 text-pasim dark:bg-pasim-900/40 dark:text-pasim-300">
            <ErrorOutlineRoundedIcon fontSize="large" />
          </div>
          <h1 className="m-0 text-xl font-bold text-slate-900 dark:text-white">Terjadi kesalahan tak terduga</h1>
          <p className="text-muted mb-4 mt-2 text-sm">
            Maaf, komponen ini gagal ditampilkan.
          </p>
          {this.state.error && (
            <div className="mb-6 max-h-60 overflow-auto rounded-xl bg-red-50 dark:bg-red-950/40 p-3.5 text-left text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
              <div className="font-mono font-bold mb-1 break-words">
                {String(this.state.error?.name || 'Error')}: {String(this.state.error?.message || this.state.error)}
              </div>
              {this.state.error?.stack && (
                <pre className="text-[10px] leading-tight whitespace-pre-wrap font-mono opacity-80 mt-1 break-all">
                  {String(this.state.error.stack)}
                </pre>
              )}
            </div>
          )}
          <div className="flex justify-center gap-3">
            <Button variant="outlined" onClick={this.handleReset}>
              Coba Lagi
            </Button>
            <Button variant="contained" onClick={() => (window.location.href = '/')}>
              Ke Beranda
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
