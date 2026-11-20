import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { DownloadCloud, Smartphone, X, Share } from 'lucide-react';

interface PWAInstallButtonProps {
  onOpenInstallModal?: () => void;
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenInstallModal,
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Suppress install trigger when already running in standalone installed PWA mode
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted && onOpenInstallModal) {
        onOpenInstallModal();
      }
      return;
    }
    if (onOpenInstallModal) {
      onOpenInstallModal();
      return;
    }
    if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  if (isInstallable || onOpenInstallModal) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium text-sky-200 bg-sky-950/80 hover:bg-sky-900 border border-sky-600/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            : 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-sky-200 bg-sky-950/70 hover:bg-sky-900 border border-sky-600/60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
        title={
          isInstallable
            ? 'Install AcroXFA as an offline desktop or mobile web app'
            : 'Download Web App installer or install as a standalone offline PWA'
        }
      >
        <DownloadCloud className={compact ? 'w-3 h-3 text-sky-400' : 'w-3.5 h-3.5 text-sky-400'} />
        <span>{isInstallable ? 'Install App' : 'Download App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">Install AcroXFA on iOS</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <Share className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    1. Tap the <strong>Share</strong> button in the Safari toolbar.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    2. Scroll down and tap <strong>Add to Home Screen</strong>.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
