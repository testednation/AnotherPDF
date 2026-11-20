import JSZip from 'jszip';

export interface BrowserEnvironmentInfo {
  os: 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'other';
  browser: 'chrome' | 'edge' | 'safari' | 'firefox' | 'other';
  isInIframe: boolean;
  isStandalone: boolean;
  supportsProtocolHandler: boolean;
  supportsFileHandling: boolean;
  supportsServiceWorker: boolean;
  origin: string;
}

export function detectBrowserEnvironment(): BrowserEnvironmentInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      os: 'other',
      browser: 'other',
      isInIframe: false,
      isStandalone: false,
      supportsProtocolHandler: false,
      supportsFileHandling: false,
      supportsServiceWorker: false,
      origin: 'https://localhost:3000',
    };
  }

  const ua = navigator.userAgent.toLowerCase();

  let os: BrowserEnvironmentInfo['os'] = 'other';
  if (/iphone|ipad|ipod/.test(ua)) os = 'ios';
  else if (/android/.test(ua)) os = 'android';
  else if (/win/.test(ua)) os = 'windows';
  else if (/mac os x|macintosh/.test(ua)) os = 'macos';
  else if (/linux/.test(ua)) os = 'linux';

  let browser: BrowserEnvironmentInfo['browser'] = 'other';
  if (/edg\//.test(ua)) browser = 'edge';
  else if (/firefox|fxios/.test(ua)) browser = 'firefox';
  else if (/chrome|crios|chromium/.test(ua) && !/edg\//.test(ua)) browser = 'chrome';
  else if (/safari/.test(ua) && !/chrome|crios|chromium|edg\//.test(ua)) browser = 'safari';

  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  return {
    os,
    browser,
    isInIframe,
    isStandalone,
    supportsProtocolHandler: typeof navigator.registerProtocolHandler === 'function',
    supportsFileHandling: 'launchQueue' in window,
    supportsServiceWorker: 'serviceWorker' in navigator,
    origin: window.location.origin,
  };
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generatePortableLauncherHtml(appOrigin?: string): string {
  const origin =
    appOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AcroXFA Desktop Web App Launcher</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0b1120;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      max-width: 520px;
      width: 100%;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 28px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.45);
    }
    h1 { margin: 0 0 8px; font-size: 20px; color: #f8fafc; }
    p { margin: 0 0 20px; font-size: 13px; line-height: 1.6; color: #94a3b8; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    a.btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      background: #0284c7;
      color: #ffffff;
    }
    a.btn:hover { background: #0369a1; }
    .meta {
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1px solid #1e293b;
      font-size: 12px;
      color: #64748b;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>AcroXFA — XFA &amp; PDF Workspace</h1>
    <p>
      Launching AcroXFA web app. Once open in Chrome or Edge, click the browser address bar
      <strong>Install</strong> icon to install AcroXFA as an offline desktop application and
      register it for <code>.pdf</code> and <code>.xdp</code> files.
    </p>
    <div class="actions">
      <a class="btn" id="launchLink" href="${origin}">Launch AcroXFA Now</a>
    </div>
    <div class="meta">App URL: <code>${origin}</code></div>
  </div>
  <script>
    (function() {
      var target = '${origin}';
      var params = new URLSearchParams(window.location.search);
      var pdfParam = params.get('pdfUrl') || params.get('pdfProtocol');
      if (pdfParam) {
        target += '/?pdfProtocol=' + encodeURIComponent(pdfParam);
      }
      document.getElementById('launchLink').href = target;
      setTimeout(function() {
        window.location.href = target;
      }, 650);
    })();
  </script>
</body>
</html>
`;
}

function buildExtensionFiles(origin: string): Record<string, string> {
  const manifestJson = JSON.stringify(
    {
      manifest_version: 3,
      name: 'AcroXFA Default Browser PDF & XFA Handler',
      version: '1.0.0',
      description:
        'Automatically opens browser .pdf, .xdp, web+pdf://, and web+xfa:// links in AcroXFA instead of the built-in browser PDF viewer.',
      permissions: ['storage', 'tabs'],
      host_permissions: ['<all_urls>'],
      action: {
        default_title: 'AcroXFA Default PDF Handler',
        default_popup: 'popup.html',
      },
      background: {
        service_worker: 'background.js',
      },
      content_scripts: [
        {
          matches: ['<all_urls>'],
          js: ['content.js'],
          run_at: 'document_start',
        },
      ],
    },
    null,
    2
  );

  const backgroundJs = `const DEFAULT_ORIGIN = '${origin}';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['enabled', 'appOrigin'], (res) => {
    chrome.storage.sync.set({
      enabled: res.enabled !== undefined ? res.enabled : true,
      appOrigin: res.appOrigin || DEFAULT_ORIGIN,
    });
  });
});

// Intercept direct top-level navigations to .pdf or .xdp URLs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (!url) return;
  if (!/^https?:\\/\\//i.test(url)) return;

  chrome.storage.sync.get(['enabled', 'appOrigin'], ({ enabled = true, appOrigin = DEFAULT_ORIGIN }) => {
    if (!enabled) return;
    if (url.startsWith(appOrigin)) return;

    try {
      const parsed = new URL(url);
      if (/\\.(pdf|xdp)$/i.test(parsed.pathname)) {
        const redirectUrl =
          appOrigin.replace(/\\/$/, '') +
          '/?pdfProtocol=' +
          encodeURIComponent('web+pdf://' + url);
        chrome.tabs.update(tabId, { url: redirectUrl });
      }
    } catch (_) {
      // ignore invalid URLs
    }
  });
});
`;

  const contentJs = `const DEFAULT_ORIGIN = '${origin}';

let handlerEnabled = true;
let configuredOrigin = DEFAULT_ORIGIN;

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get(['enabled', 'appOrigin'], (res) => {
    if (typeof res.enabled === 'boolean') handlerEnabled = res.enabled;
    if (res.appOrigin) configuredOrigin = res.appOrigin;
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) handlerEnabled = Boolean(changes.enabled.newValue);
    if (changes.appOrigin && changes.appOrigin.newValue) {
      configuredOrigin = changes.appOrigin.newValue;
    }
  });
}

document.addEventListener(
  'click',
  (event) => {
    if (!handlerEnabled) return;
    if (window.location.origin === configuredOrigin) return;

    const target = event.target;
    const anchor = target && target.closest ? target.closest('a[href]') : null;
    if (!anchor || anchor.hasAttribute('download')) return;

    const href = anchor.getAttribute('href') || '';
    const matchesPdf = /\\.(pdf|xdp|xfdf)(\\?.*)?$/i.test(href);
    const matchesScheme = /^(web\\+pdf|web\\+xfa|web\\+xdp):/i.test(href);

    if (matchesPdf || matchesScheme) {
      event.preventDefault();
      event.stopPropagation();
      const resolvedUrl = matchesScheme ? href : new URL(href, window.location.href).href;
      const protocolPayload = matchesScheme ? resolvedUrl : 'web+pdf://' + resolvedUrl;
      window.location.href =
        configuredOrigin.replace(/\\/$/, '') +
        '/?pdfProtocol=' +
        encodeURIComponent(protocolPayload);
    }
  },
  true
);
`;

  const popupHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AcroXFA PDF Handler</title>
  <style>
    body {
      margin: 0;
      width: 280px;
      padding: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      font-size: 12px;
    }
    h1 { font-size: 13px; margin: 0 0 6px; }
    p { margin: 0 0 12px; color: #94a3b8; line-height: 1.45; }
    label { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer; }
    button {
      width: 100%;
      padding: 8px 10px;
      border: none;
      border-radius: 6px;
      background: #0284c7;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #0369a1; }
  </style>
</head>
<body>
  <h1>AcroXFA Default PDF Handler</h1>
  <p>Automatically routes browser .pdf and .xdp links to AcroXFA.</p>
  <label>
    <input type="checkbox" id="toggleEnabled" checked />
    <span>Enable automatic PDF interception</span>
  </label>
  <button id="openAppBtn" type="button">Open AcroXFA Workspace</button>
  <script src="popup.js"></script>
</body>
</html>
`;

  const popupJs = `const DEFAULT_ORIGIN = '${origin}';
const checkbox = document.getElementById('toggleEnabled');
const openBtn = document.getElementById('openAppBtn');

chrome.storage.sync.get(['enabled', 'appOrigin'], ({ enabled = true, appOrigin = DEFAULT_ORIGIN }) => {
  checkbox.checked = Boolean(enabled);
  openBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: appOrigin });
  });
});

checkbox.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: checkbox.checked });
});
`;

  return {
    'manifest.json': manifestJson,
    'background.js': backgroundJs,
    'content.js': contentJs,
    'popup.html': popupHtml,
    'popup.js': popupJs,
  };
}

/**
 * Downloads a standalone Chrome/Edge/Brave Manifest V3 browser extension ZIP
 * that makes AcroXFA the default browser handler for .pdf and .xdp links/tabs.
 */
export async function downloadBrowserExtensionZip(appOrigin?: string): Promise<string> {
  const origin =
    appOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000');
  const zip = new JSZip();
  const folder = zip.folder('acroxfa-pdf-handler-extension');
  if (!folder) throw new Error('Failed to initialize ZIP archive');

  const files = buildExtensionFiles(origin);
  Object.entries(files).forEach(([name, content]) => {
    folder.file(name, content);
  });

  folder.file(
    'INSTALL.txt',
    `AcroXFA Default Browser PDF Handler Extension (Manifest V3)
============================================================

Install in Chrome, Edge, Brave, or Arc:
1. Extract this ZIP folder to a permanent location on your computer.
2. Open chrome://extensions (or edge://extensions) in your browser.
3. Enable "Developer mode" in the top-right corner.
4. Click "Load unpacked" and select the "acroxfa-pdf-handler-extension" folder.
5. Every .pdf, .xdp, and web+pdf:// link you open will now launch directly in AcroXFA (${origin}).
`
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = 'acroxfa-browser-pdf-handler-extension.zip';
  triggerBlobDownload(blob, filename);
  return filename;
}

/**
 * Downloads the full AcroXFA Web App Desktop Installer & Default PDF Handler Bundle (.zip)
 * containing OS standalone launchers (Windows .bat, macOS .command, Linux .desktop with PDF MIME),
 * portable HTML launcher, and the Manifest V3 browser extension.
 */
export async function downloadWebAppBundleZip(appOrigin?: string): Promise<string> {
  const origin =
    appOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000');

  const zip = new JSZip();

  // 1. README
  zip.file(
    'README.txt',
    `AcroXFA — Standalone Web App & Default Browser PDF Handler Bundle
=================================================================

App URL: ${origin}

1. STANDALONE DESKTOP APP LAUNCHERS
   - Windows: Double-click "Launch-AcroXFA-Windows.bat" to launch AcroXFA in an
     isolated desktop app window (Chrome or Edge --app mode).
   - macOS:   Double-click "Launch-AcroXFA-macOS.command" (or run chmod +x in Terminal)
     to open AcroXFA as a standalone desktop window.
   - Linux:   Copy "AcroXFA.desktop" to ~/.local/share/applications/ and run
     "update-desktop-database ~/.local/share/applications" to register AcroXFA
     as a system PDF handler (application/pdf).
   - Portable: Open "AcroXFA-Launcher.html" in any browser.

2. REGISTER AS DEFAULT BROWSER PDF HANDLER (CHROME / EDGE / BRAVE)
   Option A (PWA + Protocol Handler):
     - Open ${origin} directly in Chrome or Edge.
     - Click the Install icon in the browser address bar to install as an offline PWA.
     - Click "Default PDF Handler" inside AcroXFA to register web+pdf://, web+xfa://,
       and web+xdp:// schemes and enable OS .pdf file associations.

   Option B (Browser-Wide Extension — Intercepts ALL .pdf links & tabs):
     - Open chrome://extensions (or edge://extensions).
     - Turn on "Developer mode".
     - Click "Load unpacked" and select the included "acroxfa-pdf-handler-extension" folder.
`
  );

  // 2. Portable HTML Launcher
  zip.file('AcroXFA-Launcher.html', generatePortableLauncherHtml(origin));

  // 3. Windows Standalone App Launcher (.bat)
  zip.file(
    'Launch-AcroXFA-Windows.bat',
    `@echo off
setlocal
set "APP_URL=${origin}"
if not "%~1"=="" set "APP_URL=${origin}/?pdfProtocol=web%%2Bpdf://%~1"

if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
  start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%APP_URL%"
  exit /b 0
)
if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (
  start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%APP_URL%"
  exit /b 0
)
if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
  start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%APP_URL%"
  exit /b 0
)
start "" "%APP_URL%"
`
  );

  // 4. macOS Standalone App Launcher (.command)
  zip.file(
    'Launch-AcroXFA-macOS.command',
    `#!/bin/bash
APP_URL="${origin}"
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="$APP_URL"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="$APP_URL"
else
  open "$APP_URL"
fi
`
  );

  // 5. Linux XDG .desktop entry with application/pdf MIME association
  zip.file(
    'AcroXFA.desktop',
    `[Desktop Entry]
Version=1.0
Type=Application
Name=AcroXFA PDF & XFA Editor
Comment=Inspect, edit, fill, and convert XFA and standard PDF forms offline
Exec=google-chrome --app=${origin} %u
Terminal=false
Categories=Office;Viewer;Utility;
MimeType=application/pdf;application/vnd.adobe.xdp+xml;application/vnd.adobe.xfdf;x-scheme-handler/web+pdf;x-scheme-handler/web+xfa;
StartupNotify=true
`
  );

  // 6. Embedded Manifest V3 Browser Extension folder
  const extFolder = zip.folder('acroxfa-pdf-handler-extension');
  if (extFolder) {
    const extFiles = buildExtensionFiles(origin);
    Object.entries(extFiles).forEach(([name, content]) => {
      extFolder.file(name, content);
    });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = 'AcroXFA-WebApp-Installer.zip';
  triggerBlobDownload(blob, filename);
  return filename;
}

/**
 * Downloads the single portable HTML shortcut launcher for AcroXFA.
 */
export function downloadPortableHtmlLauncher(appOrigin?: string): string {
  const html = generatePortableLauncherHtml(appOrigin);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const filename = 'AcroXFA-WebApp.html';
  triggerBlobDownload(blob, filename);
  return filename;
}
