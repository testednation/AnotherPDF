import React from 'react';
import { FileText, Download, FolderArchive, ShieldCheck, FileSpreadsheet, Layers } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: 'form' | 'xml' | 'resources' | 'preview' | 'preflight' | 'convert' | 'batch';
  setActiveTab: (tab: 'form' | 'xml' | 'resources' | 'preview' | 'preflight' | 'convert' | 'batch') => void;
  onExportPdf: () => void;
  onDownloadAllResources: () => void;
  isExportingPdf: boolean;
  isExportingZip: boolean;
  hasXfa: boolean;
  resourceCount: number;
  preflightErrorsCount?: number;
  preflightWarningsCount?: number;
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
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40">
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
          onClick={() => setActiveTab('form')}
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
          onClick={() => setActiveTab('xml')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'xml'
              ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs'
              : 'hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          XFA XML Data
        </button>

        <button
          onClick={() => setActiveTab('preview')}
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
          onClick={() => setActiveTab('preflight')}
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

      {/* Zone 3: Primary Actions & PWA Install */}
      <div className="flex items-center gap-2.5 shrink-0">
        <PWAInstallButton />

        <button
          onClick={onDownloadAllResources}
          disabled={isExportingZip}
          title="Extract and download all images, fonts, attachments, and XML as a ZIP archive"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <FolderArchive className="w-3.5 h-3.5 text-sky-400" />
          <span>{isExportingZip ? 'Packaging ZIP...' : 'Zip Resources'}</span>
        </button>

        <button
          onClick={onExportPdf}
          disabled={isExportingPdf}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 active:bg-sky-500 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExportingPdf ? 'Saving PDF...' : 'Export PDF'}</span>
        </button>
      </div>
    </header>
  );
};
