import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Globe,
  ExternalLink,
  CheckCircle2,
  Copy,
  Download,
  DownloadCloud,
  Terminal,
  Play,
  Sliders,
  X,
  FileCode,
  FileText,
  Link2,
  Laptop,
  Puzzle,
  Share,
  Smartphone,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  PdfProtocolSettings,
  ProtocolScheme,
  registerBrowserProtocolScheme,
  generateProtocolBookmarklet,
  generateBrowserUserscript,
} from '../utils/pdfProtocolHandler';
import {
  downloadWebAppBundleZip,
  downloadBrowserExtensionZip,
  downloadPortableHtmlLauncher,
} from '../utils/webAppBundleExporter';
import { usePWAInstall } from '../hooks/usePWAInstall';

export type AppHandlerModalSection = 'install' | 'overview' | 'browser_override' | 'sandbox';

interface PdfProtocolHandlerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: AppHandlerModalSection;
  settings: PdfProtocolSettings;
  onUpdateSettings: (next: PdfProtocolSettings) => void;
  onTriggerProtocolUri: (uri: string) => void;
  onShowToast: (msg: string) => void;
}

const PROTOCOL_SCHEMES: {
  scheme: ProtocolScheme;
  title: string;
  subtitle: string;
  desc: string;
  sampleUri: string;
}[] = [
  {
    scheme: 'web+pdf',
    title: 'Standard & XFA PDF Protocol (web+pdf://)',
    subtitle: 'Primary PDF Handler',
    desc: 'Routes web+pdf:// links and intercepted browser .pdf navigations directly into the AcroXFA canvas and form engine.',
    sampleUri:
      'web+pdf://https://www.canada.ca/content/dam/pch/documents/services/funding/book-fund/cBF-FinRepDatFrm-eng.pdf',
  },
  {
    scheme: 'web+xfa',
    title: 'Adobe LiveCycle Dynamic XFA Protocol (web+xfa://)',
    subtitle: 'LiveCycle XFA 3.3',
    desc: 'Intercepts dynamic XFA form links that trigger "Please wait..." errors in Chrome, Edge, Firefox, and Safari.',
    sampleUri: 'web+xfa://local/xfa_771a0a93.pdf',
  },
  {
    scheme: 'web+xdp',
    title: 'XML Data Package Protocol (web+xdp://)',
    subtitle: 'XDP Packet Stream',
    desc: 'Handles Adobe XML Data Package (.xdp) and template packet streams directly in the browser.',
    sampleUri: 'web+xdp://enterprise.registry.gov/forms/Enterprise_Registry_XFA_Form.pdf',
  },
];

export const PdfProtocolHandlerModal: React.FC<PdfProtocolHandlerModalProps> = ({
  isOpen,
  onClose,
  initialSection = 'install',
  settings,
  onUpdateSettings,
  onTriggerProtocolUri,
  onShowToast,
}) => {
  const { isInstallable, isInstalled, isIOS, env, install } = usePWAInstall();
  const [activeSection, setActiveSection] = useState<AppHandlerModalSection>(initialSection);
  const [customProtocolInput, setCustomProtocolInput] = useState(
    'web+pdf://https://www.canada.ca/content/dam/pch/documents/services/funding/book-fund/cBF-FinRepDatFrm-eng.pdf'
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPackagingBundle, setIsPackagingBundle] = useState(false);
  const [isPackagingExtension, setIsPackagingExtension] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialSection);
    }
  }, [isOpen, initialSection]);

  if (!isOpen) return null;

  const copyText = async (text: string, key: string, toastMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      onShowToast(toastMsg);
      window.setTimeout(() => setCopiedKey(prev => (prev === key ? null : prev)), 1800);
    } catch {
      onShowToast('Unable to copy to clipboard');
    }
  };

  // Native PWA Install trigger
  const handleNativePwaInstall = async () => {
    const accepted = await install();
    if (accepted) {
      setStatusMessage(
        'AcroXFA has been installed as a standalone offline Web App with OS .pdf file association support.'
      );
      onShowToast('AcroXFA installed as standalone Web App');
    } else {
      setStatusMessage(
        'Browser install dialog was dismissed. You can install anytime from the browser address bar or download the desktop bundle below.'
      );
    }
  };

  // Download full Web App Desktop Installer ZIP
  const handleDownloadWebAppBundle = async () => {
    setIsPackagingBundle(true);
    try {
      const filename = await downloadWebAppBundleZip(env.origin);
      setStatusMessage(
        `Downloaded ${filename} containing Windows, macOS, and Linux standalone launchers, portable HTML launcher, and the Chrome/Edge Default PDF Handler extension.`
      );
      onShowToast(`Downloaded ${filename}`);
    } catch (err: any) {
      onShowToast(`Failed to package Web App bundle: ${err.message}`);
    } finally {
      setIsPackagingBundle(false);
    }
  };

  // Download standalone Manifest V3 Browser PDF Extension ZIP
  const handleDownloadExtension = async () => {
    setIsPackagingExtension(true);
    try {
      const filename = await downloadBrowserExtensionZip(env.origin);
      setStatusMessage(
        `Downloaded ${filename}. Unzip it, open chrome://extensions (or edge://extensions), enable Developer mode, and click "Load unpacked".`
      );
      onShowToast(`Downloaded ${filename}`);
    } catch (err: any) {
      onShowToast(`Failed to package browser extension: ${err.message}`);
    } finally {
      setIsPackagingExtension(false);
    }
  };

  // Download portable single-file HTML shortcut
  const handleDownloadHtmlLauncher = () => {
    const filename = downloadPortableHtmlLauncher(env.origin);
    setStatusMessage(`Downloaded ${filename} — double-click it anytime to launch AcroXFA.`);
    onShowToast(`Downloaded ${filename}`);
  };

  // Toggle master default PDF protocol takeover
  const handleToggleMasterProtocol = () => {
    const nextEnabled = !settings.enabled;
    const updatedSchemes = { ...settings.registeredSchemes };

    if (nextEnabled) {
      let nativeSuccessCount = 0;
      (['web+pdf', 'web+xfa', 'web+xdp'] as ProtocolScheme[]).forEach(scheme => {
        const res = registerBrowserProtocolScheme(scheme);
        if (res.success) {
          updatedSchemes[scheme] = true;
          if (res.mode === 'native_browser') nativeSuccessCount += 1;
        }
      });

      setStatusMessage(
        nativeSuccessCount > 0
          ? 'Registered web+pdf://, web+xfa://, and web+xdp:// with your browser and enabled live .pdf interception and PWA file handling.'
          : 'Activated AcroXFA Default PDF Handler (in-session .pdf & custom scheme interception + PWA launchQueue active). Open the app directly in a top-level browser tab or install the included browser extension for browser-wide .pdf takeover.'
      );
      onShowToast('Registered AcroXFA as Default PDF Handler');
    } else {
      setStatusMessage('Default PDF handler interception paused for this browser session.');
      onShowToast('Paused Default PDF Handler');
    }

    onUpdateSettings({
      ...settings,
      enabled: nextEnabled,
      registeredSchemes: updatedSchemes,
      lastUpdated: new Date().toISOString(),
    });
  };

  // Register a single protocol scheme explicitly
  const handleRegisterSingleScheme = (scheme: ProtocolScheme) => {
    const res = registerBrowserProtocolScheme(scheme);
    const next: PdfProtocolSettings = {
      ...settings,
      enabled: true,
      registeredSchemes: {
        ...settings.registeredSchemes,
        [scheme]: true,
      },
      lastUpdated: new Date().toISOString(),
    };
    onUpdateSettings(next);
    setStatusMessage(res.message);
    onShowToast(`Registered ${scheme}:// handler`);
  };

  // Download Userscript (.user.js)
  const handleDownloadUserscript = () => {
    const scriptContent = generateBrowserUserscript(env.origin);
    const blob = new Blob([scriptContent], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'acroxfa-default-pdf-protocol.user.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('Downloaded acroxfa-default-pdf-protocol.user.js');
  };

  const bookmarkletHref = generateProtocolBookmarklet(env.origin);

  const osLabel =
    env.os === 'windows'
      ? 'Windows'
      : env.os === 'macos'
      ? 'macOS'
      : env.os === 'linux'
      ? 'Linux'
      : env.os === 'ios'
      ? 'iOS'
      : env.os === 'android'
      ? 'Android'
      : 'Desktop';

  const browserLabel =
    env.browser === 'chrome'
      ? 'Chrome'
      : env.browser === 'edge'
      ? 'Edge'
      : env.browser === 'safari'
      ? 'Safari'
      : env.browser === 'firefox'
      ? 'Firefox'
      : 'Browser';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Download Web App and Default Browser PDF Handler"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-100">
              Download Web App &amp; Default Browser PDF Handler
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
              <span>{osLabel} · {browserLabel}</span>
              <span aria-hidden="true">·</span>
              <span className={isInstalled ? 'text-emerald-400 font-medium' : 'text-slate-300'}>
                {isInstalled ? 'Installed Standalone App' : 'Web Browser Session'}
              </span>
              <span aria-hidden="true">·</span>
              <span className={settings.enabled ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                {settings.enabled ? 'PDF Handler Active' : 'PDF Handler Standby'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 sm:px-6 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-3 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('install')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'install'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Download &amp; Install App</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('overview')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'overview'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Default PDF Handler</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('browser_override')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'browser_override'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Puzzle className="w-3.5 h-3.5" />
              <span>Browser Extension &amp; Scripts</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('sandbox')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'sandbox'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Test Interception</span>
            </button>
          </div>

          <div className="text-[11px] font-mono tabular-nums text-slate-400 hidden lg:block whitespace-nowrap shrink-0">
            Intercepted: <strong className="text-slate-200">{settings.interceptedCount}</strong>
          </div>
        </div>

        {/* Status Feedback Banner */}
        {statusMessage && (
          <div className="mx-5 sm:mx-6 mt-4 px-3.5 py-2.5 bg-slate-950 border border-sky-700/60 rounded-lg text-xs text-sky-200 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              aria-label="Dismiss status message"
              className="text-slate-400 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: DOWNLOAD & INSTALL WEB APP */}
          {activeSection === 'install' && (
            <div className="space-y-6">
              {/* Two-column primary setup cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                {/* Option 1: Install Native Offline PWA */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
                      <Laptop className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>1. Install Standalone Offline Web App (PWA)</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Installs AcroXFA directly onto your desktop or home screen with offline caching, standalone window mode, and OS{' '}
                      <code className="text-slate-200">.pdf</code> / <code className="text-slate-200">.xdp</code> file association via{' '}
                      <code className="text-sky-300">file_handlers</code>.
                    </p>

                    {isInstalled ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium pt-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>AcroXFA is installed and running in standalone mode.</span>
                      </div>
                    ) : isIOS ? (
                      <div className="space-y-2 text-xs text-slate-300 pt-1 border-t border-slate-800/80">
                        <div className="flex items-start gap-2 pt-2">
                          <Share className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                          <span>1. Tap <strong>Share</strong> in Safari&apos;s toolbar.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>2. Select <strong>Add to Home Screen</strong> to install offline.</span>
                        </div>
                      </div>
                    ) : !isInstallable ? (
                      <div className="text-xs text-slate-400 leading-relaxed pt-2 border-t border-slate-800/80 space-y-1.5">
                        {env.isInIframe ? (
                          <p>
                            Browsers require a top-level tab (outside an embedded preview frame) to show the native one-click PWA install dialog. Open the app URL directly in Chrome or Edge, or use the Desktop Installer Bundle on the right.
                          </p>
                        ) : (
                          <p>
                            In Chrome or Edge, click the <strong>Install</strong> icon in the right side of the address bar, or open the browser menu → <strong>Cast, save, and share → Install page as app</strong>.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                    {isInstallable && !isInstalled && (
                      <button
                        type="button"
                        onClick={handleNativePwaInstall}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <DownloadCloud className="w-3.5 h-3.5" />
                        <span>Install App Now</span>
                      </button>
                    )}

                    {!isInstalled && (
                      <>
                        <a
                          href={env.origin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                          <span>Open Direct Tab</span>
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(env.origin, 'app_url', 'Copied AcroXFA Web App URL')
                          }
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {copiedKey === 'app_url' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>{copiedKey === 'app_url' ? 'Copied URL' : 'Copy URL'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Option 2: Download Desktop Web App Installer Bundle */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
                      <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>2. Download Web App Installer Bundle (.zip)</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Download a ready-to-run desktop package that works on any OS immediately — even without a browser install prompt:
                    </p>
                    <ul className="space-y-1 text-xs text-slate-300 pl-4 list-disc">
                      <li>Windows (<code className="text-slate-200">.bat</code>) &amp; macOS (<code className="text-slate-200">.command</code>) standalone app-window launchers</li>
                      <li>Linux <code className="text-slate-200">AcroXFA.desktop</code> entry with <code className="text-sky-300">application/pdf</code> MIME handler</li>
                      <li>Portable double-click <code className="text-slate-200">AcroXFA-Launcher.html</code> shortcut</li>
                      <li>Manifest V3 Chrome/Edge extension for browser-wide <code className="text-emerald-300">.pdf</code> takeover</li>
                    </ul>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={handleDownloadWebAppBundle}
                      disabled={isPackagingBundle}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {isPackagingBundle ? 'Packaging ZIP...' : 'Download Web App (.zip)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadHtmlLauncher}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5 text-sky-400" />
                      <span>HTML Shortcut</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Step 3: Register as Default Browser PDF Handler */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <ShieldCheck className={`w-4 h-4 ${settings.enabled ? 'text-emerald-400' : 'text-sky-400'}`} />
                    <span>3. Register as Default Browser PDF Handler</span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                    Calls <code className="text-sky-300">navigator.registerProtocolHandler</code> for{' '}
                    <code className="text-slate-200">web+pdf://</code>, <code className="text-slate-200">web+xfa://</code>, and{' '}
                    <code className="text-slate-200">web+xdp://</code>, activates PWA OS <code className="text-slate-200">.pdf</code> file handling, and enables live link interception. For browser-wide takeover on external websites, also install the Manifest V3 extension.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleMasterProtocol}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      settings.enabled
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-sky-600 hover:bg-sky-500 text-white'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>
                      {settings.enabled ? 'PDF Handler Active' : 'Register Default PDF Handler'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadExtension}
                    disabled={isPackagingExtension}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <Puzzle className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isPackagingExtension ? 'Zipping...' : 'Browser Extension (.zip)'}</span>
                  </button>
                </div>
              </div>

              {/* Capability Matrix (Clean Hairline Table, No Pill Clutter) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-800 text-xs font-semibold text-slate-200">
                  Browser Capability Diagnostics
                </div>
                <dl className="divide-y divide-slate-800/80 text-xs">
                  <div className="px-4 py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-slate-400">Offline Service Worker &amp; Manifest</dt>
                    <dd className="font-mono text-slate-200 flex items-center gap-1.5">
                      {env.supportsServiceWorker ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Ready</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-amber-300">Unavailable</span>
                        </>
                      )}
                    </dd>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-slate-400">Browser Protocol API (registerProtocolHandler)</dt>
                    <dd className="font-mono text-slate-200 flex items-center gap-1.5">
                      {env.supportsProtocolHandler ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Supported</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-amber-300">Fallback Interceptor</span>
                        </>
                      )}
                    </dd>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-4">
                    <dt className="text-slate-400">OS .pdf / .xdp File Handling (window.launchQueue)</dt>
                    <dd className="font-mono text-slate-200 flex items-center gap-1.5">
                      {env.supportsFileHandling ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Supported (Install PWA)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-400">Requires Chrome / Edge Desktop</span>
                        </>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {/* TAB 2: DEFAULT PDF HANDLER REGISTRATION & POLICIES */}
          {activeSection === 'overview' && (
            <div className="space-y-5">
              {/* Master Takeover Bar */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-100">
                    Register AcroXFA as Default Browser PDF &amp; XFA Handler
                  </div>
                  <p className="text-xs text-slate-400 max-w-xl">
                    Registers <code className="text-sky-300">web+pdf://</code>, <code className="text-sky-300">web+xfa://</code>, and <code className="text-sky-300">web+xdp://</code> via <code className="text-slate-300">navigator.registerProtocolHandler</code>, enables PWA <code className="text-slate-300">launchQueue</code>, and intercepts <code className="text-slate-300">.pdf</code> links in real time.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleMasterProtocol}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    settings.enabled
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-sky-600 hover:bg-sky-500 text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {settings.enabled
                      ? 'Active (Click to Pause)'
                      : 'Register as Default PDF Handler'}
                  </span>
                </button>
              </div>

              {/* Registered Protocol Schemes */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-200">
                  1. Custom Browser Protocol Schemes
                </h3>

                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  {PROTOCOL_SCHEMES.map(item => {
                    const isReg = settings.registeredSchemes[item.scheme];
                    return (
                      <div
                        key={item.scheme}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-xs font-semibold text-slate-100">
                              {item.title}
                            </span>
                            <span className="text-xs text-slate-500">·</span>
                            <span className="text-xs text-slate-400">{item.subtitle}</span>
                            {isReg && (
                              <>
                                <span className="text-xs text-slate-500">·</span>
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Registered
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                          <div className="text-[11px] font-mono text-slate-500 truncate">
                            Template:{' '}
                            <code className="text-slate-300">
                              {env.origin}/?
                              {item.scheme === 'web+xfa'
                                ? 'xfaProtocol'
                                : item.scheme === 'web+xdp'
                                ? 'xdpProtocol'
                                : 'pdfProtocol'}
                              =%s
                            </code>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRegisterSingleScheme(item.scheme)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isReg ? 'Re-Register' : `Register ${item.scheme}://`}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              onTriggerProtocolUri(item.sampleUri);
                              onClose();
                            }}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            title={`Test ${item.scheme}:// protocol launch`}
                          >
                            <Play className="w-3 h-3" />
                            <span>Test</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Interception Behavior Policies */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-slate-200">
                  2. Automatic PDF &amp; XFA Interception Policies
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.interceptPdfLinks}
                      onChange={e =>
                        onUpdateSettings({
                          ...settings,
                          interceptPdfLinks: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded border-slate-700 bg-slate-950 text-sky-500"
                    />
                    <div>
                      <div className="font-medium text-slate-200">
                        Intercept Direct <code>.pdf</code> &amp; <code>.xdp</code> Links
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Captures clicks on links ending in <code>.pdf</code>, <code>.xdp</code>, or <code>.xfdf</code> before the native browser viewer opens them.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.interceptXfaProtocols}
                      onChange={e =>
                        onUpdateSettings({
                          ...settings,
                          interceptXfaProtocols: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded border-slate-700 bg-slate-950 text-sky-500"
                    />
                    <div>
                      <div className="font-medium text-slate-200">
                        Intercept <code>web+pdf://</code> &amp; <code>web+xfa://</code> URIs
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Resolves custom protocol URIs passed via URL query parameters or anchor links.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoBypassPleaseWait}
                      onChange={e =>
                        onUpdateSettings({
                          ...settings,
                          autoBypassPleaseWait: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded border-slate-700 bg-slate-950 text-sky-500"
                    />
                    <div>
                      <div className="font-medium text-slate-200">
                        Auto-Bypass Adobe LiveCycle &ldquo;Please wait...&rdquo; Shells
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Strips fallback shell pages and parses the underlying <code>&lt;xdp:xdp&gt;</code> template and datasets XML packets directly.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableFileHandlerQueue}
                      onChange={e =>
                        onUpdateSettings({
                          ...settings,
                          enableFileHandlerQueue: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded border-slate-700 bg-slate-950 text-sky-500"
                    />
                    <div>
                      <div className="font-medium text-slate-200">
                        PWA OS File Association (<code>window.launchQueue</code>)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Opens local <code>.pdf</code> and <code>.xdp</code> files from your OS desktop when AcroXFA is installed as a PWA.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BROWSER-WIDE EXTENSION, BOOKMARKLET & USERSCRIPT */}
          {activeSection === 'browser_override' && (
            <div className="space-y-5">
              {/* 1. Manifest V3 Browser Extension */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                    <Puzzle className="w-4 h-4 text-sky-400" />
                    <span>1. Chrome / Edge / Brave Default PDF Handler Extension (Manifest V3)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleDownloadExtension}
                    disabled={isPackagingExtension}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {isPackagingExtension ? 'Packaging...' : 'Download Extension (.zip)'}
                    </span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Because browsers sandbox web pages from intercepting external websites&apos; <code>.pdf</code> tabs directly, loading this lightweight Manifest V3 extension gives AcroXFA true browser-wide default PDF handler takeover across every website:
                </p>
                <ol className="text-xs text-slate-300 space-y-1 pl-4 list-decimal">
                  <li>Download and extract <code className="text-slate-200">acroxfa-browser-pdf-handler-extension.zip</code>.</li>
                  <li>
                    Open <code className="text-sky-300">chrome://extensions</code> (or <code className="text-sky-300">edge://extensions</code>) and enable <strong>Developer mode</strong>.
                  </li>
                  <li>
                    Click <strong>Load unpacked</strong> and choose the extracted <code className="text-slate-200">acroxfa-pdf-handler-extension</code> folder.
                  </li>
                </ol>
              </div>

              {/* 2. Bookmarklet */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-sky-400" />
                    <span>2. One-Click Browser PDF Takeover Bookmarklet</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        bookmarkletHref,
                        'bookmarklet',
                        'Copied AcroXFA PDF Takeover Bookmarklet to clipboard'
                      )
                    }
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-md text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'bookmarklet' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedKey === 'bookmarklet' ? 'Copied' : 'Copy Bookmarklet'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Drag the button below to your Bookmarks Bar. Whenever Chrome, Edge, or Safari shows a stuck <em>&ldquo;Please wait...&rdquo;</em> PDF tab on any website, click it to reopen that PDF inside AcroXFA:
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <a
                    href={bookmarkletHref}
                    onClick={e => {
                      e.preventDefault();
                      copyText(
                        bookmarkletHref,
                        'bookmarklet',
                        'Drag this button to your Bookmarks Bar (or copied to clipboard)'
                      );
                    }}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    title="Drag me to your browser Bookmarks Bar"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Open PDF in AcroXFA</span>
                  </a>
                  <code className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 truncate flex-1">
                    {bookmarkletHref}
                  </code>
                </div>
              </div>

              {/* 3. Userscript */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>3. Tampermonkey / Violentmonkey Userscript (.user.js)</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          generateBrowserUserscript(env.origin),
                          'userscript',
                          'Copied Userscript to clipboard'
                        )
                      }
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'userscript' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedKey === 'userscript' ? 'Copied' : 'Copy Script'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadUserscript}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download .user.js</span>
                    </button>
                  </div>
                </div>
                <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 max-h-36 overflow-auto whitespace-pre">
                  {generateBrowserUserscript(env.origin)}
                </pre>
              </div>

              {/* 4. Browser Native Settings URLs */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-100">
                  4. Browser Native Protocol &amp; PDF Settings Shortcuts
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'Chrome Extensions (Load Unpacked)', uri: 'chrome://extensions' },
                    { label: 'Chrome Protocol Handlers', uri: 'chrome://settings/handlers' },
                    { label: 'Chrome PDF Documents Setting', uri: 'chrome://settings/content/pdfDocuments' },
                    { label: 'Edge PDF Viewer Setting', uri: 'edge://settings/content/pdfDocuments' },
                  ].map(item => (
                    <div
                      key={item.uri}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-200 text-[11px] truncate">
                          {item.label}
                        </div>
                        <div className="font-mono text-[10px] text-sky-400 truncate">
                          {item.uri}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            item.uri,
                            item.uri,
                            `Copied ${item.uri} — paste into your browser address bar`
                          )
                        }
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer shrink-0"
                        title={`Copy ${item.uri}`}
                      >
                        {copiedKey === item.uri ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE INTERCEPTION SANDBOX */}
          {activeSection === 'sandbox' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-sky-400" />
                  <span>Dispatch Custom Protocol URI</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Test how AcroXFA intercepts a <code className="text-sky-300">web+pdf://</code>, <code className="text-sky-300">web+xfa://</code>, or direct <code className="text-emerald-300">.pdf</code> URL and loads its XFA form fields automatically.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customProtocolInput}
                    onChange={e => setCustomProtocolInput(e.target.value)}
                    placeholder="web+pdf://https://example.com/form.pdf"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onTriggerProtocolUri(customProtocolInput);
                      onClose();
                    }}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Intercept &amp; Open</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-100">
                    Clickable PDF / XFA Link Interception Test
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Click any link below to verify interception
                  </span>
                </div>

                <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-900">
                  {[
                    {
                      label: 'Canada Book Fund Official XFA Form (cBF-FinRepDatFrm-eng.pdf)',
                      href: 'web+pdf://https://www.canada.ca/content/dam/pch/documents/services/funding/book-fund/cBF-FinRepDatFrm-eng.pdf',
                      scheme: 'web+pdf://',
                    },
                    {
                      label: 'Attached Dynamic LiveCycle XFA Form (xfa_771a0a93.pdf · 44 Fields)',
                      href: 'web+xfa://local/xfa_771a0a93.pdf',
                      scheme: 'web+xfa://',
                    },
                    {
                      label: 'Enterprise Registry XFA Specification (Enterprise_Registry_XFA_Form.pdf)',
                      href: 'web+xdp://enterprise.internal/forms/Enterprise_Registry_XFA_Form.pdf',
                      scheme: 'web+xdp://',
                    },
                  ].map(link => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={e => {
                        e.preventDefault();
                        onTriggerProtocolUri(link.href);
                        onClose();
                      }}
                      className="p-3 hover:bg-slate-800/80 flex items-center justify-between gap-3 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-200 group-hover:text-sky-300 truncate">
                            {link.label}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            {link.href}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-sky-400 shrink-0">
                        {link.scheme}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-2 min-w-0">
            {settings.enabled ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Globe className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span className="truncate">
              {settings.enabled
                ? 'Default PDF & XFA handler is active for this browser'
                : 'Install the Web App or activate the Default PDF Handler above'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
