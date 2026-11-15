import React, { useState } from 'react';
import {
  Download,
  Share,
  PlusSquare,
  Smartphone,
  Monitor,
  X,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Logo } from './Logo';

interface PWAInstallButtonProps {
  variant?: 'header' | 'menu' | 'sidebar' | 'hero';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, isMacSafari, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // Automatically suppress install button once running inside an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        setJustInstalled(true);
      } else if (outcome === 'unavailable') {
        setShowGuideModal(true);
      }
      return;
    }
    setShowGuideModal(true);
  };

  if (justInstalled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>Installed</span>
      </span>
    );
  }

  const buttonClasses = (() => {
    if (variant === 'hero') {
      return `min-h-[48px] px-5 py-3 text-sm font-bold text-white bg-white/15 hover:bg-white hover:text-[#123B70] border border-white/40 backdrop-blur-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${className}`;
    }
    if (variant === 'sidebar') {
      return `w-full min-h-[40px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-[#123B70] bg-[#EAF2FA] hover:bg-[#d8e7f6] border border-[#123B70]/20 transition-colors cursor-pointer whitespace-nowrap ${className}`;
    }
    if (variant === 'menu') {
      return `w-full min-h-[44px] px-4 py-2.5 rounded-lg text-xs font-bold text-[#123B70] bg-[#EAF2FA] hover:bg-[#d8e7f6] border border-[#123B70]/20 flex items-center justify-center gap-2 transition-colors cursor-pointer ${className}`;
    }
    return `min-h-[36px] px-3 py-1.5 text-xs font-bold text-[#123B70] bg-[#EAF2FA] hover:bg-[#d9e8f8] border border-[#123B70]/20 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${className}`;
  })();

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={buttonClasses}
        aria-label="Install UCC VOTE application"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install UCC VOTE</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <Logo variant="compact" subtitle="Install App" />
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Close installation instructions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h3 id="pwa-install-guide-title" className="text-lg font-extrabold text-slate-900">
                Install UCC VOTE on Your Device
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Launch UCC VOTE directly from your home screen or applications menu in standalone mode.
              </p>
            </div>

            {isIOS ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#123B70] uppercase tracking-wider">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>iPhone &amp; iPad (Safari)</span>
                </div>
                <ol className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#123B70] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span>
                      Open this site in <strong>Safari</strong> and tap the{' '}
                      <span className="inline-flex items-center gap-1 font-semibold text-[#123B70]">
                        <Share className="w-3.5 h-3.5" /> Share
                      </span>{' '}
                      button in the browser toolbar.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#123B70] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span>
                      Scroll down the share sheet and tap{' '}
                      <span className="inline-flex items-center gap-1 font-semibold text-[#123B70]">
                        <PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen
                      </span>
                      .
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#123B70] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                      3
                    </span>
                    <span>
                      Tap <strong>Add</strong> in the top-right corner to install the UCC VOTE app icon.
                    </span>
                  </li>
                </ol>
              </div>
            ) : isMacSafari ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#123B70] uppercase tracking-wider">
                  <Monitor className="w-4 h-4 shrink-0" />
                  <span>macOS (Safari)</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  In the Safari menu bar, click <strong>File → Add to Dock…</strong> (or click the Share button in the toolbar and choose <strong>Add to Dock</strong>).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#123B70]">
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <span>Android (Chrome / Edge)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tap the browser menu (<strong>⋮</strong>) and select{' '}
                    <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#123B70]">
                    <Monitor className="w-4 h-4 shrink-0" />
                    <span>Windows &amp; macOS (Chrome / Edge)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Click the <strong>Install</strong> icon on the right side of the address bar, or open the browser menu and select{' '}
                    <strong>Install UCC VOTE</strong>.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#123B70]">
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <span>iPhone &amp; iPad (Safari)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Open in Safari, tap <strong>Share</strong>, then tap{' '}
                    <strong>Add to Home Screen</strong>.
                  </p>
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#EAF2FA] text-[11px] text-[#123B70] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                The installed app preserves full Firebase Authentication, Google Sign-In, and live Electoral Commission security.
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-[#123B70] hover:bg-[#0B1F3A] text-white text-xs font-bold cursor-pointer transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const PWAInstallBanner: React.FC = () => {
  const { isInstalled, isIOS } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('ucc_vote_install_banner_dismissed') === '1';
    } catch {
      return false;
    }
  });

  if (isInstalled || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('ucc_vote_install_banner_dismissed', '1');
    } catch {
      // Ignore storage error
    }
  };

  return (
    <section
      aria-label="Install UCC VOTE App"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6"
    >
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <img
            src="/pwa-192x192.png"
            alt="UCC VOTE App Icon"
            className="w-11 h-11 rounded-xl border border-slate-200 shrink-0 object-contain bg-white"
          />
          <div className="space-y-0.5">
            <h2 className="text-sm font-extrabold text-slate-900">
              Install UCC VOTE on Your Phone or Computer
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isIOS
                ? 'Add UCC VOTE to your iPhone or iPad Home Screen via Safari Share for instant standalone access.'
                : 'Install the official app on Android, Windows, macOS, or iPad for fast launch without opening a browser tab.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <PWAInstallButton variant="header" className="min-h-[42px] px-4 py-2" />
          <button
            type="button"
            onClick={handleDismiss}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Dismiss install banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
