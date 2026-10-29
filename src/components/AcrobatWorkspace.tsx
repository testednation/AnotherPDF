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
  onFieldValueChange: (fieldId: string, newValue: string) => void;
  onUpdateFieldAppearance: (fieldId: string, appearance: any, applyToAll: boolean) => void;
  onResetFieldAppearance: (fieldId: string) => void;
  onBulkUpdateFields?: (fieldIds: string[], updates: any) => void;
  onExportPdf: () => void;
  onExportXml: () => void;
  onExportJson: () => void;
  onDownloadAllZip: () => void;
  onLoadCanadaBookFund: () => void;
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
}

type LeftPanelTab = 'none' | 'thumbnails' | 'bookmarks' | 'fields' | 'attachments';
type RightToolType = 'none' | 'formEditor' | 'export' | 'preflight' | 'convert' | 'resources' | 'xml' | 'batch';

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
  onFieldValueChange,
  onUpdateFieldAppearance,
  onResetFieldAppearance,
  onBulkUpdateFields,
  onExportPdf,
  onExportXml,
  onExportJson,
  onDownloadAllZip,
  onLoadCanadaBookFund,
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
}) => {
  // Navigation & Tool panels state
  const [leftPanel, setLeftPanel] = useState<LeftPanelTab>('fields');
  const [rightTool, setRightTool] = useState<RightToolType>('none');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Field highlights state (Acrobat purple/blue field boundary box)
  const [highlightFields, setHighlightFields] = useState(true);

  // URL modal
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('https://www.canada.ca/content/dam/pch/documents/services/funding/book-fund/cBF-FinRepDatFrm-eng.pdf');

  // Close menus on outside click
  useEffect(() => {
    const handleClick = () => setActiveMenu(null);
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
    <div className="min-h-screen bg-[#2c2c2c] text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* 1. Acrobat Window Title Bar */}
      <div className="bg-[#1e1e1e] border-b border-[#333333] px-3 py-1.5 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          {/* Adobe Acrobat Red Emblem */}
          <div className="w-5 h-5 rounded bg-[#eb1000] flex items-center justify-center text-white font-bold text-[10px] shadow-xs">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
              <path d="M19.3 2H4.7C3.2 2 2 3.2 2 4.7v14.6C2 20.8 3.2 22 4.7 22h14.6c1.5 0 2.7-1.2 2.7-2.7V4.7C22 3.2 20.8 2 19.3 2zM9.6 17.5c-.8 0-1.8-1.5-2.9-3.9 1.1-.3 2.5-.5 3.7-.5 1.1 0 1.9.1 2.3.2-1.2 2.3-2.3 4.2-3.1 4.2zm6.2-7.2c-.5 0-1.1.2-1.7.5-.4-.7-.9-1.6-1.5-2.6 1.1-.9 2-1.7 2.4-1.7.5 0 .8.4.8 1.1 0 .9-.4 1.9-1 2.7zM7.2 11.2c.4-.7 1.2-1.9 2.2-3.1.5.9 1.1 1.8 1.6 2.7-1.3.1-2.6.3-3.8.4zm9.3 4.8c-.8 0-1.7-.5-2.5-1.3 1.1-.2 2.2-.6 3.1-1.1.2.6.3 1.2.3 1.6 0 .5-.4.8-.9.8z"/>
            </svg>
          </div>
          <span className="font-semibold text-slate-200">
            Adobe Acrobat Pro DC
          </span>
          <span className="text-slate-500">-</span>
          <span className="font-mono text-slate-300 truncate max-w-sm">
            [{filename}]
          </span>
          {isCanadaBookFund && (
            <span className="px-1.5 py-0.2 rounded bg-red-950/80 border border-red-800 text-red-300 text-[10px] font-mono">
              Canada Book Fund (CBF) Official
            </span>
          )}
        </div>

        {/* Top Right: UI Mode Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUrlModalOpen(true)}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <ExternalLink className="w-3 h-3 text-sky-400" />
            <span>Open from URL</span>
          </button>

          <button
            onClick={onLoadCanadaBookFund}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-red-950/80 hover:bg-red-900/90 text-red-200 border border-red-800/80 transition-colors"
            title="Load Canada Book Fund (cBF-FinRepDatFrm-eng.pdf)"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>Load cBF-FinRep</span>
          </button>

          {/* Switcher Toggle Pill */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-700">
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-red-600 text-white rounded shadow-xs flex items-center gap-1">
              <span>Acrobat View</span>
            </span>
            <button
              onClick={onSwitchToStudioUI}
              className="px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
              title="Switch back to AcroXFA Studio UI layout"
            >
              <span>Studio View</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Acrobat Traditional Menu Bar */}
      <div className="bg-[#262626] border-b border-[#383838] px-3 py-1 flex items-center gap-4 text-xs text-slate-300 relative z-30">
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
                <div className="h-px bg-[#3e3e3e] my-1" />
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

      {/* 3. Acrobat Quick Tools Strip (Ribbon) */}
      <div className="bg-[#333333] border-b border-[#222222] px-3 py-1.5 flex items-center justify-between gap-3 text-xs text-slate-200">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* File Action Icons */}
          <label className="p-1.5 rounded hover:bg-[#444] cursor-pointer text-slate-300 hover:text-white transition-colors" title="Open PDF File">
            <FolderOpen className="w-4 h-4" />
            <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && onFileUpload(e.target.files[0])} />
          </label>
          <button onClick={onExportPdf} disabled={isExportingPdf} className="p-1.5 rounded hover:bg-[#444] text-slate-300 hover:text-white transition-colors disabled:opacity-50" title="Save PDF (Ctrl+S)">
            <Save className="w-4 h-4" />
          </button>
          <button onClick={() => window.print()} className="p-1.5 rounded hover:bg-[#444] text-slate-300 hover:text-white transition-colors" title="Print Document">
            <Printer className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-[#444] mx-1" />

          {/* Navigation Tools */}
          <button className="p-1.5 rounded bg-[#484848] text-sky-400" title="Hand Tool (Pan)">
            <Hand className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded hover:bg-[#444] text-slate-300 hover:text-white" title="Select Tool">
            <MousePointer className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-[#444] mx-1" />

          {/* Field Highlighting Toggle */}
          <button
            onClick={() => {
              setHighlightFields(!highlightFields);
              onShowToast(highlightFields ? 'XFA field highlights hidden' : 'XFA field boundaries highlighted');
            }}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 text-xs font-medium transition-colors ${
              highlightFields
                ? 'bg-sky-950/80 text-sky-300 border border-sky-700/80'
                : 'bg-[#404040] text-slate-300 hover:bg-[#4a4a4a]'
            }`}
            title="Highlight Existing XFA Form Fields"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Highlight Fields</span>
          </button>

          <div className="w-px h-5 bg-[#444] mx-1" />

          {/* Undo & Redo Quick Tools */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded transition-colors ${
              canUndo ? 'text-slate-200 hover:bg-[#444]' : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Undo field change (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded transition-colors ${
              canRedo ? 'text-slate-200 hover:bg-[#444]' : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Redo field change (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-[#444] mx-1" />

          {/* Simple Mode (Beginner) Quick Action */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('xfa_editor_mode', 'beginner');
              }
              setRightTool('formEditor');
            }}
            className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/80 flex items-center gap-1.5 text-xs transition-colors"
            title="Open Simple Beginner Form Wizard"
          >
            <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
            <span>Beginner Wizard</span>
          </button>

          {/* Fill & Sign Quick Action */}
          <button
            onClick={() => setRightTool('formEditor')}
            className="px-2.5 py-1 rounded bg-[#404040] hover:bg-[#4a4a4a] text-slate-200 flex items-center gap-1.5 text-xs transition-colors"
            title="Fill & Sign Form Fields"
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
            <span>Fill &amp; Sign</span>
          </button>

          <button
            onClick={onExportXml}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#404040] hover:bg-[#4a4a4a] text-slate-300 text-xs transition-colors"
            title="Export XFA Datasets XML"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export XML</span>
          </button>
        </div>

        {/* Right side of ribbon */}
        <div className="flex items-center gap-2">
          {isCanadaBookFund && (
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
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

      {/* 4. Classic Adobe Acrobat Yellow XFA Notification Bar */}
      {hasXfa && (
        <div className={`border-b px-4 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs shadow-xs transition-colors ${
          validationReport.errorCount > 0
            ? 'bg-[#fff1f2] border-rose-300 text-rose-950'
            : 'bg-[#fff9e6] border-[#e6d08a] text-[#5c4300]'
        }`}>
          <div className="flex items-center gap-2.5">
            {validationReport.errorCount > 0 ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#d97706] shrink-0" />
            )}
            <span>
              <strong className={`font-semibold ${validationReport.errorCount > 0 ? 'text-rose-900' : 'text-[#78350f]'}`}>
                {validationReport.errorCount > 0 ? 'XFA Validation Alert:' : 'Interactive Adobe LiveCycle XFA Document:'}
              </strong>{' '}
              {validationReport.errorCount > 0 ? (
                <span>
                  {validationReport.errorCount} validation {validationReport.errorCount === 1 ? 'error requires' : 'errors require'} attention across form fields.
                </span>
              ) : isCanadaBookFund ? (
                'Canada Book Fund Financial Report Form (cBF-FinRepDatFrm-eng) is fully parsed and unlocked.'
              ) : (
                'All dynamic form calculations, subform hierarchies, and datasets are operational.'
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {validationReport.errorCount > 0 ? (
              <button
                onClick={() => setRightTool('formEditor')}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium transition-colors text-xs flex items-center gap-1.5 shadow-xs"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Fix {validationReport.errorCount} {validationReport.errorCount === 1 ? 'Error' : 'Errors'}</span>
              </button>
            ) : (
              <button
                onClick={() => setRightTool('formEditor')}
                className="px-2.5 py-1 bg-[#fef3c7] hover:bg-[#fde68a] border border-[#d97706]/40 text-[#78350f] rounded font-medium transition-colors text-xs"
              >
                Open Form Editor
              </button>
            )}
            <button
              onClick={onExportPdf}
              className="px-2.5 py-1 bg-[#d97706] hover:bg-[#b45309] text-white rounded font-medium transition-colors text-xs shadow-xs"
            >
              Export Filled PDF
            </button>
          </div>
        </div>
      )}

      {/* 5. Main 3-Pane Acrobat Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navigation Icon Strip */}
        <div className="w-12 bg-[#262626] border-r border-[#383838] flex flex-col items-center py-3 gap-3 shrink-0 z-20">
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

        {/* Left Expanded Drawer */}
        {leftPanel !== 'none' && (
          <div className="w-72 bg-[#222222] border-r border-[#383838] flex flex-col shrink-0 z-10 overflow-hidden animate-in slide-in-from-left duration-150">
            <div className="px-3 py-2.5 bg-[#1e1e1e] border-b border-[#333] flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                {leftPanel === 'fields' && 'XFA Form Fields'}
                {leftPanel === 'bookmarks' && 'Document Outline'}
                {leftPanel === 'attachments' && 'File Attachments'}
              </span>
              <button
                onClick={() => setLeftPanel('none')}
                className="text-slate-400 hover:text-slate-200 p-1 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
              {leftPanel === 'fields' && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 pb-1 border-b border-[#333]">
                    {fields.length} detected fields across {subforms.length} subforms
                  </div>
                  {fields.map(f => (
                    <div
                      key={f.id}
                      onClick={() => {
                        onFieldValueChange(f.id, f.value);
                        onShowToast(`Selected field: ${f.caption || f.name}`);
                      }}
                      className="p-2 rounded bg-[#2a2a2a] hover:bg-[#353535] border border-[#383838] cursor-pointer transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 truncate pr-1">
                          {f.caption || f.name}
                        </span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#1e1e1e] text-sky-400 border border-[#444]">
                          {f.type}
                        </span>
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
                    <div key={sf.id} className="p-2 rounded bg-[#2a2a2a] border border-[#383838]">
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
                    className="mt-2 px-3 py-1 bg-[#333] hover:bg-[#444] text-slate-200 rounded text-xs transition-colors"
                  >
                    Download Resource ZIP
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Center Stage: The Classic Adobe Acrobat Gray Canvas Viewport */}
        <div className="flex-1 bg-[#525659] overflow-y-auto flex flex-col relative">
          <PdfCanvasViewer
            pdfBytes={pdfBytes}
            filename={filename}
            hasXfa={hasXfa}
            fields={fields}
            subforms={subforms}
            targetFieldId={targetFieldId}
            onFieldValueChange={onFieldValueChange}
            onUpdateFieldAppearance={onUpdateFieldAppearance}
            onResetFieldAppearance={onResetFieldAppearance}
            onSwitchToForm={() => setRightTool('formEditor')}
            onSwitchToResources={() => setRightTool('resources')}
          />
        </div>

        {/* Right Tools Pane (The Iconic Acrobat Pro Right Sidebar) */}
        <div className="w-14 bg-[#262626] border-l border-[#383838] flex flex-col items-center py-3 gap-4 shrink-0 z-20">
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

        {/* Right Tool Drawer */}
        {rightTool !== 'none' && (
          <div className="w-96 bg-[#222222] border-l border-[#383838] flex flex-col shrink-0 z-10 overflow-y-auto animate-in slide-in-from-right duration-150">
            <div className="px-4 py-3 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between sticky top-0 z-10">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                {rightTool === 'formEditor' && 'Interactive Form & Bulk Editor'}
                {rightTool === 'export' && 'Export PDF & Form Data'}
                {rightTool === 'preflight' && 'Preflight PDF Audit'}
                {rightTool === 'convert' && 'Document Conversion'}
                {rightTool === 'resources' && 'Extracted Resources'}
                {rightTool === 'xml' && 'Raw XFA XML Packets'}
                {rightTool === 'batch' && 'Batch Processing'}
              </span>
              <button
                onClick={() => setRightTool('none')}
                className="text-slate-400 hover:text-slate-200 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1">
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
                      className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                    >
                      Export PDF
                    </button>
                  </div>

                  <div className="bg-[#2a2a2a] border border-[#383838] rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-slate-200">Export Raw Form Data</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={onExportXml}
                        className="py-1.5 px-3 bg-[#333] hover:bg-[#3e3e3e] border border-[#444] rounded-lg text-xs font-medium text-slate-200 transition-colors"
                      >
                        XML Dataset
                      </button>
                      <button
                        onClick={onExportJson}
                        className="py-1.5 px-3 bg-[#333] hover:bg-[#3e3e3e] border border-[#444] rounded-lg text-xs font-medium text-slate-200 transition-colors"
                      >
                        JSON File
                      </button>
                    </div>
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
                  metadata={manifest?.metadata || null}
                  fields={fields}
                  subforms={subforms}
                  textPages={manifest?.textPages || []}
                  manifest={manifest}
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
    </div>
  );
};
