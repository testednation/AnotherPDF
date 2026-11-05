import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  FolderArchive,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  Keyboard,
  Network,
  Sparkles,
  Printer,
  Globe,
  Search,
  Sliders,
  X,
  CheckSquare,
  ChevronDown,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { GlobalFieldSearch } from './GlobalFieldSearch';
import { XFAField } from '../types/pdf';

interface HeaderProps {
  activeTab: 'form' | 'xml' | 'resources' | 'preview' | 'preflight' | 'convert' | 'batch' | 'fieldmap' | 'assistant';
  setActiveTab: (tab: 'form' | 'xml' | 'resources' | 'preview' | 'preflight' | 'convert' | 'batch' | 'fieldmap' | 'assistant') => void;
  onExportPdf: () => void;
  onDownloadAllResources: () => void;
  onOpenPrintScale?: () => void;
  isExportingPdf: boolean;
  isExportingZip: boolean;
  hasXfa: boolean;
  resourceCount: number;
  preflightErrorsCount?: number;
  preflightWarningsCount?: number;
  fields?: XFAField[];
  onSelectField?: (field: XFAField) => void;
  onEditFieldInForm?: (field: XFAField) => void;
  onOpenShortcuts?: () => void;
  uiMode?: 'acrobat' | 'studio';
  onSwitchToAcrobatUI?: () => void;
  onSwitchToStudioUI?: () => void;
  onLoadCanadaBookFund?: () => void;
  onLoadAttachedXfa?: () => void;
  onOpenProtocolHandler?: () => void;
  isProtocolHandlerActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onExportPdf,
  onDownloadAllResources,
  onOpenPrintScale,
  isExportingPdf,
  isExportingZip,
  hasXfa,
  resourceCount,
  preflightErrorsCount = 0,
  preflightWarningsCount = 0,
  fields = [],
  onSelectField,
  onEditFieldInForm,
  onOpenShortcuts,
  uiMode = 'studio',
  onSwitchToAcrobatUI,
  onSwitchToStudioUI,
  onLoadCanadaBookFund,
  onLoadAttachedXfa,
  onOpenProtocolHandler,
  isProtocolHandlerActive = false,
}) => {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [mobileMoreTabsOpen, setMobileMoreTabsOpen] = useState(false);

  useEffect(() => {
    const closeMenus = () => setToolsMenuOpen(false);
    window.addEventListener('click', closeMenus);
    return () => window.removeEventListener('click', closeMenus);
  }, []);

  return (
    <>
      <header className="bg-slate-900/95 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40">
        {/* Top Row: Brand, Search, UI Mode Switcher & Primary Actions */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-2.5">
          {/* Zone 1: Brand Wordmark + UI Mode Switcher */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm sm:text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
                AcroXFA
              </span>
              <span className="text-xs text-slate-400 font-mono hidden lg:inline">
                PDF &amp; XFA Studio
              </span>
            </div>

            {/* Acrobat vs Studio UI Segmented Switcher */}
            {onSwitchToAcrobatUI && (
              <div className="flex items-center p-0.5 rounded-lg bg-slate-800/90 border border-slate-700 shrink-0 ml-1">
                <button
                  onClick={onSwitchToAcrobatUI}
                  className={`px-2 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                    uiMode === 'acrobat'
                      ? 'bg-[#eb1000] text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                  }`}
                  title="Switch to Adobe Acrobat Style UI"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${uiMode === 'acrobat' ? 'bg-white' : 'bg-[#eb1000]'}`} />
                  <span>Acrobat</span>
                </button>
                <button
                  onClick={onSwitchToStudioUI}
                  className={`px-2 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                    uiMode === 'studio'
                      ? 'bg-sky-500 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                  }`}
                  title="Switch to Developer Studio UI"
                >
                  <Layers className="w-3 h-3" />
                  <span>Studio</span>
                </button>
              </div>
            )}
          </div>

          {/* Zone 2: Global Field Search Bar (Desktop/Tablet inline, Mobile toggle button) */}
          {onSelectField && (
            <div className="hidden md:block flex-1 max-w-xs lg:max-w-sm mx-2">
              <GlobalFieldSearch
                fields={fields}
                onSelectField={onSelectField}
                onEditFieldInForm={onEditFieldInForm}
              />
            </div>
          )}

          {/* Zone 3: Actions & Compact Tools Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile Search Toggle Button */}
            {onSelectField && (
              <button
                onClick={() => setMobileSearchOpen(prev => !prev)}
                className={`md:hidden p-2 rounded-lg border text-xs transition-colors ${
                  mobileSearchOpen
                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
                title="Search form fields"
                aria-label="Search form fields"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {onLoadAttachedXfa && (
              <button
                onClick={onLoadAttachedXfa}
                className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-200 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/70 rounded-lg transition-colors shadow-xs cursor-pointer"
                title="Load the attached dynamic LiveCycle XFA PDF (xfa_771a0a93.pdf)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Attached XFA</span>
                <span className="text-[10px] font-mono bg-amber-500/20 px-1 rounded text-amber-300">44</span>
              </button>
            )}

            {onOpenProtocolHandler && (
              <button
                onClick={onOpenProtocolHandler}
                title="Configure Browser Default PDF & XFA Protocol Handler (web+pdf://, web+xfa://, .pdf takeover)"
                className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors shrink-0 cursor-pointer ${
                  isProtocolHandlerActive
                    ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border-emerald-600/70'
                    : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-700'
                }`}
              >
                <Globe className={`w-3.5 h-3.5 ${isProtocolHandlerActive ? 'text-emerald-400' : 'text-sky-400'}`} />
                <span>Default PDF Handler</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isProtocolHandlerActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  }`}
                />
              </button>
            )}

            {onOpenPrintScale && (
              <button
                onClick={onOpenPrintScale}
                title="Scale Printout Between Printer Paper Sizes (Letter ↔ A4 / Legal / Tabloid)"
                className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-sky-200 bg-sky-950/70 hover:bg-sky-900 border border-sky-700/70 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-sky-400" />
                <span>Scale Print</span>
              </button>
            )}

            <button
              onClick={onDownloadAllResources}
              disabled={isExportingZip}
              title="Extract and download all resources as ZIP (Ctrl+Shift+Z / ⇧⌘Z)"
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <FolderArchive className="w-3.5 h-3.5 text-sky-400" />
              <span>{isExportingZip ? 'Zipping...' : 'Zip Assets'}</span>
            </button>

            <div className="hidden sm:block">
              <PWAInstallButton />
            </div>

            {onOpenShortcuts && (
              <button
                onClick={onOpenShortcuts}
                title="Keyboard Shortcuts (?)"
                aria-label="Keyboard Shortcuts"
                className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors shrink-0"
              >
                <Keyboard className="w-3.5 h-3.5 text-sky-400" />
                <kbd className="px-1 py-0.2 bg-slate-900 border border-slate-700 text-[10px] rounded font-mono text-slate-400">
                  ?
                </kbd>
              </button>
            )}

            {/* Compact Tools Dropdown for Mobile/Tablet/Laptop (< xl) */}
            <div className="relative xl:hidden">
              <button
                onClick={e => {
                  e.stopPropagation();
                  setToolsMenuOpen(prev => !prev);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Quick Tools & Samples"
              >
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Tools</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {toolsMenuOpen && (
                <div
                  onClick={e => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50 text-xs text-slate-200"
                >
                  <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    Quick Tools &amp; Samples
                  </div>
                  {onLoadAttachedXfa && (
                    <button
                      onClick={() => {
                        onLoadAttachedXfa();
                        setToolsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between text-amber-300 font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Load Attached XFA</span>
                      </span>
                      <span className="text-[10px] font-mono bg-amber-500/20 px-1.5 py-0.5 rounded">44 Fields</span>
                    </button>
                  )}
                  {onLoadCanadaBookFund && (
                    <button
                      onClick={() => {
                        onLoadCanadaBookFund();
                        setToolsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between text-red-300"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span>Canada Book Fund (cBF)</span>
                      </span>
                      <span className="text-[10px] font-mono text-red-400">Official</span>
                    </button>
                  )}
                  {onOpenPrintScale && (
                    <button
                      onClick={() => {
                        onOpenPrintScale();
                        setToolsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between text-sky-300"
                    >
                      <span className="flex items-center gap-2">
                        <Printer className="w-3.5 h-3.5 text-sky-400" />
                        <span>Scale Printout Paper Size</span>
                      </span>
                    </button>
                  )}
                  {onOpenProtocolHandler && (
                    <button
                      onClick={() => {
                        onOpenProtocolHandler();
                        setToolsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between text-emerald-300"
                    >
                      <span className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Default Browser PDF Handler</span>
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-950 px-1.5 py-0.5 rounded">
                        {isProtocolHandlerActive ? 'ON' : 'SET'}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onDownloadAllResources();
                      setToolsMenuOpen(false);
                    }}
                    disabled={isExportingZip}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <FolderArchive className="w-3.5 h-3.5 text-sky-400" />
                      <span>Download Resources ZIP</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{resourceCount}</span>
                  </button>
                  {onOpenShortcuts && (
                    <button
                      onClick={() => {
                        onOpenShortcuts();
                        setToolsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between text-slate-300 border-t border-slate-800 mt-1 pt-2"
                    >
                      <span className="flex items-center gap-2">
                        <Keyboard className="w-3.5 h-3.5 text-sky-400" />
                        <span>Keyboard Shortcuts</span>
                      </span>
                      <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-[10px] font-mono">?</kbd>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={onExportPdf}
              disabled={isExportingPdf}
              title="Save & Export PDF (Ctrl+S / ⌘S)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 active:bg-sky-500 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Saving...' : 'Export PDF'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Mobile Field Search Bar */}
        {mobileSearchOpen && onSelectField && (
          <div className="md:hidden px-3 pb-2.5 border-t border-slate-800/80 pt-2 bg-slate-950/60">
            <GlobalFieldSearch
              fields={fields}
              onSelectField={f => {
                onSelectField(f);
                setMobileSearchOpen(false);
              }}
              onEditFieldInForm={
                onEditFieldInForm
                  ? f => {
                      onEditFieldInForm(f);
                      setMobileSearchOpen(false);
                    }
                  : undefined
              }
            />
          </div>
        )}

        {/* Second Row: Horizontally Scrollable Navigation Tabs (Clean & Uncluttered) */}
        <nav className="flex items-center gap-1 px-3 sm:px-6 py-1.5 bg-slate-950/60 border-t border-slate-800/80 overflow-x-auto no-scrollbar text-xs font-medium text-slate-300">
          <button
            onClick={() => setActiveTab('preview')}
            title="PDF Canvas & Fields (Alt + 1)"
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'preview'
                ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs border border-slate-700'
                : 'hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            <span>PDF Canvas</span>
            {hasXfa && (
              <span className="hidden xl:inline text-[10px] px-1.5 py-0.2 bg-sky-950/80 text-sky-300 border border-sky-800/80 rounded font-mono">
                Visual Map
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('form')}
            title="Visual Form Editor (Alt + 2)"
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'form'
                ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs border border-slate-700'
                : 'hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            <span>Visual Form</span>
            {hasXfa && (
              <span className="hidden xl:inline text-[10px] px-1.5 py-0.2 bg-sky-500/20 text-sky-300 rounded font-mono">
                XFA
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('fieldmap')}
            title="Field Map & Dependency Graph (Alt + 3)"
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'fieldmap'
                ? 'bg-indigo-900/60 text-indigo-300 font-semibold shadow-xs border border-indigo-700/60'
                : 'hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-indigo-400" />
            <span>Field Map</span>
          </button>

          <button
            onClick={() => setActiveTab('assistant')}
            title="Smart Form Assistant: AI Autofill & Context Suggestions (Alt + A)"
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'assistant'
                ? 'bg-purple-900/60 text-purple-200 font-semibold shadow-xs border border-purple-700/60'
                : 'hover:text-purple-200 hover:bg-slate-800/50 text-slate-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Assistant</span>
          </button>

          <button
            onClick={() => setActiveTab('batch')}
            title="Batch Extract, Merge, Analysis & PKCS#7 Signatures (Alt + 7)"
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'batch'
                ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs border border-slate-700'
                : 'hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Batch Suite</span>
            <span className="hidden xl:inline text-[10px] px-1.5 py-0.2 bg-purple-950/80 text-purple-300 border border-purple-800 rounded font-mono">
              Merge &amp; PKCS#7
            </span>
          </button>

          <button
            onClick={() => setActiveTab('convert')}
            title="Document Conversion (Alt + 5)"
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'convert'
                ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs border border-slate-700'
                : 'hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
            <span>Convert</span>
          </button>

          <button
            onClick={() => setActiveTab('preflight')}
            title="Preflight Audit (Alt + 4)"
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'preflight'
                ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs border border-slate-700'
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
            onClick={() => setActiveTab('resources')}
            title="Extract Resources (Alt + 6)"
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'resources'
                ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs border border-slate-700'
                : 'hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            <span>Resources</span>
            {resourceCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-700 text-slate-200 rounded-full font-mono">
                {resourceCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('xml')}
            title="XFA XML Data (Alt + 4)"
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'xml'
                ? 'bg-slate-800 text-sky-400 font-semibold shadow-xs border border-slate-700'
                : 'hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            XFA XML
          </button>
        </nav>
      </header>

      {/* Mobile Thumb-Friendly Bottom Navigation Bar in Studio Mode (md:hidden) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => {
            setActiveTab('preview');
            setMobileMoreTabsOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'preview' && !mobileMoreTabsOpen
              ? 'text-sky-400 bg-sky-500/15 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>PDF Canvas</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('form');
            setMobileMoreTabsOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'form' && !mobileMoreTabsOpen
              ? 'text-sky-400 bg-sky-500/15 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Fill Form</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('assistant');
            setMobileMoreTabsOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'assistant' && !mobileMoreTabsOpen
              ? 'text-purple-400 bg-purple-500/15 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>AI Assist</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('batch');
            setMobileMoreTabsOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'batch' && !mobileMoreTabsOpen
              ? 'text-emerald-400 bg-emerald-500/15 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Batch</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('convert');
            setMobileMoreTabsOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'convert' && !mobileMoreTabsOpen
              ? 'text-sky-400 bg-sky-500/15 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Convert</span>
        </button>

        <button
          onClick={() => setMobileMoreTabsOpen(prev => !prev)}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            mobileMoreTabsOpen || ['fieldmap', 'preflight', 'resources', 'xml'].includes(activeTab)
              ? 'text-amber-400 bg-amber-500/15 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile More Tabs Sheet in Studio Mode (md:hidden) */}
      {mobileMoreTabsOpen && (
        <div
          onClick={() => setMobileMoreTabsOpen(false)}
          className="md:hidden fixed inset-0 bottom-14 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-slate-900 border-t border-slate-700 rounded-t-2xl p-4 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                All Studio Workspaces &amp; Tools
              </span>
              <button
                onClick={() => setMobileMoreTabsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => {
                  setActiveTab('fieldmap');
                  setMobileMoreTabsOpen(false);
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 flex items-center gap-2.5 text-left"
              >
                <Network className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Field Map</div>
                  <div className="text-[10px] text-slate-400">Dependency Graph</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab('preflight');
                  setMobileMoreTabsOpen(false);
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 flex items-center gap-2.5 text-left"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Preflight Audit</div>
                  <div className="text-[10px] text-slate-400">Compliance Checks</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab('resources');
                  setMobileMoreTabsOpen(false);
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 flex items-center gap-2.5 text-left"
              >
                <FolderArchive className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Resources ({resourceCount})</div>
                  <div className="text-[10px] text-slate-400">Images &amp; Fonts</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab('xml');
                  setMobileMoreTabsOpen(false);
                }}
                className="p-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 flex items-center gap-2.5 text-left"
              >
                <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Raw XFA XML</div>
                  <div className="text-[10px] text-slate-400">Packets &amp; XDP</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

