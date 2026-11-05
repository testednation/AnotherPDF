export type ProtocolScheme = 'web+pdf' | 'web+xfa' | 'web+xdp';

export interface ProtocolSchemeStatus {
  scheme: ProtocolScheme;
  label: string;
  description: string;
  handlerTemplateUrl: string;
  isRegistered: boolean;
  registrationMode: 'native_browser' | 'session_interceptor' | 'unregistered';
  lastRegisteredAt?: string;
  statusNote?: string;
}

export interface PdfProtocolSettings {
  enabled: boolean;
  interceptPdfLinks: boolean;
  interceptXfaProtocols: boolean;
  autoBypassPleaseWait: boolean;
  enableFileHandlerQueue: boolean;
  registeredSchemes: Record<ProtocolScheme, boolean>;
  lastUpdated: string;
  interceptedCount: number;
}

const STORAGE_KEY = 'acroxfa_pdf_protocol_settings_v1';

export const DEFAULT_PROTOCOL_SETTINGS: PdfProtocolSettings = {
  enabled: false,
  interceptPdfLinks: true,
  interceptXfaProtocols: true,
  autoBypassPleaseWait: true,
  enableFileHandlerQueue: true,
  registeredSchemes: {
    'web+pdf': false,
    'web+xfa': false,
    'web+xdp': false,
  },
  lastUpdated: new Date().toISOString(),
  interceptedCount: 0,
};

export function loadPdfProtocolSettings(): PdfProtocolSettings {
  if (typeof window === 'undefined') return DEFAULT_PROTOCOL_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROTOCOL_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PROTOCOL_SETTINGS,
      ...parsed,
      registeredSchemes: {
        ...DEFAULT_PROTOCOL_SETTINGS.registeredSchemes,
        ...(parsed.registeredSchemes || {}),
      },
    };
  } catch {
    return DEFAULT_PROTOCOL_SETTINGS;
  }
}

export function savePdfProtocolSettings(settings: PdfProtocolSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Registers a custom protocol handler (web+pdf, web+xfa, web+xdp) with the browser's
 * navigator.registerProtocolHandler API, with fallback to active session interception
 * when running inside a cross-origin preview iframe.
 */
export function registerBrowserProtocolScheme(scheme: ProtocolScheme): {
  success: boolean;
  mode: 'native_browser' | 'session_interceptor';
  message: string;
  handlerUrl: string;
} {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const paramName =
    scheme === 'web+xfa'
      ? 'xfaProtocol'
      : scheme === 'web+xdp'
      ? 'xdpProtocol'
      : 'pdfProtocol';
  const handlerUrl = `${origin}/?${paramName}=%s`;

  if (typeof navigator !== 'undefined' && typeof navigator.registerProtocolHandler === 'function') {
    try {
      navigator.registerProtocolHandler(scheme, handlerUrl);
      return {
        success: true,
        mode: 'native_browser',
        message: `Registered ${scheme}:// with browser navigator.registerProtocolHandler.`,
        handlerUrl,
      };
    } catch (err: any) {
      // In sandboxed iframes or certain origins, registerProtocolHandler may throw SecurityError;
      // we still activate the in-app & PWA protocol interceptor seamlessly.
      return {
        success: true,
        mode: 'session_interceptor',
        message: `Activated ${scheme}:// via AcroXFA In-Browser Protocol Interceptor (${
          err?.name === 'SecurityError'
            ? 'iframe sandbox fallback active'
            : 'client interceptor active'
        }).`,
        handlerUrl,
      };
    }
  }

  return {
    success: true,
    mode: 'session_interceptor',
    message: `Activated ${scheme}:// via AcroXFA Client Protocol Router.`,
    handlerUrl,
  };
}

/**
 * Normalizes an incoming protocol URI such as:
 * - web+pdf://https://www.canada.ca/.../cBF-FinRepDatFrm-eng.pdf
 * - web+xfa:https%3A%2F%2Fexample.com%2Fform.pdf
 * - web+xdp://local/xfa_771a0a93.pdf
 * - pdf://...
 */
export function parseIncomingProtocolUri(rawUri: string): {
  scheme: string;
  targetUrl: string;
  displayFilename: string;
  builtInPreset: 'canada_book_fund' | 'attached_livecycle' | 'enterprise_sample' | 'media_sample' | 'remote_url';
} {
  let decoded = rawUri.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // keep raw if malformed percent-encoding
  }

  let scheme = 'https';
  let targetUrl = decoded;

  const schemeMatch = decoded.match(/^(web\+pdf|web\+xfa|web\+xdp|pdf|xfa):(\/\/)?(.*)$/i);
  if (schemeMatch) {
    scheme = schemeMatch[1].toLowerCase();
    targetUrl = schemeMatch[3].trim();
    if (!/^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith('/') && !targetUrl.startsWith('local/')) {
      targetUrl = `https://${targetUrl}`;
    }
  }

  const lower = targetUrl.toLowerCase();
  let builtInPreset: 'canada_book_fund' | 'attached_livecycle' | 'enterprise_sample' | 'media_sample' | 'remote_url' =
    'remote_url';

  if (lower.includes('cbf') || lower.includes('book-fund') || lower.includes('finrep')) {
    builtInPreset = 'canada_book_fund';
  } else if (lower.includes('xfa_771a0a93') || lower.includes('livecycle') || lower.includes('attached')) {
    builtInPreset = 'attached_livecycle';
  } else if (lower.includes('enterprise') || lower.includes('registry')) {
    builtInPreset = 'enterprise_sample';
  } else if (lower.includes('media') || lower.includes('technical_assets')) {
    builtInPreset = 'media_sample';
  }

  const parts = targetUrl.split('/').filter(Boolean);
  const lastSegment = parts[parts.length - 1]?.split('?')[0] || 'Intercepted_Document.pdf';
  const displayFilename = /\.(pdf|xdp|xfdf)$/i.test(lastSegment)
    ? lastSegment
    : `${lastSegment}.pdf`;

  return {
    scheme,
    targetUrl,
    displayFilename,
    builtInPreset,
  };
}

/**
 * Generates a 1-click Bookmarklet URI that users can drag to their browser bookmarks bar
 * to hijack any open PDF tab (including "Please wait..." XFA tabs) and redirect it to AcroXFA.
 */
export function generateProtocolBookmarklet(appOrigin?: string): string {
  const origin =
    appOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000');
  const script = `(function(){var u=window.location.href;window.location.href='${origin}/?pdfProtocol='+encodeURIComponent('web+pdf://'+u);})();`;
  return `javascript:${script}`;
}

/**
 * Generates a standard Userscript (Tampermonkey / Violentmonkey / Greasemonkey)
 * that automatically intercepts all .pdf and .xdp links across the browser and opens them in AcroXFA.
 */
export function generateBrowserUserscript(appOrigin?: string): string {
  const origin =
    appOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000');

  return `// ==UserScript==
// @name         AcroXFA Default PDF & XFA Protocol Takeover
// @namespace    ${origin}
// @version      1.2.0
// @description  Intercepts browser .pdf, .xdp, and Dynamic XFA links to open directly in AcroXFA instead of the default browser PDF viewer.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  const ACROXFA_ORIGIN = '${origin}';
  if (window.location.origin === ACROXFA_ORIGIN) return;

  // 1. If the browser navigated directly to a .pdf or .xdp URL, redirect to AcroXFA protocol handler
  if (/\\.(pdf|xdp)(\\?.*)?$/i.test(window.location.pathname)) {
    window.location.replace(ACROXFA_ORIGIN + '/?pdfProtocol=' + encodeURIComponent('web+pdf://' + window.location.href));
    return;
  }

  // 2. Intercept clicks on any <a href="*.pdf"> or web+pdf:// link
  document.addEventListener('click', function(e) {
    const anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (/\\.(pdf|xdp)(\\?.*)?$/i.test(href) || /^(web\\+pdf|web\\+xfa|web\\+xdp):/i.test(href)) {
      e.preventDefault();
      e.stopPropagation();
      const resolvedUrl = new URL(href, window.location.href).href;
      window.location.href = ACROXFA_ORIGIN + '/?pdfProtocol=' + encodeURIComponent('web+pdf://' + resolvedUrl);
    }
  }, true);
})();`;
}
