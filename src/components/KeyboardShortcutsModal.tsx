import React, { useEffect, useRef } from 'react';
import {
  Keyboard,
  X,
  FileDown,
  FileCode,
  FolderArchive,
  Search,
  ArrowRight,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
  FileText,
  Compass,
} from 'lucide-react';

export interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'saving' | 'tabs' | 'navigation' | 'canvas' | 'general';
  action?: () => void;
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTabSelect?: (tab: 'form' | 'xml' | 'resources' | 'preview' | 'preflight' | 'convert' | 'batch') => void;
  onExportPdf?: () => void;
  onExportXml?: () => void;
  onDownloadAllZip?: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  onTabSelect,
  onExportPdf,
  onExportXml,
  onDownloadAllZip,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';
  const altKey = isMac ? '⌥' : 'Alt';

  // Handle ESC to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const renderKey = (key: string, idx: number) => {
    const displayKey = key
      .replace('Mod', modKey)
      .replace('Alt', altKey)
      .replace('Shift', isMac ? '⇧' : 'Shift');

    return (
      <kbd
        key={idx}
        className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono font-medium text-slate-200 bg-slate-800/90 border border-slate-700/80 rounded shadow-xs"
      >
        {displayKey}
      </kbd>
    );
  };

interface ModalShortcutItem {
  keys: string[];
  description: string;
  badge?: string;
  onClick?: () => void;
}

interface ModalSection {
  title: string;
  icon: React.ReactNode;
  items: ModalShortcutItem[];
}

  const sections: ModalSection[] = [
    {
      title: 'Form Saving & Export',
      icon: <FileDown className="w-4 h-4 text-sky-400" />,
      items: [
        {
          keys: ['Mod', 'S'],
          description: 'Save & Export PDF with updated XFA fields',
          onClick: onExportPdf,
          badge: 'Core',
        },
        {
          keys: ['Mod', 'Shift', 'S'],
          description: 'Export XFA Datasets as XML file',
          onClick: onExportXml,
        },
        {
          keys: ['Mod', 'Shift', 'J'],
          description: 'Export Form Values as clean JSON',
        },
        {
          keys: ['Mod', 'Shift', 'Z'],
          description: 'Download All Extracted Resources (ZIP archive)',
          onClick: onDownloadAllZip,
        },
      ],
    },
    {
      title: 'Tab Switching & Workspaces',
      icon: <Layers className="w-4 h-4 text-emerald-400" />,
      items: [
        {
          keys: ['Alt', '1'],
          description: 'Switch to Visual Form Editor',
          onClick: () => onTabSelect?.('form'),
        },
        {
          keys: ['Alt', '2'],
          description: 'Switch to XFA XML Data packets',
          onClick: () => onTabSelect?.('xml'),
        },
        {
          keys: ['Alt', '3'],
          description: 'Switch to PDF Canvas & Fields Visual Map',
          onClick: () => onTabSelect?.('preview'),
        },
        {
          keys: ['Alt', '4'],
          description: 'Switch to Preflight Audit & Diagnostics',
          onClick: () => onTabSelect?.('preflight'),
        },
        {
          keys: ['Alt', '5'],
          description: 'Switch to Document Conversion (Word / HTML)',
          onClick: () => onTabSelect?.('convert'),
        },
        {
          keys: ['Alt', '6'],
          description: 'Switch to Resource Extractor (Images, Fonts)',
          onClick: () => onTabSelect?.('resources'),
        },
        {
          keys: ['Alt', '7'],
          description: 'Switch to Batch Processing (Bulk XFA -> CSV)',
          onClick: () => onTabSelect?.('batch'),
        },
        {
          keys: ['Mod', ']'],
          description: 'Next Workspace Tab (or Alt + →)',
        },
        {
          keys: ['Mod', '['],
          description: 'Previous Workspace Tab (or Alt + ←)',
        },
      ],
    },
    {
      title: 'Search & Quick Navigation',
      icon: <Search className="w-4 h-4 text-amber-400" />,
      items: [
        {
          keys: ['Mod', 'K'],
          description: 'Focus Global XFA Field Search bar',
          badge: 'Quick',
        },
        {
          keys: ['/'],
          description: 'Focus Search bar (when not typing in field)',
        },
        {
          keys: ['Esc'],
          description: 'Dismiss Search / Close Dialogs & Panels',
        },
      ],
    },
    {
      title: 'PDF Canvas & Page Controls',
      icon: <Compass className="w-4 h-4 text-purple-400" />,
      items: [
        {
          keys: ['PageDown'],
          description: 'Next PDF Page (or J when canvas focused)',
        },
        {
          keys: ['PageUp'],
          description: 'Previous PDF Page (or K when canvas focused)',
        },
        {
          keys: ['+'],
          description: 'Zoom In Canvas (or =)',
        },
        {
          keys: ['-'],
          description: 'Zoom Out Canvas',
        },
        {
          keys: ['0'],
          description: 'Reset Zoom to default fit',
        },
      ],
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        ref={modalRef}
        className="w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 id="shortcuts-dialog-title" className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Keyboard Shortcuts
                <span className="text-xs px-2 py-0.5 font-normal rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {isMac ? 'macOS Keybindings' : 'Windows / Linux'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Speed up your PDF editing, form filling, and navigation workflows
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts dialog"
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 divide-y divide-slate-800/80">
          {sections.map((section, sIdx) => (
            <div key={section.title} className={sIdx > 0 ? 'pt-6' : ''}>
              <div className="flex items-center gap-2 mb-3">
                {section.icon}
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {section.title}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {section.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    onClick={() => {
                      if (item.onClick) {
                        item.onClick();
                        onClose();
                      }
                    }}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/40 text-xs transition-colors ${
                      item.onClick
                        ? 'hover:bg-slate-800/60 hover:border-slate-700 cursor-pointer group'
                        : ''
                    }`}
                  >
                    <span className="text-slate-300 group-hover:text-slate-100 truncate pr-2">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.badge && (
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-400 border border-sky-800/50 mr-1 hidden sm:inline-block">
                          {item.badge}
                        </span>
                      )}
                      {item.keys.map((k, kIdx) => (
                        <React.Fragment key={kIdx}>
                          {renderKey(k, kIdx)}
                          {kIdx < item.keys.length - 1 && (
                            <span className="text-slate-500 text-[10px]">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Press <kbd className="font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">?</kbd> at any time to open this cheat sheet</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
