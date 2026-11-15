import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export const PWAUpdateBanner: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Poll hourly for updated deployments without duplicating SW registrations
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.warn('Service worker registration error:', error);
    },
  });

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {}));
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      role="alert"
      className="bg-[#0B1F3A] text-white border-b border-[#123B70] px-4 py-2.5 text-xs"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          <RefreshCw className="w-4 h-4 text-sky-300 shrink-0" />
          <span>A new version of UCC VOTE is available. Update to ensure you are using the latest release.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="px-3.5 py-1.5 rounded-lg bg-[#C62828] hover:bg-[#A61E1E] text-white font-bold text-xs cursor-pointer transition-colors"
          >
            Update Now
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            aria-label="Dismiss update notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
