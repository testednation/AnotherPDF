import React, { useState } from 'react';
import {
  ShieldCheck,
  Globe,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Copy,
  Download,
  Terminal,
  Play,
  Sliders,
  X,
  FileCode,
  FileText,
  Link2,
  Zap,
} from 'lucide-react';
import {
  PdfProtocolSettings,
  ProtocolScheme,
  registerBrowserProtocolScheme,
  generateProtocolBookmarklet,
  generateBrowserUserscript,
} from '../utils/pdfProtocolHandler';

interface PdfProtocolHandlerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PdfProtocolSettings;
  onUpdateSettings: (next: PdfProtocolSettings) => void;
  onTriggerProtocolUri: (uri: string) => void;
  onShowToast: (msg: string) => void;
}

const PROTOCOL_SCHEMES: {
  scheme: ProtocolScheme;
  title: string;
  badge: string;
  desc: string;
  sampleUri: string;
}[] = [
  {
    scheme: 'web+pdf',
    title: 'Standard & XFA PDF Protocol (web+pdf://)',
    badge: 'Primary PDF Handler',
    desc: 'Routes web+pdf:// links and hijacked browser .pdf navigations directly into the AcroXFA canvas & form engine.',
    sampleUri: 'web+pdf://https://www.canada.ca/content/dam/pch/documents/services/funding/book-fund/cBF-FinRepDatFrm-eng.pdf',
  },
  {
    scheme: 'web+xfa',
    title: 'Adobe LiveCycle Dynamic XFA Protocol (web+xfa://)',
    badge: 'LiveCycle XFA 3.3',
    desc: 'Intercepts dynamic XFA form links that trigger "Please wait..." errors in Chrome, Edge, Firefox, and Safari.',
    sampleUri: 'web+xfa://local/xfa_771a0a93.pdf',
  },
  {
    scheme: 'web+xdp',
    title: 'XML Data Package Protocol (web+xdp://)',
    badge: 'XDP Packet Stream',
    desc: 'Handles Adobe XML Data Package (.xdp) and template packet streams directly in the browser.',
    sampleUri: 'web+xdp://enterprise.registry.gov/forms/Enterprise_Registry_XFA_Form.pdf',
  },
];

export const PdfProtocolHandlerModal: React.FC<PdfProtocolHandlerModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onTriggerProtocolUri,
  onShowToast,
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'sandbox' | 'browser_override'>('overview');
  const [customProtocolInput, setCustomProtocolInput] = useState(
    'web+pdf://https://www.canada.ca/content/dam/pch/documents/services/funding/book-fund/cBF-FinRepDatFrm-eng.pdf'
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Toggle master default PDF protocol takeover
  const handleToggleMasterProtocol = () => {
    const nextEnabled = !settings.enabled;
    const updatedSchemes = { ...settings.registeredSchemes };

    if (nextEnabled) {
      // Register all 3 schemes with browser navigator.registerProtocolHandler
      (['web+pdf', 'web+xfa', 'web+xdp'] as ProtocolScheme[]).forEach(scheme => {
        const res = registerBrowserProtocolScheme(scheme);
        if (res.success) {
          updatedSchemes[scheme] = true;
        }
      });
      setStatusMessage(
        'AcroXFA is now active as the default PDF & XFA protocol handler (web+pdf://, web+xfa://, web+xdp://, and in-session .pdf links).'
      );
      onShowToast('Enabled Default PDF & XFA Browser Protocol Takeover');
    } else {
      setStatusMessage('Default PDF protocol takeover paused for this browser session.');
      onShowToast('Disabled Default PDF Protocol Takeover');
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
    const scriptContent = generateBrowserUserscript();
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

  const bookmarkletHref = generateProtocolBookmarklet();

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                settings.enabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-sky-500/15 border-sky-500/30 text-sky-400'
              }`}
            >
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Browser Default PDF &amp; XFA Protocol Handler
                </h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                    settings.enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {settings.enabled ? 'ACTIVE HANDLER' : 'STANDBY'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Take over browser <code className="text-sky-300">.pdf</code>, <code className="text-purple-300">web+pdf://</code>, <code className="text-amber-300">web+xfa://</code>, and <code className="text-emerald-300">.xdp</code> protocols to bypass native browser &ldquo;Please wait...&rdquo; XFA errors.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Takeover Banner */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <Zap className={`w-4 h-4 ${settings.enabled ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span>Take Over Default Browser PDF &amp; XFA Protocol</span>
            </div>
            <p className="text-[11px] text-slate-400 max-w-xl">
              Registers <code className="text-sky-300">navigator.registerProtocolHandler</code> for <code className="text-sky-300">web+pdf</code> / <code className="text-purple-300">web+xfa</code> / <code className="text-emerald-300">web+xdp</code>, activates PWA OS file association (<code className="text-slate-300">window.launchQueue</code>), and intercepts <code className="text-slate-300">.pdf</code> links in real time.
            </p>
          </div>

          <button
            onClick={handleToggleMasterProtocol}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0 ${
              settings.enabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/30'
                : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {settings.enabled
                ? 'Default PDF Protocol Active (Click to Pause)'
                : 'Set as Default PDF Protocol Handler'}
            </span>
          </button>
        </div>

        {/* Sub-Navigation Bar */}
        <div className="px-6 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveSection('overview')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'overview'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Protocol Handlers &amp; Policies</span>
            </button>

            <button
              onClick={() => setActiveSection('sandbox')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'sandbox'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Live Protocol Interceptor Sandbox</span>
            </button>

            <button
              onClick={() => setActiveSection('browser_override')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'browser_override'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Browser Bookmarklet &amp; Userscript</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400 hidden md:block">
            Intercepted in session: <strong className="text-sky-400">{settings.interceptedCount}</strong>
          </div>
        </div>

        {/* Status Feedback Banner */}
        {statusMessage && (
          <div className="mx-6 mt-4 px-3.5 py-2.5 bg-sky-950/50 border border-sky-700/60 rounded-xl text-xs text-sky-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeSection === 'overview' && (
            <>
              {/* Registered Protocol Schemes Cards */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  1. Browser Custom Scheme &amp; MIME Protocol Registration
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  {PROTOCOL_SCHEMES.map(item => {
                    const isReg = settings.registeredSchemes[item.scheme];
                    return (
                      <div
                        key={item.scheme}
                        className={`p-4 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          isReg
                            ? 'bg-slate-950/90 border-emerald-700/60'
                            : 'bg-slate-950/50 border-slate-800'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100">
                              {item.title}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                              {item.badge}
                            </span>
                            {isReg && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Registered
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {item.desc}
                          </p>
                          <div className="text-[10px] font-mono text-slate-500">
                            Endpoint Template: <code className="text-slate-300">{window.location.origin}/?{item.scheme === 'web+xfa' ? 'xfaProtocol' : item.scheme === 'web+xdp' ? 'xdpProtocol' : 'pdfProtocol'}=%s</code>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleRegisterSingleScheme(item.scheme)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            {isReg ? 'Re-Register Scheme' : `Register ${item.scheme}://`}
                          </button>

                          <button
                            onClick={() => {
                              onTriggerProtocolUri(item.sampleUri);
                              onClose();
                            }}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
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
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  2. Automatic PDF &amp; XFA Interception Policies
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
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
                      <div className="font-semibold text-slate-200">
                        Intercept Direct <code className="text-sky-300">.pdf</code> &amp; <code className="text-purple-300">.xdp</code> Anchor Clicks
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Captures clicks on links ending in <code>.pdf</code>, <code>.xdp</code>, or <code>.xfdf</code> before the browser&apos;s native PDF viewer opens them.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
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
                      <div className="font-semibold text-slate-200">
                        Intercept <code className="text-amber-300">web+pdf://</code> &amp; <code className="text-amber-300">web+xfa://</code> URIs
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Automatically resolves custom protocol URIs passed via URL query parameters or anchor links.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
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
                      <div className="font-semibold text-slate-200">
                        Auto-Bypass Adobe LiveCycle &ldquo;Please wait...&rdquo; Shell Pages
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Strips fallback shell pages and parses the underlying <code>&lt;xdp:xdp&gt;</code> template &amp; datasets XML packets directly.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
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
                      <div className="font-semibold text-slate-200">
                        PWA OS File Association (<code className="text-emerald-300">window.launchQueue</code>)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Allows opening local <code>.pdf</code> and <code>.xdp</code> files from your OS desktop when AcroXFA is installed as a PWA.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}

          {activeSection === 'sandbox' && (
            <div className="space-y-4">
              {/* Custom Protocol URI Launcher */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-purple-400" />
                  <span>Dispatch Custom Protocol URI</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Test how AcroXFA intercepts a <code className="text-sky-300">web+pdf://</code>, <code className="text-purple-300">web+xfa://</code>, or direct <code className="text-emerald-300">.pdf</code> URL and compiles its XFA form fields automatically.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customProtocolInput}
                    onChange={e => setCustomProtocolInput(e.target.value)}
                    placeholder="web+pdf://https://example.com/form.pdf"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={() => {
                      onTriggerProtocolUri(customProtocolInput);
                      onClose();
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Intercept &amp; Open Now</span>
                  </button>
                </div>
              </div>

              {/* Live Clickable Anchor Interception Test Grid */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Clickable Browser PDF / XFA Link Interception Demo</span>
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Click any link below to test interception
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Clicking any standard <code className="text-slate-300">&lt;a href=&quot;...&quot;&gt;</code> link below will be intercepted by AcroXFA&apos;s protocol listener instead of navigating away to the browser&apos;s broken default PDF viewer:
                </p>

                <div className="grid grid-cols-1 gap-2.5 pt-1">
                  {[
                    {
                      label: 'Canada Book Fund Official XFA Form (cBF-FinRepDatFrm-eng.pdf)',
                      href: 'web+pdf://https://www.canada.ca/content/dam/pch/documents/services/funding/book-fund/cBF-FinRepDatFrm-eng.pdf',
                      badge: 'web+pdf://',
                    },
                    {
                      label: 'Attached Dynamic LiveCycle XFA Form (xfa_771a0a93.pdf — 44 Fields)',
                      href: 'web+xfa://local/xfa_771a0a93.pdf',
                      badge: 'web+xfa://',
                    },
                    {
                      label: 'Enterprise Registry XFA Specification (Enterprise_Registry_XFA_Form.pdf)',
                      href: 'web+xdp://enterprise.internal/forms/Enterprise_Registry_XFA_Form.pdf',
                      badge: 'web+xdp://',
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
                      className="p-3 rounded-lg bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-500/60 flex items-center justify-between gap-3 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-300 truncate">
                            {link.label}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            {link.href}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 shrink-0">
                        {link.badge}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'browser_override' && (
            <div className="space-y-4">
              {/* 1. Bookmarklet */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-sky-400" />
                    <span>1. One-Click Browser PDF Takeover Bookmarklet</span>
                  </h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(bookmarkletHref);
                      onShowToast('Copied AcroXFA PDF Takeover Bookmarklet to clipboard');
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Bookmarklet</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Drag the button below to your browser&apos;s Bookmarks Bar, or copy the bookmarklet URL. Whenever Chrome, Edge, or Safari displays a stuck <em>&ldquo;Please wait...&rdquo;</em> PDF tab on any website, click the bookmarklet to immediately reopen that PDF inside AcroXFA:
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <a
                    href={bookmarkletHref}
                    onClick={e => {
                      e.preventDefault();
                      navigator.clipboard.writeText(bookmarkletHref);
                      onShowToast('Drag this button to your Bookmarks Bar (or copied to clipboard)');
                    }}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg shadow-sm inline-flex items-center gap-1.5"
                    title="Drag me to your browser Bookmarks Bar"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Open PDF in AcroXFA</span>
                  </a>
                  <code className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800 truncate flex-1">
                    {bookmarkletHref}
                  </code>
                </div>
              </div>

              {/* 2. Userscript for Automatic Browser-Wide PDF Takeover */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    <span>2. Automatic Browser-Wide PDF Takeover Userscript</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generateBrowserUserscript());
                        onShowToast('Copied Userscript to clipboard');
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Script</span>
                    </button>
                    <button
                      onClick={handleDownloadUserscript}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download .user.js</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Install in Tampermonkey or Violentmonkey to automatically intercept every <code className="text-emerald-300">.pdf</code> and <code className="text-purple-300">.xdp</code> URL across all websites and redirect them into AcroXFA:
                </p>
                <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 max-h-40 overflow-auto whitespace-pre">
                  {generateBrowserUserscript()}
                </pre>
              </div>

              {/* 3. Browser Settings Protocol Registry Shortcuts */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  3. Browser Native Protocol &amp; PDF Viewer Settings Shortcuts
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  {[
                    { label: 'Chrome Protocol Handlers', uri: 'chrome://settings/handlers' },
                    { label: 'Chrome PDF Documents Setting', uri: 'chrome://settings/content/pdfDocuments' },
                    { label: 'Edge PDF Viewer Setting', uri: 'edge://settings/content/pdfDocuments' },
                  ].map(item => (
                    <div
                      key={item.uri}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-200 text-[11px] truncate">
                          {item.label}
                        </div>
                        <div className="font-mono text-[10px] text-sky-400 truncate">
                          {item.uri}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.uri);
                          onShowToast(`Copied ${item.uri} — paste in browser address bar`);
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer shrink-0"
                        title={`Copy ${item.uri}`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                settings.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span>
              {settings.enabled
                ? 'AcroXFA Protocol Interceptor is actively monitoring browser PDF & XFA links'
                : 'Click "Set as Default PDF Protocol Handler" above to activate'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
