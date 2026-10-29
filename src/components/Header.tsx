import React from 'react';
import { FileText, Download, FolderArchive, ShieldCheck, FileSpreadsheet, Layers, Keyboard, Network, Sparkles } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { GlobalFieldSearch } from './GlobalFieldSearch';
import { XFAField } from '../types/pdf';

interface HeaderProps {
  activeTab: 'form' | 'xml' | 'resources' | 'preview' | 'preflight' | 'convert' | 'batch' | 'fieldmap' | 'assistant';
  setActiveTab: (tab: 'form' | 'xml' | 'resources' | 'preview' | 'preflight' | 'convert' | 'batch' | 'fieldmap' | 'assistant') => void;
  onExportPdf: () => void;
  onDownloadAllResources: () => void;
  isExportingPdf: boolean;
  isExportingZip: boolean;
  hasXfa: boolean;
  resourceCount: number;
  preflightErrorsCount?: number;
  preflightWarningsCount?: number;
  fields?: XFAField[];
  onSelectField?: (field: XFAField) => void;
  onOpenShortcuts?: () => void;
  uiMode?: 'acrobat' | 'studio';
  onSwitchToAcrobatUI?: () => void;
  onSwitchToStudioUI?: () => void;
  onLoadCanadaBookFund?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onExportPdf,
  onDownloadAllResources,
  isExportingPdf,
  isExportingZip,
  hasXfa,
  resourceCount,
  preflightErrorsCount = 0,
  preflightWarningsCount = 0,
  fields = [],
  onSelectField,
  onOpenShortcuts,
  uiMode = 'studio',
  onSwitchToAcrobatUI,
  onSwitchToStudioUI,
  onLoadCanadaBookFund,
}) => {
  return (
    <header className="flex items-center justify-between gap-3 sm:gap-4 lg:gap-6 px-4 sm:px-6 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
            AcroXFA
          </span>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            PDF &amp; XFA Studio
          </span>
        </div>
      </div>

      {/* Zone 2: Concise single-line navigation links */}
      <nav className="flex items-center gap-1 sm:gap-1.5 text-xs md:text-sm font-medium text-slate-300">
        <button
          onClick={() => setActiveTab('preview')}
          title="PDF Canvas & Fields (Alt + 1)"
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'preview'
              ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs'
              : 'hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <span>PDF Canvas &amp; Fields</span>
          {hasXfa && (
            <span className="text-[10px] px-1.5 py-0.2 bg-sky-950/80 text-sky-300 border border-sky-800/80 rounded font-mono">
              Visual Map
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('form')}
          title="Visual Form Editor (Alt + 2)"
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'form'
              ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs'
              : 'hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <span>Visual Form</span>
          {hasXfa && (
            <span className="text-[10px] px-1.5 py-0.2 bg-sky-500/20 text-sky-300 rounded font-mono">
              XFA
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('fieldmap')}
          title="Field Map & Dependency Graph (Alt + 3)"
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'fieldmap'
              ? 'bg-indigo-900/60 text-indigo-300 font-semibold shadow-xs border border-indigo-700/60'
              : 'hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <Network className="w-3.5 h-3.5 text-indigo-400" />
          <span>Field Map</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-indigo-950/90 text-indigo-300 border border-indigo-800 rounded font-mono">
            Graph
          </span>
        </button>

        <button
          onClick={() => setActiveTab('assistant')}
          title="Smart Form Assistant: AI Autofill & Context Suggestions (Alt + A)"
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'assistant'
              ? 'bg-purple-900/60 text-purple-200 font-semibold shadow-xs border border-purple-700/60'
              : 'hover:text-purple-200 hover:bg-slate-800/50 text-slate-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>AI Assistant</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-purple-950/90 text-purple-300 border border-purple-800 rounded font-mono">
            Gemini
          </span>
        </button>

        <button
          onClick={() => setActiveTab('xml')}
          title="XFA XML Data (Alt + 4)"
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'xml'
              ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs'
              : 'hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          XFA XML Data
        </button>

        <button
          onClick={() => setActiveTab('preflight')}
          title="Preflight Audit (Alt + 4)"
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'preflight'
              ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs'
              : 'hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
          <span>Preflight</span>
          {preflightErrorsCount > 0 ? (
            <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-800 rounded-full font-mono">
              {preflightErrorsCount}
            </span>
          ) : preflightWarningsCount > 0 ? (
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-800 rounded-full font-mono">
              {preflightWarningsCount}
            </span>
          ) : (
            <span className="text-[10px] px-1 text-emerald-400 font-mono">✓</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('convert')}
          title="Document Conversion (Alt + 5)"
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'convert'
              ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs'
              : 'hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
          <span>Convert</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-950/80 text-emerald-300 border border-emerald-800 rounded font-mono">
            Word &amp; More
          </span>
        </button>

        <button
          onClick={() => setActiveTab('resources')}
          title="Extract Resources (Alt + 6)"
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'resources'
              ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs'
              : 'hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <span>Extract Resources</span>
          {resourceCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-700 text-slate-200 rounded-full font-mono">
              {resourceCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('batch')}
          title="Batch Extract CSV / JSON (Alt + 7)"
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'batch'
              ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs'
              : 'hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>Batch Extract</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-purple-950/80 text-purple-300 border border-purple-800 rounded font-mono">
            CSV / JSON
          </span>
        </button>
      </nav>

      {/* Zone 3: Global Field Search Bar */}
      {onSelectField && (
        <div className="w-36 sm:w-48 md:w-56 lg:w-72 xl:w-80 shrink-0">
          <GlobalFieldSearch fields={fields} onSelectField={onSelectField} />
        </div>
      )}

      {/* Zone 4: Primary Actions & PWA Install */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Acrobat vs Studio UI Segmented Switcher */}
        {onSwitchToAcrobatUI && (
          <div className="flex items-center p-0.5 rounded-lg bg-slate-800/90 border border-slate-700 shrink-0">
            <button
              onClick={onSwitchToAcrobatUI}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                uiMode === 'acrobat'
                  ? 'bg-[#eb1000] text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Switch to Adobe Acrobat Style UI"
            >
              <span className={`w-2 h-2 rounded-full ${uiMode === 'acrobat' ? 'bg-white' : 'bg-[#eb1000]'}`} />
              <span>Acrobat</span>
            </button>
            <button
              onClick={onSwitchToStudioUI}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                uiMode === 'studio'
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Switch to Developer Studio UI"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Studio</span>
            </button>
          </div>
        )}

        <PWAInstallButton />

        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (?)"
            aria-label="Keyboard Shortcuts"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors shrink-0"
          >
            <Keyboard className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden xl:inline">Shortcuts</span>
            <kbd className="hidden sm:inline-block px-1 py-0.2 bg-slate-900 border border-slate-700 text-[10px] rounded font-mono text-slate-400">
              ?
            </kbd>
          </button>
        )}

        <button
          onClick={onDownloadAllResources}
          disabled={isExportingZip}
          title="Extract and download all resources as ZIP (Ctrl+Shift+Z / ⇧⌘Z)"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <FolderArchive className="w-3.5 h-3.5 text-sky-400" />
          <span>{isExportingZip ? 'Packaging ZIP...' : 'Zip Resources'}</span>
        </button>

        <button
          onClick={onExportPdf}
          disabled={isExportingPdf}
          title="Save & Export PDF (Ctrl+S / ⌘S)"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 active:bg-sky-500 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExportingPdf ? 'Saving PDF...' : 'Export PDF'}</span>
          <kbd className="hidden sm:inline-block ml-0.5 px-1 py-0.2 bg-sky-500/40 text-slate-950 rounded text-[10px] font-mono font-semibold">
            ⌘S
          </kbd>
        </button>
      </div>
    </header>
  );
};
