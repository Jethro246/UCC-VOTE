import React from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const ConnectivityBanner: React.FC = () => {
  const { isOnline, justReconnected } = useOnlineStatus();

  if (isOnline && !justReconnected) {
    return null;
  }

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-950"
      >
        <div className="max-w-7xl mx-auto flex items-center gap-2.5 font-medium">
          <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>You are offline.</strong> Public portal pages remain viewable, but sign-in, voter eligibility verification, ballot submission, and live results require an active internet connection.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 text-sm text-emerald-900"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-2.5 font-semibold">
        <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>
          Connection restored — Live Firebase authentication, eligibility, and voting services are back online.
        </span>
      </div>
    </div>
  );
};
