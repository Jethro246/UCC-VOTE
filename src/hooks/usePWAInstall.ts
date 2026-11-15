import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Capture early beforeinstallprompt events even before React mounts any button
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(ev: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((cb) => cb(globalDeferredPrompt));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((cb) => cb(null));
  });
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isIPhoneIPad = /iPhone|iPad|iPod/i.test(ua);
  const isIPadOS =
    navigator.platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;
  return isIPhoneIPad || isIPadOS;
}

function detectMacSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !detectIOS();
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/i.test(ua);
  return isMac && isSafari;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(detectStandalone);
  const [isIOS] = useState<boolean>(detectIOS);
  const [isMacSafari] = useState<boolean>(detectMacSafari);

  useEffect(() => {
    setIsInstalled(detectStandalone());

    const syncPrompt = (ev: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(ev);
    };
    promptListeners.add(syncPrompt);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = () => {
      setIsInstalled(detectStandalone());
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    mediaQuery.addEventListener?.('change', handleDisplayChange);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      promptListeners.delete(syncPrompt);
      mediaQuery.removeEventListener?.('change', handleDisplayChange);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const target = deferredPrompt || globalDeferredPrompt;
    if (!target) return 'unavailable';

    try {
      await target.prompt();
      const { outcome } = await target.userChoice;
      if (outcome === 'accepted') {
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
      }
      return outcome;
    } catch {
      return 'unavailable';
    }
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isMacSafari,
    install,
  };
}
