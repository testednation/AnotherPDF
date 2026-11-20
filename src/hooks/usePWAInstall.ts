import { useEffect, useState, useCallback } from 'react';
import { detectBrowserEnvironment, BrowserEnvironmentInfo } from '../utils/webAppBundleExporter';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __acroxfaDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__acroxfaDeferredInstallPrompt) {
      return window.__acroxfaDeferredInstallPrompt;
    }
    return null;
  });
  const [env, setEnv] = useState<BrowserEnvironmentInfo>(() => detectBrowserEnvironment());
  const [isInstalled, setIsInstalled] = useState<boolean>(() => env.isStandalone);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentEnv = detectBrowserEnvironment();
    setEnv(currentEnv);
    setIsInstalled(currentEnv.isStandalone);

    if (window.__acroxfaDeferredInstallPrompt) {
      setDeferredPrompt(window.__acroxfaDeferredInstallPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__acroxfaDeferredInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      window.__acroxfaDeferredInstallPrompt = null;
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const activePrompt = deferredPrompt || window.__acroxfaDeferredInstallPrompt;
    if (!activePrompt) return false;
    await activePrompt.prompt();
    const { outcome } = await activePrompt.userChoice;
    if (outcome === 'accepted') {
      window.__acroxfaDeferredInstallPrompt = null;
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS: env.os === 'ios',
    env,
    install,
  };
}
