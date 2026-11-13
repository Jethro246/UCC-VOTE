import React from 'react';
import { Logo } from './Logo';
import { RefreshCw, Home } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage?: string;
}

export class BrandedErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="bg-[#0B1F3A] p-6 text-white text-center">
              <Logo variant="large" theme="dark" layout="stacked" showTagline />
            </div>
            <div className="p-6 sm:p-8 text-center space-y-4">
              <span className="inline-block px-3 py-1 rounded bg-red-50 border border-red-200 text-[11px] font-bold uppercase tracking-wider text-[#C62828]">
                Service Interruption Notice
              </span>
              <h1 className="text-xl font-extrabold text-slate-900">
                Portal Temporarily Unavailable
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                An unexpected rendering issue occurred while loading this UCC VOTE view. No submitted ballots or registry records were affected.
              </p>
              {this.state.errorMessage && (
                <p className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {this.state.errorMessage}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => window.location.reload()}
                  className="px-5 py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload Portal</span>
                </button>
                <button
                  onClick={() => {
                    this.setState({ hasError: false });
                  }}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Retry View</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
