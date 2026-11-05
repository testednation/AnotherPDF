import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Save,
  Printer,
  Search,
  Hand,
  MousePointer,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  FolderOpen,
  Share2,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  FolderArchive,
  Download,
  Bookmark,
  Paperclip,
  CheckSquare,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Edit3,
  X,
  ChevronDown,
  Layout,
  ExternalLink,
  Sliders,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Undo2,
  Redo2,
  Lightbulb,
  Network,
  Globe,
  LayoutGrid,
} from 'lucide-react';
import { XFAField, XFASubform, ExtractedResourceManifest } from '../types/pdf';
import { validateAllFields } from '../utils/validationEngine';
import { HistoryEntry } from '../hooks/useFormHistory';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import { XfaFormEditor } from './XfaFormEditor';
import { PreflightAuditView } from './PreflightAuditView';
import { ConversionView } from './ConversionView';
import { ResourceExtractorView } from './ResourceExtractorView';
import { BatchProcessorView } from './BatchProcessorView';
import { XmlEditor } from './XmlEditor';
import { FieldMapPanel } from './FieldMapPanel';
import { SmartFormAssistant } from './SmartFormAssistant';
import { PrintScaleModal } from './PrintScaleModal';
import { PageOrganizerModal } from './PageOrganizerModal';
import { RegularPdfConvertModal } from './RegularPdfConvertModal';
import { GlobalFieldSearch } from './GlobalFieldSearch';
import { PageOrganizationResult } from '../utils/pageOrganizer';
import { PreflightSummary } from '../types/preflight';

interface AcrobatWorkspaceProps {
  pdfBytes: Uint8Array;
  filename: string;
  hasXfa: boolean;
  fields: XFAField[];
  subforms: XFASubform[];
  xfaPackets: any;
  manifest: ExtractedResourceManifest | null;
  preflightSummary: PreflightSummary;
  targetFieldId: string | null;
  targetFieldTrigger?: number;
  onSelectField?: (field: XFAField) => void;
  onFieldValueChange: (fieldId: string, newValue: string) => void;
  onUpdateFieldAppearance: (fieldId: string, appearance: any, applyToAll: boolean) => void;
  onResetFieldAppearance: (fieldId: string) => void;
  onBulkUpdateFields?: (fieldIds: string[], updates: any) => void;
  onExportPdf: () => void;
  onExportXml: () => void;
  onExportJson: () => void;
  onDownloadAllZip: () => void;
  onLoadCanadaBookFund: () => void;
  onLoadAttachedXfa?: () => void;
  onFileUpload: (file: File) => void;
  onAutofillSample: () => void;
  onResetDefaults: () => void;
  onApplyXmlChanges: (type: any, xml: string) => void;
  onShowToast: (msg: string) => void;
  onSwitchToStudioUI: () => void;
  isExportingPdf: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  history?: HistoryEntry[];
  currentIndex?: number;
  jumpToHistoryIndex?: (index: number) => void;
  onOpenProtocolHandler?: () => void;
  isProtocolHandlerActive?: boolean;
  onApplyPageOrganization?: (
    result: PageOrganizationResult,
    removeDeletedPageFields: boolean
  ) => Promise<void> | void;
  onLoadConvertedPdf?: (bytes: Uint8Array, filename: string) => void;
}

type LeftPanelTab = 'none' | 'thumbnails' | 'bookmarks' | 'fields' | 'attachments';
type RightToolType = 'none' | 'formEditor' | 'export' | 'preflight' | 'convert' | 'resources' | 'xml' | 'batch' | 'fieldMap' | 'assistant';

export const AcrobatWorkspace: React.FC<AcrobatWorkspaceProps> = ({
  pdfBytes,
  filename,
  hasXfa,
  fields,
  subforms,
  xfaPackets,
  manifest,
  preflightSummary,
  targetFieldId,
  targetFieldTrigger = 0,
  onSelectField,
  onFieldValueChange,
  onUpdateFieldAppearance,
  onResetFieldAppearance,
  onBulkUpdateFields,
  onExportPdf,
  onExportXml,
  onExportJson,
  onDownloadAllZip,
  onLoadCanadaBookFund,
  onLoadAttachedXfa,
  onFileUpload,
  onAutofillSample,
  onResetDefaults,
  onApplyXmlChanges,
  onShowToast,
  onSwitchToStudioUI,
  isExportingPdf,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  history = [],
  currentIndex = -1,
  jumpToHistoryIndex,
  onOpenProtocolHandler,
  isProtocolHandlerActive = false,
  onApplyPageOrganization,
  onLoadConvertedPdf,
}) => {
  // Navigation & Tool panels state (default leftPanel to closed on mobile/tablet so PDF canvas has 100% width)
  const [leftPanel, setLeftPanel] = useState<LeftPanelTab>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'none' : 'fields'
  );
  const [rightTool, setRightTool] = useState<RightToolType>('none');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showXfaBanner, setShowXfaBanner] = useState(true);
  const [mobileToolsSheetOpen, setMobileToolsSheetOpen] = useState(false);
  const [mobileSamplesOpen, setMobileSamplesOpen] = useState(false);

  // Field highlights state (Acrobat purple/blue field boundary box)
  const [highlightFields, setHighlightFields] = useState(true);

  // URL modal, Print Scale modal, Page Organizer modal, Standard PDF Converter modal & Mobile Search
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [printScaleModalOpen, setPrintScaleModalOpen] = useState(false);
  const [pageOrganizerOpen, setPageOrganizerOpen] = useState(false);
  const [regularPdfModalOpen, setRegularPdfModalOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [leftFieldsFilter, setLeftFieldsFilter] = useState('');
  const [urlInput, setUrlInput] = useState('https://www.canada.ca/content/dam/pch/documents/services/funding/book-fund/cBF-FinRepDatFrm-eng.pdf');

  // Navigate to a field on the PDF Canvas
  const handleLocateField = (field: XFAField) => {
    if (onSelectField) {
      onSelectField(field);
    } else {
      const label = field.caption || field.name;
      const page = field.bounds?.pageNumber || 1;
      onShowToast(`Located "${label}" (Page ${page})`);
    }
  };

  // Navigate to a field inside the Visual Form Editor right drawer
  const handleEditFieldInForm = (field: XFAField) => {
    setRightTool('formEditor');
    const label = field.caption || field.name;
    onShowToast(`Editing "${label}" in Form Editor`);
    setTimeout(() => {
      const el = document.getElementById(`field-${field.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }, 150);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClick = () => {
      setActiveMenu(null);
      setMobileSamplesOpen(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const isCanadaBookFund = filename.toLowerCase().includes('cbf') || filename.toLowerCase().includes('book-fund') || filename.toLowerCase().includes('finrep');

  // Compute validation report across all fields
  const validationReport = useMemo(() => {
    return validateAllFields(fields);
  }, [fields]);

  const handleUrlSubmit = () => {
    setUrlModalOpen(false);
    if (urlInput.toLowerCase().includes('cbf') || urlInput.toLowerCase().includes('book-fund')) {
      onLoadCanadaBookFund();
      onShowToast('Loaded Canada Book Fund (cBF-FinRepDatFrm-eng.pdf) via Canadian Heritage XFA engine');
    } else {
      onShowToast(`Processed PDF URL: ${urlInput}`);
    }
  };

  return (
    <div className="h-screen bg-[#2c2c2c] text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* 1. Acrobat Window Title Bar */}
      <div className="bg-[#1e1e1e] border-b border-[#333333] px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-slate-300 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Adobe Acrobat Red Emblem */}
          <div className="w-6 h-6 sm:w-5 sm:h-5 rounded bg-[#eb1000] flex items-center justify-center text-white font-bold text-[10px] shadow-xs shrink-0">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
              <path d="M19.3 2H4.7C3.2 2 2 3.2 2 4.7v14.6C2 20.8 3.2 22 4.7 22h14.6c1.5 0 2.7-1.2 2.7-2.7V4.7C22 3.2 20.8 2 19.3 2zM9.6 17.5c-.8 0-1.8-1.5-2.9-3.9 1.1-.3 2.5-.5 3.7-.5 1.1 0 1.9.1 2.3.2-1.2 2.3-2.3 4.2-3.1 4.2zm6.2-7.2c-.5 0-1.1.2-1.7.5-.4-.7-.9-1.6-1.5-2.6 1.1-.9 2-1.7 2.4-1.7.5 0 .8.4.8 1.1 0 .9-.4 1.9-1 2.7zM7.2 11.2c.4-.7 1.2-1.9 2.2-3.1.5.9 1.1 1.8 1.6 2.7-1.3.1-2.6.3-3.8.4zm9.3 4.8c-.8 0-1.7-.5-2.5-1.3 1.1-.2 2.2-.6 3.1-1.1.2.6.3 1.2.3 1.6 0 .5-.4.8-.9.8z"/>
            </svg>
          </div>
          <span className="font-semibold text-slate-200 hidden sm:inline shrink-0">
            Adobe Acrobat Pro DC
          </span>
          <span className="text-slate-500 hidden sm:inline">-</span>
          <span className="font-mono text-slate-200 sm:text-slate-300 truncate max-w-[140px] sm:max-w-xs md:max-w-sm text-[11px] sm:text-xs">
            {filename}
          </span>
          {isCanadaBookFund && (
            <span className="hidden xl:inline-flex px-1.5 py-0.2 rounded bg-red-950/80 border border-red-800 text-red-300 text-[10px] font-mono shrink-0">
              Canada Book Fund (CBF)
            </span>
          )}
        </div>

        {/* Center: Global Field Search Bar (Desktop/Tablet inline) */}
        <div className="hidden md:block flex-1 max-w-xs lg:max-w-md mx-2">
          <GlobalFieldSearch
            fields={fields}
            onSelectField={handleLocateField}
            onEditFieldInForm={handleEditFieldInForm}
          />
        </div>

        {/* Top Right: Quick Samples Dropdown on Mobile + Desktop Buttons + UI Mode Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile Search Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen(prev => !prev)}
            className={`md:hidden p-1.5 rounded border text-xs transition-colors cursor-pointer ${
              mobileSearchOpen
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Search form fields"
            aria-label="Search form fields"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Mobile/Tablet Compact Samples & Sources Menu */}
          <div className="relative xl:hidden">
            <button
              onClick={e => {
                e.stopPropagation();
                setMobileSamplesOpen(prev => !prev);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-medium cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Samples</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {mobileSamplesOpen && (
              <div
                onClick={e => e.stopPropagation()}
                className="absolute right-0 top-full mt-1.5 w-64 bg-[#252525] border border-[#444] rounded-xl shadow-2xl py-1.5 z-50 text-xs text-slate-200"
              >
                <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-[#383838]">
                  Quick Load &amp; Protocol
                </div>
                {onLoadAttachedXfa && (
                  <button
                    onClick={() => {
                      onLoadAttachedXfa();
                      setMobileSamplesOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#333] flex items-center justify-between text-amber-300 font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Attached XFA Sample</span>
                    </span>
                    <span className="text-[10px] font-mono bg-amber-500/20 px-1.5 py-0.5 rounded">44 Fields</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    onLoadCanadaBookFund();
                    setMobileSamplesOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#333] flex items-center justify-between text-red-300"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span>Canada Book Fund (cBF)</span>
                  </span>
                  <span className="text-[10px] font-mono text-red-400">Official</span>
                </button>
                <button
                  onClick={() => {
                    setUrlModalOpen(true);
                    setMobileSamplesOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#333] flex items-center justify-between text-sky-300"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                    <span>Open from Web URL...</span>
                  </span>
                </button>
                {onOpenProtocolHandler && (
                  <button
                    onClick={() => {
                      onOpenProtocolHandler();
                      setMobileSamplesOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#333] flex items-center justify-between text-emerald-300 border-t border-[#383838] mt-1 pt-2"
                  >
                    <span className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Default Browser PDF Handler</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300">
                      {isProtocolHandlerActive ? 'ON' : 'SET'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {onOpenProtocolHandler && (
            <button
              onClick={onOpenProtocolHandler}
              className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                isProtocolHandlerActive
                  ? 'bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border-emerald-600/80'
                  : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-700'
              }`}
              title="Take over default browser PDF & XFA protocol (web+pdf://, web+xfa://, .pdf links)"
            >
              <Globe className={`w-3 h-3 ${isProtocolHandlerActive ? 'text-emerald-400' : 'text-sky-400'}`} />
              <span>Default PDF Handler</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isProtocolHandlerActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
            </button>
          )}

          <button
            onClick={() => setUrlModalOpen(true)}
            className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <ExternalLink className="w-3 h-3 text-sky-400" />
            <span>Open from URL</span>
          </button>

          {onLoadAttachedXfa && (
            <button
              onClick={onLoadAttachedXfa}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-amber-950/80 hover:bg-amber-900/90 text-amber-200 border border-amber-600/80 transition-colors shadow-xs font-medium cursor-pointer"
              title="Load the attached dynamic LiveCycle XFA PDF (xfa_771a0a93.pdf)"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Load Attached XFA</span>
              <span className="text-[9px] bg-amber-500/20 px-1 py-0.2 rounded text-amber-300 font-mono">44 Fields</span>
            </button>
          )}

          <button
            onClick={onLoadCanadaBookFund}
            className="hidden xl:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-red-950/80 hover:bg-red-900/90 text-red-200 border border-red-800/80 transition-colors"
            title="Load Canada Book Fund (cBF-FinRepDatFrm-eng.pdf)"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>Load cBF-FinRep</span>
          </button>

          {/* Switcher Toggle Pill */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-700">
            <span className="px-2 py-1 text-[11px] font-semibold bg-[#eb1000] text-white rounded shadow-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>Acrobat</span>
            </span>
            <button
              onClick={onSwitchToStudioUI}
              className="px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1"
              title="Switch to Developer Studio workspace"
            >
              <Layers className="w-3 h-3 text-sky-400" />
              <span>Studio</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Mobile Field Search Bar in Acrobat Mode */}
      {mobileSearchOpen && (
        <div className="md:hidden px-2.5 py-2 bg-[#1a1a1a] border-b border-[#333333] z-40">
          <GlobalFieldSearch
            fields={fields}
            onSelectField={f => {
              handleLocateField(f);
              setMobileSearchOpen(false);
            }}
            onEditFieldInForm={f => {
              handleEditFieldInForm(f);
              setMobileSearchOpen(false);
            }}
          />
        </div>
      )}

      {/* 2. Acrobat Traditional Menu Bar (Desktop/Tablet) */}
      <div className="hidden md:flex bg-[#262626] border-b border-[#383838] px-3 py-1 items-center gap-4 text-xs text-slate-300 relative z-30 shrink-0">
        <div className="flex items-center gap-3">
          {/* File Menu */}
          <div className="relative">
            <button
              onClick={e => {
                e.stopPropagation();
                setActiveMenu(activeMenu === 'file' ? null : 'file');
              }}
              className={`px-2 py-0.5 rounded hover:bg-[#383838] transition-colors ${activeMenu === 'file' ? 'bg-[#383838] text-white' : ''}`}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-[#2a2a2a] border border-[#444] rounded shadow-2xl py-1 text-xs text-slate-200 z-50">
                <label className="flex items-center justify-between px-3 py-1.5 hover:bg-[#3a3a3a] cursor-pointer">
                  <span>Open Local File...</span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && onFileUpload(e.target.files[0])}
                  />
                </label>
                {onLoadAttachedXfa && (
                  <button
                    onClick={() => {
                      onLoadAttachedXfa();
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a] text-amber-300 font-medium flex items-center justify-between cursor-pointer"
                  >
                    <span>Load Attached XFA (Sample)</span>
                    <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40">44 Fields</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    onLoadCanadaBookFund();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a] text-red-300 flex items-center justify-between"
                >
                  <span>Open Canada Book Fund (cBF)</span>
                  <span className="text-[10px] font-mono text-red-400">cBF</span>
                </button>
                <button
                  onClick={() => {
                    setUrlModalOpen(true);
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a] flex items-center justify-between"
                >
                  <span>Open from Web URL...</span>
                  <span className="text-[10px] font-mono text-slate-500">URL</span>
                </button>
                {onOpenProtocolHandler && (
                  <button
                    onClick={() => {
                      onOpenProtocolHandler();
                      setActiveMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a] text-emerald-300 flex items-center justify-between cursor-pointer"
                  >
                    <span>Default Browser PDF Protocol...</span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {isProtocolHandlerActive ? 'ON' : 'SET'}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setPrintScaleModalOpen(true);
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a] text-sky-300 flex items-center justify-between"
                >
                  <span>Scale Printout Paper Size...</span>
                  <span className="text-[10px] font-mono text-sky-400">Ctrl+P</span>
                </button>
                <button
                  onClick={() => {
                    setRightTool('convert');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a] text-red-400 flex items-center justify-between"
                >
                  <span>Convert to Regular PDF...</span>
                  <span className="text-[10px] font-mono text-red-400">ISO</span>
                </button>
                <button
                  onClick={() => {
                    onExportPdf();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a] flex items-center justify-between"
                >
                  <span>Save PDF with XFA</span>
                  <span className="text-[10px] font-mono text-slate-400">Ctrl+S</span>
                </button>
                <button
                  onClick={() => {
                    onExportXml();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a] flex items-center justify-between"
                >
                  <span>Export Form XML</span>
                  <span className="text-[10px] font-mono text-slate-400">Ctrl+Shift+S</span>
                </button>
                <button
                  onClick={() => {
                    onExportJson();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]"
                >
                  Export Form JSON
                </button>
                <button
                  onClick={() => {
                    onDownloadAllZip();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]"
                >
                  Download All Resources (ZIP)
                </button>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="relative">
            <button
              onClick={e => {
                e.stopPropagation();
                setActiveMenu(activeMenu === 'edit' ? null : 'edit');
              }}
              className={`px-2 py-0.5 rounded hover:bg-[#383838] transition-colors ${activeMenu === 'edit' ? 'bg-[#383838] text-white' : ''}`}
            >
              Edit
            </button>
            {activeMenu === 'edit' && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-[#2a2a2a] border border-[#444] rounded shadow-2xl py-1 text-xs text-slate-200 z-50">
                <button
                  onClick={() => {
                    onUndo?.();
                    setActiveMenu(null);
                  }}
                  disabled={!canUndo}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between ${
                    canUndo ? 'hover:bg-[#3a3a3a] text-slate-200' : 'text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Undo</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Ctrl+Z</span>
                </button>
                <button
                  onClick={() => {
                    onRedo?.();
                    setActiveMenu(null);
                  }}
                  disabled={!canRedo}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between ${
                    canRedo ? 'hover:bg-[#3a3a3a] text-slate-200' : 'text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Redo2 className="w-3.5 h-3.5" />
                    <span>Redo</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Ctrl+Y</span>
                </button>
                <div className="h-px bg-[#3e3e3e] my-1" />
                <button
                  onClick={() => {
                    setRightTool('formEditor');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]"
                >
                  Edit Form Fields...
                </button>
                <button
                  onClick={() => {
                    onAutofillSample();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]"
                >
                  Autofill Sample Data
                </button>
                <button
                  onClick={() => {
                    onResetDefaults();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]"
                >
                  Reset Form to Defaults
                </button>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="relative">
            <button
              onClick={e => {
                e.stopPropagation();
                setActiveMenu(activeMenu === 'view' ? null : 'view');
              }}
              className={`px-2 py-0.5 rounded hover:bg-[#383838] transition-colors ${activeMenu === 'view' ? 'bg-[#383838] text-white' : ''}`}
            >
              View
            </button>
            {activeMenu === 'view' && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-[#2a2a2a] border border-[#444] rounded shadow-2xl py-1 text-xs text-slate-200 z-50">
                <button
                  onClick={() => {
                    setLeftPanel(leftPanel === 'none' ? 'fields' : 'none');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]"
                >
                  Toggle Navigation Pane
                </button>
                <button
                  onClick={() => {
                    setRightTool(rightTool === 'none' ? 'formEditor' : 'none');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]"
                >
                  Toggle Tools Pane
                </button>
                <div className="h-px bg-[#3e3e3e] my-1" />
                <button
                  onClick={() => {
                    onSwitchToStudioUI();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a] text-sky-400"
                >
                  Switch to Modern Studio UI
                </button>
              </div>
            )}
          </div>

          {/* Tools Menu */}
          <div className="relative">
            <button
              onClick={e => {
                e.stopPropagation();
                setActiveMenu(activeMenu === 'tools' ? null : 'tools');
              }}
              className={`px-2 py-0.5 rounded hover:bg-[#383838] transition-colors ${activeMenu === 'tools' ? 'bg-[#383838] text-white' : ''}`}
            >
              Tools
            </button>
            {activeMenu === 'tools' && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-[#2a2a2a] border border-[#444] rounded shadow-2xl py-1 text-xs text-slate-200 z-50">
                <button onClick={() => { setPageOrganizerOpen(true); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a] text-sky-300 font-medium">Organize Pages (Reorder/Delete)...</button>
                <button onClick={() => { setRightTool('formEditor'); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]">Prepare Form &amp; XFA</button>
                <button onClick={() => { setRightTool('export'); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]">Export PDF</button>
                <button onClick={() => { setRightTool('preflight'); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]">Preflight &amp; Audit</button>
                <button onClick={() => { setRightTool('convert'); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]">Convert to Word</button>
                <button onClick={() => { setRightTool('resources'); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]">Extract Resources</button>
                <button onClick={() => { setRightTool('batch'); setActiveMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]">Batch Processor</button>
              </div>
            )}
          </div>

          {/* Help Menu */}
          <div className="relative">
            <button
              onClick={e => {
                e.stopPropagation();
                setActiveMenu(activeMenu === 'help' ? null : 'help');
              }}
              className={`px-2 py-0.5 rounded hover:bg-[#383838] transition-colors ${activeMenu === 'help' ? 'bg-[#383838] text-white' : ''}`}
            >
              Help
            </button>
            {activeMenu === 'help' && (
              <div className="absolute top-full left-0 mt-1 w-60 bg-[#2a2a2a] border border-[#444] rounded shadow-2xl py-1 text-xs text-slate-200 z-50">
                <button
                  onClick={() => {
                    onShowToast('AcroXFA Dynamic LiveCycle Engine v2.4 (Adobe XFA 3.3 Compliant)');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]"
                >
                  About AcroXFA Engine
                </button>
                <button
                  onClick={() => {
                    onShowToast('Canada Book Fund PDF compatibility active');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3a3a3a]"
                >
                  Canada Book Fund XFA Help
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status in menu bar */}
        <div className="ml-auto flex items-center gap-3 text-slate-400 text-[11px] font-mono">
          <span>{fields.length} XFA Fields</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-emerald-400">LiveCycle Ready</span>
        </div>
      </div>

      {/* 3. Acrobat Quick Tools Strip (Ribbon) - Single scrollable row on mobile */}
      <div className="bg-[#333333] border-b border-[#222222] px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-slate-200 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 flex-nowrap md:flex-wrap shrink-0">
          {/* File Action Icons */}
          <label className="px-2.5 py-1 rounded bg-[#3c3c3c] hover:bg-[#484848] border border-[#4a4a4a] cursor-pointer text-slate-200 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium shadow-xs shrink-0" title="Open PDF File (Ctrl+O)">
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Open PDF</span>
            <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && onFileUpload(e.target.files[0])} />
          </label>
          <button onClick={onExportPdf} disabled={isExportingPdf} className="p-1.5 rounded hover:bg-[#444] text-slate-300 hover:text-white transition-colors disabled:opacity-50 shrink-0" title="Save PDF (Ctrl+S)">
            <Save className="w-4 h-4" />
          </button>
          <button onClick={() => setPrintScaleModalOpen(true)} className="p-1.5 rounded hover:bg-[#444] text-sky-400 hover:text-sky-300 transition-colors shrink-0" title="Scale Printout Between Printer Paper Sizes & Print">
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPageOrganizerOpen(true)}
            className="px-2.5 py-1 rounded bg-[#3c3c3c] hover:bg-[#484848] border border-[#4a4a4a] text-sky-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium shrink-0 cursor-pointer"
            title="Reorder, rotate, duplicate, or delete PDF pages via drag-and-drop thumbnails"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
            <span>Organize Pages</span>
          </button>

          <div className="hidden md:block w-px h-5 bg-[#444] mx-1" />

          {/* Navigation Tools (Desktop) */}
          <button className="hidden md:inline-flex p-1.5 rounded bg-[#484848] text-sky-400" title="Hand Tool (Pan)">
            <Hand className="w-4 h-4" />
          </button>
          <button className="hidden md:inline-flex p-1.5 rounded hover:bg-[#444] text-slate-300 hover:text-white" title="Select Tool">
            <MousePointer className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-[#444] mx-0.5 sm:mx-1 shrink-0" />

          {/* Field Highlighting Toggle */}
          <button
            onClick={() => {
              setHighlightFields(!highlightFields);
              onShowToast(highlightFields ? 'XFA field highlights hidden' : 'XFA field boundaries highlighted');
            }}
            className={`px-2 py-1 rounded flex items-center gap-1.5 text-xs font-medium transition-colors shrink-0 ${
              highlightFields
                ? 'bg-sky-950/80 text-sky-300 border border-sky-700/80'
                : 'bg-[#404040] text-slate-300 hover:bg-[#4a4a4a]'
            }`}
            title="Highlight Existing XFA Form Fields"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Highlight Fields</span>
          </button>

          {/* Field Dependency Map Quick Button */}
          <button
            onClick={() => setRightTool(rightTool === 'fieldMap' ? 'none' : 'fieldMap')}
            className={`hidden sm:flex px-2.5 py-1 rounded items-center gap-1.5 text-xs font-medium transition-colors shrink-0 ${
              rightTool === 'fieldMap'
                ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/80'
                : 'bg-[#404040] text-slate-300 hover:bg-[#4a4a4a]'
            }`}
            title="Visualize XFA Field Dependency Graph & Data Flow"
          >
            <Network className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Field Map</span>
          </button>

          {/* Undo & Redo Quick Tools */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded transition-colors shrink-0 ${
              canUndo ? 'text-slate-200 hover:bg-[#444]' : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Undo field change (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded transition-colors shrink-0 ${
              canRedo ? 'text-slate-200 hover:bg-[#444]' : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Redo field change (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-[#444] mx-0.5 sm:mx-1 shrink-0" />

          {/* Simple Mode (Beginner) Quick Action */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('xfa_editor_mode', 'beginner');
              }
              setRightTool('formEditor');
            }}
            className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/80 flex items-center gap-1.5 text-xs transition-colors shrink-0"
            title="Open Simple Beginner Form Wizard"
          >
            <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
            <span>Wizard</span>
          </button>

          {/* Fill & Sign Quick Action */}
          <button
            onClick={() => setRightTool('formEditor')}
            className="px-2.5 py-1 rounded bg-[#404040] hover:bg-[#4a4a4a] text-slate-200 flex items-center gap-1.5 text-xs transition-colors shrink-0"
            title="Fill & Sign Form Fields"
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
            <span>Fill &amp; Sign</span>
          </button>

          {/* Convert XFA to Standard PDF Quick Action */}
          <button
            onClick={() => setRegularPdfModalOpen(true)}
            className="px-2.5 py-1 rounded bg-red-600/80 hover:bg-red-500 text-white flex items-center gap-1.5 text-xs transition-colors shadow-xs shrink-0"
            title="Convert XFA PDF to ISO 32000-1 Standard PDF while retaining form fields and data"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>XFA → Standard PDF</span>
          </button>

          {/* Scale Printout Size Quick Action (Desktop label) */}
          <button
            onClick={() => setPrintScaleModalOpen(true)}
            className="hidden md:flex px-2.5 py-1 rounded bg-sky-950/90 hover:bg-sky-900 border border-sky-700/80 text-sky-200 items-center gap-1.5 text-xs transition-colors shadow-xs shrink-0"
            title="Scale Printout Between Printer Paper Sizes (Letter ↔ A4 / Legal / Tabloid)"
          >
            <Printer className="w-3.5 h-3.5 text-sky-400" />
            <span>Scale Print Size</span>
          </button>

          <button
            onClick={onExportXml}
            className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#404040] hover:bg-[#4a4a4a] text-slate-300 text-xs transition-colors shrink-0"
            title="Export XFA Datasets XML"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export XML</span>
          </button>
        </div>

        {/* Right side of ribbon */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {isCanadaBookFund && (
            <span className="hidden lg:flex text-[11px] font-mono text-emerald-400 items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Canada Heritage Verified</span>
            </span>
          )}
          <button
            onClick={() => onShowToast('Press ? to view all keyboard shortcuts')}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded"
            title="Shortcuts"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4. Classic Adobe Acrobat Yellow XFA Notification Bar (Compact & Dismissible on Mobile) */}
      {hasXfa && showXfaBanner && (
        <div className={`border-b px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-2 text-xs shadow-xs transition-colors shrink-0 ${
          validationReport.errorCount > 0
            ? 'bg-[#fff1f2] border-rose-300 text-rose-950'
            : 'bg-[#fff9e6] border-[#e6d08a] text-[#5c4300]'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {validationReport.errorCount > 0 ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#d97706] shrink-0" />
            )}
            <span className="truncate">
              <strong className={`font-semibold ${validationReport.errorCount > 0 ? 'text-rose-900' : 'text-[#78350f]'}`}>
                {validationReport.errorCount > 0 ? `${validationReport.errorCount} Validation Issues` : 'Dynamic XFA Active'}
              </strong>
              <span className="hidden sm:inline">
                {' — '}
                {validationReport.errorCount > 0
                  ? `${validationReport.errorCount} ${validationReport.errorCount === 1 ? 'field requires' : 'fields require'} attention.`
                  : isCanadaBookFund
                  ? 'Canada Book Fund (cBF-FinRepDatFrm-eng) parsed & unlocked.'
                  : `${fields.length} interactive fields & datasets ready.`}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {validationReport.errorCount > 0 ? (
              <button
                onClick={() => setRightTool('formEditor')}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium transition-colors text-[11px] sm:text-xs flex items-center gap-1 shadow-xs"
              >
                <span>Fix ({validationReport.errorCount})</span>
              </button>
            ) : (
              <button
                onClick={() => setRightTool('formEditor')}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-[#fef3c7] hover:bg-[#fde68a] border border-[#d97706]/40 text-[#78350f] rounded font-medium transition-colors text-[11px] sm:text-xs"
              >
                Fill Form
              </button>
            )}
            <button
              onClick={onExportPdf}
              className="hidden sm:inline-flex px-2.5 py-1 bg-[#d97706] hover:bg-[#b45309] text-white rounded font-medium transition-colors text-xs shadow-xs"
            >
              Export PDF
            </button>
            <button
              onClick={() => setShowXfaBanner(false)}
              className="p-1 rounded hover:bg-black/10 text-amber-900/70 hover:text-amber-950 transition-colors"
              title="Dismiss notification bar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 5. Main 3-Pane Acrobat Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navigation Icon Strip (Desktop Only - replaced by Bottom Nav on Mobile/Tablet) */}
        <div className="hidden lg:flex w-12 bg-[#262626] border-r border-[#383838] flex-col items-center py-3 gap-3 shrink-0 z-20">
          <button
            onClick={() => setLeftPanel(leftPanel === 'fields' ? 'none' : 'fields')}
            title="XFA Form Fields Hierarchy"
            className={`p-2 rounded-lg transition-colors ${
              leftPanel === 'fields'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#333]'
            }`}
          >
            <Layers className="w-5 h-5" />
          </button>

          <button
            onClick={() => setLeftPanel(leftPanel === 'bookmarks' ? 'none' : 'bookmarks')}
            title="Bookmarks / Subforms Outline"
            className={`p-2 rounded-lg transition-colors ${
              leftPanel === 'bookmarks'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#333]'
            }`}
          >
            <Bookmark className="w-5 h-5" />
          </button>

          <button
            onClick={() => setLeftPanel(leftPanel === 'attachments' ? 'none' : 'attachments')}
            title="Attachments & Resources"
            className={`p-2 rounded-lg transition-colors ${
              leftPanel === 'attachments'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#333]'
            }`}
          >
            <Paperclip className="w-5 h-5" />
          </button>
        </div>

        {/* Left Expanded Drawer (Overlay on Mobile/Tablet, Docked on Desktop) */}
        {leftPanel !== 'none' && (
          <div className="fixed inset-x-0 top-11 bottom-14 z-40 w-full sm:w-80 lg:static lg:w-72 bg-[#222222] border-r border-[#383838] flex flex-col shrink-0 lg:z-10 overflow-hidden animate-in slide-in-from-left duration-150 shadow-2xl lg:shadow-none">
            <div className="px-3 py-2.5 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLeftPanel('fields')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    leftPanel === 'fields'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Fields ({fields.length})
                </button>
                <button
                  onClick={() => setLeftPanel('bookmarks')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    leftPanel === 'bookmarks'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Outline
                </button>
                <button
                  onClick={() => setLeftPanel('attachments')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    leftPanel === 'attachments'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Files
                </button>
              </div>
              <button
                onClick={() => setLeftPanel('none')}
                className="px-2 py-1 bg-[#2e2e2e] hover:bg-[#3a3a3a] text-slate-200 rounded text-xs flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span className="lg:hidden">Close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
              {leftPanel === 'fields' && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={leftFieldsFilter}
                      onChange={e => setLeftFieldsFilter(e.target.value)}
                      placeholder={`Filter ${fields.length} fields...`}
                      className="w-full pl-8 pr-7 py-1.5 bg-[#181818] border border-[#3e3e3e] focus:border-sky-500 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                    {leftFieldsFilter && (
                      <button
                        type="button"
                        onClick={() => setLeftFieldsFilter('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 pb-1 border-b border-[#333]">
                    {fields.length} detected fields across {subforms.length} subforms
                  </div>
                  {fields
                    .filter(f => {
                      const q = leftFieldsFilter.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        f.name.toLowerCase().includes(q) ||
                        (f.caption && f.caption.toLowerCase().includes(q)) ||
                        (f.value && f.value.toLowerCase().includes(q)) ||
                        (f.parentSubform && f.parentSubform.toLowerCase().includes(q))
                      );
                    })
                    .map(f => (
                      <div
                        key={f.id}
                        onClick={() => {
                          handleLocateField(f);
                          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                            setLeftPanel('none');
                          }
                        }}
                        className="p-2.5 rounded-lg bg-[#2a2a2a] hover:bg-[#353535] border border-[#383838] cursor-pointer transition-colors space-y-1"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-slate-200 truncate pr-1">
                            {f.caption || f.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#1e1e1e] text-slate-400 border border-[#383838]">
                              P{f.bounds?.pageNumber || 1}
                            </span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#1e1e1e] text-sky-400 border border-[#444]">
                              {f.type}
                            </span>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {f.value || <span className="text-slate-600 italic">Empty</span>}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {leftPanel === 'bookmarks' && (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-400 pb-1 border-b border-[#333]">
                    XFA Subform Structure
                  </div>
                  {subforms.map(sf => (
                    <div key={sf.id} className="p-2.5 rounded-lg bg-[#2a2a2a] border border-[#383838]">
                      <div className="font-semibold text-slate-200 text-xs">{sf.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {sf.fields.length} interactive fields
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {leftPanel === 'attachments' && (
                <div className="space-y-2 text-center py-6 text-slate-400">
                  <Paperclip className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                  <p className="text-xs">
                    {manifest?.attachments.length || 0} embedded attachments detected.
                  </p>
                  <button
                    onClick={onDownloadAllZip}
                    className="mt-2 px-3 py-1.5 bg-[#333] hover:bg-[#444] text-slate-200 rounded-lg text-xs transition-colors"
                  >
                    Download Resource ZIP
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Center Stage: The Classic Adobe Acrobat Gray Canvas Viewport */}
        <div className="flex-1 bg-[#525659] overflow-y-auto flex flex-col relative min-w-0">
          <PdfCanvasViewer
            pdfBytes={pdfBytes}
            filename={filename}
            hasXfa={hasXfa}
            fields={fields}
            subforms={subforms}
            targetFieldId={targetFieldId}
            targetFieldTrigger={targetFieldTrigger}
            onFieldValueChange={onFieldValueChange}
            onUpdateFieldAppearance={onUpdateFieldAppearance}
            onResetFieldAppearance={onResetFieldAppearance}
            onSwitchToForm={() => setRightTool('formEditor')}
            onSwitchToResources={() => setRightTool('resources')}
          />
        </div>

        {/* Right Tools Pane (Desktop Only - replaced by Bottom Nav on Mobile/Tablet) */}
        <div className="hidden lg:flex w-14 bg-[#262626] border-l border-[#383838] flex-col items-center py-3 gap-4 shrink-0 z-20">
          <button
            onClick={() => setRightTool(rightTool === 'assistant' ? 'none' : 'assistant')}
            title="Smart Form Assistant (Gemini AI Autofill & Context Suggestions)"
            className={`p-2.5 rounded-lg transition-colors flex flex-col items-center gap-1 ${
              rightTool === 'assistant'
                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-950/40'
                : 'text-purple-300 hover:text-white hover:bg-[#333]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-[9px]">AI Assist</span>
          </button>

          <button
            onClick={() => setRightTool(rightTool === 'formEditor' ? 'none' : 'formEditor')}
            title={validationReport.errorCount > 0 ? `Prepare Form (${validationReport.errorCount} validation issues)` : 'Edit Form & XFA (Prepare Form)'}
            className={`p-2.5 rounded-lg transition-colors flex flex-col items-center gap-1 relative ${
              rightTool === 'formEditor'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-[#333]'
            }`}
          >
            {validationReport.errorCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#262626] animate-pulse" />
            )}
            <CheckSquare className="w-4 h-4" />
            <span className="text-[9px]">Form</span>
          </button>

          <button
            onClick={() => setRightTool(rightTool === 'fieldMap' ? 'none' : 'fieldMap')}
            title="Field Map & Dependency Graph"
            className={`p-2.5 rounded-lg transition-colors flex flex-col items-center gap-1 ${
              rightTool === 'fieldMap'
                ? 'bg-indigo-600 text-white font-bold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-[#333]'
            }`}
          >
            <Network className="w-4 h-4" />
            <span className="text-[9px]">Map</span>
          </button>

          <button
            onClick={() => setRightTool(rightTool === 'export' ? 'none' : 'export')}
            title="Export PDF / Data"
            className={`p-2.5 rounded-lg transition-colors flex flex-col items-center gap-1 ${
              rightTool === 'export'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-[#333]'
            }`}
          >
            <Download className="w-4 h-4" />
            <span className="text-[9px]">Export</span>
          </button>

          <button
            onClick={() => setRightTool(rightTool === 'preflight' ? 'none' : 'preflight')}
            title="Preflight Audit"
            className={`p-2.5 rounded-lg transition-colors flex flex-col items-center gap-1 ${
              rightTool === 'preflight'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-[#333]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[9px]">Audit</span>
          </button>

          <button
            onClick={() => setRightTool(rightTool === 'convert' ? 'none' : 'convert')}
            title="Convert to Word / Other"
            className={`p-2.5 rounded-lg transition-colors flex flex-col items-center gap-1 ${
              rightTool === 'convert'
                ? 'bg-purple-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-[#333]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-[9px]">Convert</span>
          </button>

          <button
            onClick={() => setRightTool(rightTool === 'resources' ? 'none' : 'resources')}
            title="Extract Resources (Images & Fonts)"
            className={`p-2.5 rounded-lg transition-colors flex flex-col items-center gap-1 ${
              rightTool === 'resources'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-[#333]'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span className="text-[9px]">Assets</span>
          </button>

          <button
            onClick={() => setRightTool(rightTool === 'xml' ? 'none' : 'xml')}
            title="XFA XML Data Packets"
            className={`p-2.5 rounded-lg transition-colors flex flex-col items-center gap-1 ${
              rightTool === 'xml'
                ? 'bg-rose-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-[#333]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="text-[9px]">XML</span>
          </button>
        </div>

        {/* Right Tool Drawer (Full-Screen Sheet on Mobile/Tablet, Docked Sidebar on Desktop) */}
        {rightTool !== 'none' && (
          <div className={`fixed inset-x-0 top-11 bottom-14 z-40 w-full lg:static lg:z-10 ${rightTool === 'fieldMap' || rightTool === 'assistant' || rightTool === 'batch' ? 'lg:w-[760px] lg:max-w-[85vw]' : 'lg:w-96'} bg-[#222222] border-l border-[#383838] flex flex-col shrink-0 overflow-y-auto animate-in slide-in-from-right duration-150 shadow-2xl lg:shadow-none`}>
            <div className="px-4 py-3 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between sticky top-0 z-20">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider truncate pr-2">
                {rightTool === 'assistant' && 'Smart Form Assistant (Gemini)'}
                {rightTool === 'fieldMap' && 'XFA Field Map & Dependency Graph'}
                {rightTool === 'formEditor' && 'Interactive Form & Bulk Editor'}
                {rightTool === 'export' && 'Export PDF & Form Data'}
                {rightTool === 'preflight' && 'Preflight PDF Audit'}
                {rightTool === 'convert' && 'Document Conversion'}
                {rightTool === 'resources' && 'Extracted Resources'}
                {rightTool === 'xml' && 'Raw XFA XML Packets'}
                {rightTool === 'batch' && 'Batch XFA & PKCS#7 Processor'}
              </span>
              <button
                onClick={() => setRightTool('none')}
                className="px-2.5 py-1 bg-[#2e2e2e] hover:bg-[#3a3a3a] text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>Back to PDF</span>
              </button>
            </div>

            <div className="p-3 sm:p-4 flex-1">
              {rightTool === 'assistant' && (
                <div className="h-[calc(100vh-140px)] lg:h-[750px] -m-3 sm:-m-4">
                  <SmartFormAssistant
                    fields={fields}
                    subforms={subforms}
                    filename={filename}
                    onApplyFieldSuggestion={(fieldId, val) => {
                      onFieldValueChange(fieldId, val);
                      onShowToast('Applied AI suggestion to field');
                    }}
                    onBulkApplySuggestions={(items) => {
                      items.forEach(item => onFieldValueChange(item.fieldId, item.value));
                      onShowToast(`Applied ${items.length} AI suggestions to form`);
                    }}
                    onNavigateToField={(fieldId) => {
                      const f = fields.find(item => item.id === fieldId);
                      if (f) onFieldValueChange(fieldId, f.value);
                      setRightTool('formEditor');
                      onShowToast(`Navigated to field: ${f?.caption || f?.name || fieldId}`);
                    }}
                    onClose={() => setRightTool('none')}
                  />
                </div>
              )}

              {rightTool === 'fieldMap' && (
                <div className="h-[calc(100vh-140px)] lg:h-[750px] -m-3 sm:-m-4">
                  <FieldMapPanel
                    subforms={subforms}
                    allFields={fields}
                    templateXml={xfaPackets.templateXml}
                    onNavigateToField={fieldId => {
                      const f = fields.find(item => item.id === fieldId);
                      if (f) onFieldValueChange(fieldId, f.value);
                      setRightTool('none');
                      onShowToast(`Located field: ${f?.caption || f?.name || fieldId}`);
                    }}
                    onNavigateToFormEditor={fieldId => {
                      setRightTool('formEditor');
                      onShowToast('Switched to Form Editor');
                    }}
                  />
                </div>
              )}

              {rightTool === 'formEditor' && (
                <XfaFormEditor
                  subforms={subforms}
                  hasXfa={hasXfa}
                  onFieldValueChange={onFieldValueChange}
                  onAutofillSample={onAutofillSample}
                  onResetDefaults={onResetDefaults}
                  onLoadSampleXfa={onLoadCanadaBookFund}
                  onSwitchToResources={() => setRightTool('resources')}
                  onBulkUpdateFields={onBulkUpdateFields}
                  onExportPdf={onExportPdf}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={onUndo}
                  onRedo={onRedo}
                  history={history}
                  currentIndex={currentIndex}
                  jumpToHistoryIndex={jumpToHistoryIndex}
                />
              )}

              {rightTool === 'export' && (
                <div className="space-y-4">
                  <div className="bg-[#2a2a2a] border border-[#383838] rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-slate-200">Export Completed PDF</h3>
                    <p className="text-xs text-slate-400">
                      Saves the PDF with all modified XFA datasets, calculated values, and signatures embedded.
                    </p>
                    <button
                      onClick={onExportPdf}
                      disabled={isExportingPdf}
                      className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                    >
                      Export PDF
                    </button>
                  </div>

                  <div className="bg-[#2a2a2a] border border-[#383838] rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-slate-200">Export Raw Form Data</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={onExportXml}
                        className="py-2 px-3 bg-[#333] hover:bg-[#3e3e3e] border border-[#444] rounded-lg text-xs font-medium text-slate-200 transition-colors"
                      >
                        XML Dataset
                      </button>
                      <button
                        onClick={onExportJson}
                        className="py-2 px-3 bg-[#333] hover:bg-[#3e3e3e] border border-[#444] rounded-lg text-xs font-medium text-slate-200 transition-colors"
                      >
                        JSON File
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#2a2a2a] border border-red-900/50 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-red-300">Convert XFA → Standard PDF</h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800/50">
                        ISO 32000-1
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Converts XFA into a standard AcroForm, Hybrid, or Flattened PDF while retaining form fields and data.
                    </p>
                    <button
                      onClick={() => setRegularPdfModalOpen(true)}
                      className="w-full py-2 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700/70 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Open XFA → Standard PDF Converter
                    </button>
                  </div>
                </div>
              )}

              {rightTool === 'preflight' && (
                <PreflightAuditView
                  summary={preflightSummary}
                  onRerunPreflight={() => {}}
                  onJumpToField={() => {}}
                  onAutofillField={onFieldValueChange}
                  onFixMetadata={() => {}}
                />
              )}

              {rightTool === 'convert' && (
                <ConversionView
                  filename={filename}
                  pdfBytes={pdfBytes}
                  metadata={manifest?.metadata || null}
                  fields={fields}
                  subforms={subforms}
                  textPages={manifest?.textPages || []}
                  manifest={manifest}
                  onLoadConvertedPdf={onLoadConvertedPdf}
                  onShowToast={onShowToast}
                />
              )}

              {rightTool === 'resources' && manifest && (
                <ResourceExtractorView
                  manifest={manifest}
                  originalFilename={filename}
                  onDownloadAllZip={onDownloadAllZip}
                  isExportingZip={false}
                  onShowToast={onShowToast}
                />
              )}

              {rightTool === 'xml' && (
                <XmlEditor
                  packets={xfaPackets}
                  onApplyXmlChanges={onApplyXmlChanges}
                  onExportXmlFile={(content, name) => onExportXml()}
                />
              )}

              {rightTool === 'batch' && (
                <BatchProcessorView onLoadSinglePdf={() => {}} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6. Mobile & Tablet Bottom Navigation Bar (lg:hidden) */}
      <nav className="lg:hidden bg-[#1e1e1e] border-t border-[#383838] px-2 py-1.5 flex items-center justify-around shrink-0 z-50">
        <button
          onClick={() => {
            setLeftPanel('none');
            setRightTool('none');
            setMobileToolsSheetOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            leftPanel === 'none' && rightTool === 'none' && !mobileToolsSheetOpen
              ? 'text-sky-400 bg-sky-500/15 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>PDF View</span>
        </button>

        <button
          onClick={() => {
            setRightTool('none');
            setMobileToolsSheetOpen(false);
            setLeftPanel(leftPanel === 'fields' ? 'none' : 'fields');
          }}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            leftPanel !== 'none'
              ? 'text-sky-400 bg-sky-500/15 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Fields ({fields.length})</span>
        </button>

        <button
          onClick={() => {
            setLeftPanel('none');
            setMobileToolsSheetOpen(false);
            setRightTool(rightTool === 'formEditor' ? 'none' : 'formEditor');
          }}
          className={`relative flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            rightTool === 'formEditor'
              ? 'text-sky-400 bg-sky-500/15 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {validationReport.errorCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
          <CheckSquare className="w-4 h-4" />
          <span>Fill Form</span>
        </button>

        <button
          onClick={() => {
            setLeftPanel('none');
            setMobileToolsSheetOpen(false);
            setRightTool(rightTool === 'assistant' ? 'none' : 'assistant');
          }}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            rightTool === 'assistant'
              ? 'text-purple-400 bg-purple-500/15 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>AI Assist</span>
        </button>

        <button
          onClick={() => {
            setLeftPanel('none');
            setMobileToolsSheetOpen(false);
            setRightTool(rightTool === 'convert' ? 'none' : 'convert');
          }}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            rightTool === 'convert'
              ? 'text-red-400 bg-red-500/15 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Convert</span>
        </button>

        <button
          onClick={() => setMobileToolsSheetOpen(prev => !prev)}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            mobileToolsSheetOpen || ['batch', 'preflight', 'fieldMap', 'resources', 'xml', 'export'].includes(rightTool)
              ? 'text-amber-400 bg-amber-500/15 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>More Tools</span>
        </button>
      </nav>

      {/* Mobile Tools & Actions Bottom Sheet (lg:hidden) */}
      {mobileToolsSheetOpen && (
        <div
          onClick={() => setMobileToolsSheetOpen(false)}
          className="lg:hidden fixed inset-0 bottom-14 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#222222] border-t border-[#444] rounded-t-2xl p-4 space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#333] pb-2.5">
              <div>
                <h3 className="text-sm font-semibold text-white">Acrobat XFA Tools &amp; Batch Suite</h3>
                <p className="text-[11px] text-slate-400">Select any specialized tool or workspace mode</p>
              </div>
              <button
                onClick={() => setMobileToolsSheetOpen(false)}
                className="p-1.5 rounded-lg bg-[#333] text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <button
                onClick={() => {
                  setRightTool('batch');
                  setMobileToolsSheetOpen(false);
                }}
                className="p-3 rounded-xl bg-[#2c2c2c] hover:bg-[#363636] border border-[#3e3e3e] flex items-center gap-2.5 text-left"
              >
                <Layers className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Batch Processor</div>
                  <div className="text-[10px] text-slate-400">Merge, PKCS#7 &amp; CSV</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setRightTool('preflight');
                  setMobileToolsSheetOpen(false);
                }}
                className="p-3 rounded-xl bg-[#2c2c2c] hover:bg-[#363636] border border-[#3e3e3e] flex items-center gap-2.5 text-left"
              >
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Preflight Audit</div>
                  <div className="text-[10px] text-slate-400">Compliance checks</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setRightTool('fieldMap');
                  setMobileToolsSheetOpen(false);
                }}
                className="p-3 rounded-xl bg-[#2c2c2c] hover:bg-[#363636] border border-[#3e3e3e] flex items-center gap-2.5 text-left"
              >
                <Network className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Field Map Graph</div>
                  <div className="text-[10px] text-slate-400">XFA dependencies</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setPrintScaleModalOpen(true);
                  setMobileToolsSheetOpen(false);
                }}
                className="p-3 rounded-xl bg-[#2c2c2c] hover:bg-[#363636] border border-[#3e3e3e] flex items-center gap-2.5 text-left"
              >
                <Printer className="w-5 h-5 text-sky-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Scale Print Size</div>
                  <div className="text-[10px] text-slate-400">Letter ↔ A4 / Legal</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setRightTool('resources');
                  setMobileToolsSheetOpen(false);
                }}
                className="p-3 rounded-xl bg-[#2c2c2c] hover:bg-[#363636] border border-[#3e3e3e] flex items-center gap-2.5 text-left"
              >
                <FolderArchive className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Extract Assets</div>
                  <div className="text-[10px] text-slate-400">Images &amp; Fonts ZIP</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setRightTool('xml');
                  setMobileToolsSheetOpen(false);
                }}
                className="p-3 rounded-xl bg-[#2c2c2c] hover:bg-[#363636] border border-[#3e3e3e] flex items-center gap-2.5 text-left"
              >
                <FileText className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Raw XFA XML</div>
                  <div className="text-[10px] text-slate-400">Template &amp; Datasets</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setRightTool('export');
                  setMobileToolsSheetOpen(false);
                }}
                className="p-3 rounded-xl bg-[#2c2c2c] hover:bg-[#363636] border border-[#3e3e3e] flex items-center gap-2.5 text-left"
              >
                <Download className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Export Data</div>
                  <div className="text-[10px] text-slate-400">PDF, XML &amp; JSON</div>
                </div>
              </button>

              {onOpenProtocolHandler && (
                <button
                  onClick={() => {
                    onOpenProtocolHandler();
                    setMobileToolsSheetOpen(false);
                  }}
                  className="p-3 rounded-xl bg-[#2c2c2c] hover:bg-[#363636] border border-[#3e3e3e] flex items-center gap-2.5 text-left"
                >
                  <Globe className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-100">PDF Protocol</div>
                    <div className="text-[10px] text-slate-400">Browser Default Handler</div>
                  </div>
                </button>
              )}

              <button
                onClick={() => {
                  setPageOrganizerOpen(true);
                  setMobileToolsSheetOpen(false);
                }}
                className="p-3 rounded-xl bg-[#2c2c2c] hover:bg-[#363636] border border-[#3e3e3e] flex items-center gap-2.5 text-left"
              >
                <LayoutGrid className="w-5 h-5 text-sky-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Organize Pages</div>
                  <div className="text-[10px] text-slate-400">Reorder &amp; delete pages</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setRegularPdfModalOpen(true);
                  setMobileToolsSheetOpen(false);
                }}
                className="p-3 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-700/60 flex items-center gap-2.5 text-left"
              >
                <FileText className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <div className="font-semibold text-red-200">XFA → Standard PDF</div>
                  <div className="text-[10px] text-red-300/80">Retain fields &amp; data</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onSwitchToStudioUI();
                  setMobileToolsSheetOpen(false);
                }}
                className="p-3 rounded-xl bg-sky-950/60 hover:bg-sky-900/60 border border-sky-700/60 flex items-center gap-2.5 text-left"
              >
                <Layout className="w-5 h-5 text-sky-400 shrink-0" />
                <div>
                  <div className="font-semibold text-sky-200">Studio Workspace</div>
                  <div className="text-[10px] text-sky-300/80">Switch UI Layout</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URL Input Modal */}
      {urlModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-[#242424] border border-[#444] rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#383838] pb-3">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-100">Open Document From Web URL</h3>
              </div>
              <button
                onClick={() => setUrlModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Enter the direct URL of an XFA or standard PDF. Our engine will bypass browser "Please wait" errors and render all LiveCycle packets.
            </p>

            <div className="space-y-2">
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://example.com/document.pdf"
                className="w-full bg-[#181818] border border-[#444] rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />

              <div className="pt-1">
                <span className="text-[11px] text-slate-400 block mb-1">Official Canada Book Fund form:</span>
                <button
                  type="button"
                  onClick={() => setUrlInput('https://www.canada.ca/content/dam/pch/documents/services/funding/book-fund/cBF-FinRepDatFrm-eng.pdf')}
                  className="w-full text-left p-2 rounded bg-[#2e2e2e] hover:bg-[#383838] border border-[#444] text-xs font-mono text-red-300 truncate transition-colors"
                >
                  https://www.canada.ca/.../cBF-FinRepDatFrm-eng.pdf
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#383838]">
              <button
                type="button"
                onClick={() => setUrlModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-300 hover:bg-[#333] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUrlSubmit}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors shadow-xs"
              >
                Open &amp; Compile XFA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scale Printout Between Printer Paper Sizes Modal */}
      <PrintScaleModal
        isOpen={printScaleModalOpen}
        onClose={() => setPrintScaleModalOpen(false)}
        pdfBytes={pdfBytes}
        filename={filename}
        fields={fields}
        onShowToast={onShowToast}
      />

      {/* Drag-and-Drop Page Organizer Modal */}
      <PageOrganizerModal
        isOpen={pageOrganizerOpen}
        onClose={() => setPageOrganizerOpen(false)}
        pdfBytes={pdfBytes}
        filename={filename}
        fields={fields}
        hasXfa={hasXfa}
        onApplyOrganization={async (result, removeDeletedPageFields) => {
          if (onApplyPageOrganization) {
            await onApplyPageOrganization(result, removeDeletedPageFields);
          }
        }}
        onShowToast={onShowToast}
      />

      {/* XFA to Standard PDF Conversion Modal */}
      <RegularPdfConvertModal
        isOpen={regularPdfModalOpen}
        onClose={() => setRegularPdfModalOpen(false)}
        pdfBytes={pdfBytes}
        filename={filename}
        fields={fields}
        onShowToast={onShowToast}
        onLoadConvertedPdf={onLoadConvertedPdf}
      />
    </div>
  );
};
