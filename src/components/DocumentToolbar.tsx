import React, { useRef, useState } from 'react';
import {
  Upload,
  FileCode,
  FileJson,
  Layers,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  ChevronDown,
  ExternalLink,
  LayoutGrid,
  FileCheck,
} from 'lucide-react';
import { PdfDocumentMetadata, XFAField } from '../types/pdf';
import { PageOrganizerModal } from './PageOrganizerModal';
import { RegularPdfConvertModal } from './RegularPdfConvertModal';
import { PageOrganizationResult } from '../utils/pageOrganizer';

interface DocumentToolbarProps {
  filename: string;
  metadata: PdfDocumentMetadata | null;
  pdfBytes?: Uint8Array | null;
  fields?: XFAField[];
  onApplyPageOrganization?: (
    result: PageOrganizationResult,
    removeDeletedPageFields: boolean
  ) => Promise<void> | void;
  onLoadConvertedPdf?: (bytes: Uint8Array, filename: string) => void;
  onShowToast?: (msg: string) => void;
  onFileUpload: (file: File) => void;
  onLoadSampleXfa: () => void;
  onLoadSampleMedia: () => void;
  onLoadCanadaBookFund?: () => void;
  onLoadAttachedXfa?: () => void;
  onOpenUrlModal?: () => void;
  onImportXml: (xmlString: string) => void;
  onExportXml: () => void;
  onExportJson: () => void;
  onSwitchToConvert?: () => void;
  hasXfa: boolean;
  totalFieldsCount: number;
  completedFieldsCount: number;
}

export const DocumentToolbar: React.FC<DocumentToolbarProps> = ({
  filename,
  metadata,
  pdfBytes = null,
  fields = [],
  onApplyPageOrganization,
  onLoadConvertedPdf,
  onShowToast,
  onFileUpload,
  onLoadSampleXfa,
  onLoadSampleMedia,
  onLoadCanadaBookFund,
  onLoadAttachedXfa,
  onOpenUrlModal,
  onImportXml,
  onExportXml,
  onExportJson,
  onSwitchToConvert,
  hasXfa,
  totalFieldsCount,
  completedFieldsCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isPageOrganizerOpen, setIsPageOrganizerOpen] = useState(false);
  const [isStandardPdfModalOpen, setIsStandardPdfModalOpen] = useState(false);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = '';
    }
  };

  const handleXmlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        const text = ev.target?.result as string;
        if (text) onImportXml(text);
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const pageCount = metadata?.pageCount || 1;
  const percentComplete = totalFieldsCount > 0 ? Math.round((completedFieldsCount / totalFieldsCount) * 100) : 0;

  return (
    <div className="bg-slate-900/60 border-b border-slate-800 px-3 sm:px-6 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Left: Document details and XFA indicator */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 truncate">
            <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate max-w-[155px] sm:max-w-[240px] md:max-w-[340px]" title={filename}>
              {filename}
            </span>

            {/* Unboxed metadata with clickable page count to launch Page Organizer */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono shrink-0">
              <span>·</span>
              <button
                type="button"
                onClick={() => setIsPageOrganizerOpen(true)}
                className="hover:text-sky-300 underline decoration-dotted underline-offset-2 transition-colors cursor-pointer"
                title="Click to reorder or delete PDF pages"
              >
                {pageCount} {pageCount === 1 ? 'page' : 'pages'}
              </button>
              <span>·</span>
              <span>{formatFileSize(metadata?.fileSizeBytes)}</span>
            </div>
          </div>

          {/* Form architecture tag */}
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            {hasXfa ? (
              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-sm bg-sky-950/70 border border-sky-600/40 text-sky-300 font-mono text-[10px] sm:text-[11px]">
                <CheckCircle2 className="w-3 h-3 text-sky-400" />
                <span className="hidden sm:inline">{metadata?.xfaType === 'dynamic' ? 'Dynamic XFA' : 'Static XFA'} Form</span>
                <span className="sm:hidden">XFA ({totalFieldsCount})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-sm bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px] sm:text-[11px]">
                <Layers className="w-3 h-3 text-slate-400" />
                <span>PDF</span>
              </span>
            )}
          </div>

          {/* Form completion progress if XFA has fields */}
          {hasXfa && totalFieldsCount > 0 && (
            <div className="hidden xl:flex items-center gap-2 text-xs text-slate-400 pl-2 border-l border-slate-800">
              <span className="font-mono tabular-nums text-slate-200">
                {completedFieldsCount}/{totalFieldsCount}
              </span>
              <span>fields filled ({percentComplete}%)</span>
            </div>
          )}
        </div>

        {/* Right: Actions (Open, Organize Pages, Sample load, Import/Export data) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".pdf,application/pdf"
            className="hidden"
          />
          <input
            type="file"
            ref={xmlInputRef}
            onChange={handleXmlInputChange}
            accept=".xml,text/xml,application/xml"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer"
            title="Open any PDF or XFA file from your device"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>Open PDF</span>
          </button>

          {/* Organize Pages (Drag-and-Drop Reorder & Delete Pages Tool) */}
          {pdfBytes && (
            <button
              type="button"
              onClick={() => setIsPageOrganizerOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-sky-200 bg-sky-950/60 hover:bg-sky-900/70 border border-sky-600/50 rounded-md transition-colors cursor-pointer"
              title="Reorder, rotate, duplicate, or delete PDF pages using a drag-and-drop thumbnail grid"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Organize Pages</span>
              <span className="sm:hidden">Pages</span>
              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-[10px] font-mono text-sky-300">
                {pageCount}
              </span>
            </button>
          )}

          {/* XFA PDF -> Standard PDF Conversion Tool Quick Trigger */}
          {pdfBytes && (
            <button
              type="button"
              onClick={() => setIsStandardPdfModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-red-200 bg-red-950/60 hover:bg-red-900/70 border border-red-600/50 rounded-md transition-colors cursor-pointer"
              title="Convert XFA PDF into an ISO 32000-1 Standard PDF while retaining form fields and data"
            >
              <FileCheck className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden md:inline">XFA → Standard PDF</span>
              <span className="md:hidden">Standard PDF</span>
            </button>
          )}

          {/* Mobile & Tablet Compact Samples & Data Toggle (< lg) */}
          <button
            onClick={() => setMobileDrawerOpen(prev => !prev)}
            className={`lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              mobileDrawerOpen
                ? 'bg-amber-950/80 border-amber-500/70 text-amber-200'
                : 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Samples &amp; Data</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${mobileDrawerOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Desktop Sample quick-loaders (lg:flex) */}
          <div className="hidden lg:flex items-center rounded-md bg-slate-800/80 p-0.5 border border-slate-700/80">
            <button
              onClick={onLoadSampleXfa}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-sky-300 hover:bg-slate-700/60 rounded transition-colors whitespace-nowrap"
              title="Load high-fidelity Dynamic XFA enterprise registration form"
            >
              Sample XFA
            </button>
            <span className="text-slate-600 text-xs">|</span>
            <button
              onClick={onLoadSampleMedia}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-sky-300 hover:bg-slate-700/60 rounded transition-colors whitespace-nowrap"
              title="Load sample PDF with multiple images, fonts, and metadata for resource extraction"
            >
              Sample Media
            </button>
            {onLoadAttachedXfa && (
              <>
                <span className="text-slate-600 text-xs">|</span>
                <button
                  onClick={onLoadAttachedXfa}
                  className="px-2.5 py-1 text-xs font-semibold text-amber-300 hover:text-white hover:bg-amber-950/80 rounded transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                  title="Load the attached dynamic LiveCycle XFA PDF (xfa_771a0a93.pdf)"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Attached XFA Sample</span>
                  <span className="text-[10px] font-mono bg-amber-500/20 px-1 py-0.2 rounded text-amber-300">44 Fields</span>
                </button>
              </>
            )}
            {onLoadCanadaBookFund && (
              <>
                <span className="text-slate-600 text-xs">|</span>
                <button
                  onClick={onLoadCanadaBookFund}
                  className="px-2.5 py-1 text-xs font-semibold text-red-300 hover:text-white hover:bg-red-950/80 rounded transition-colors whitespace-nowrap flex items-center gap-1"
                  title="Load official Canada Book Fund XFA Form (cBF-FinRepDatFrm-eng.pdf)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span>Canada Book Fund (cBF)</span>
                </button>
              </>
            )}
          </div>

          {onOpenUrlModal && (
            <button
              onClick={onOpenUrlModal}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
              title="Open document from direct web URL"
            >
              <span>From URL</span>
            </button>
          )}

          {/* Convert to Office Quick Trigger */}
          {onSwitchToConvert && (
            <button
              onClick={onSwitchToConvert}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-md transition-colors"
              title="Convert this document to Microsoft Word (.docx), Excel, HTML, or Markdown offline"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden xl:inline">Convert to</span>
              <span>Word / Office</span>
            </button>
          )}

          {/* Data import/export buttons (if XFA is loaded) */}
          {hasXfa && (
            <div className="hidden xl:flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <button
                onClick={() => xmlInputRef.current?.click()}
                className="px-2 py-1 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
                title="Import external XML datasets into this XFA form"
              >
                Import XML
              </button>
              <button
                onClick={onExportXml}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
                title="Export form datasets as standard XML"
              >
                <FileCode className="w-3 h-3 text-sky-400" />
                <span>Export XML</span>
              </button>
              <button
                onClick={onExportJson}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
                title="Export form field key-values as JSON"
              >
                <FileJson className="w-3 h-3 text-emerald-400" />
                <span>Export JSON</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Mobile & Tablet Tray for Samples, URL & XML/JSON Data (< lg) */}
      {mobileDrawerOpen && (
        <div className="lg:hidden mt-2.5 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {pdfBytes && (
            <button
              onClick={() => {
                setIsPageOrganizerOpen(true);
                setMobileDrawerOpen(false);
              }}
              className="px-2.5 py-2 rounded-lg bg-sky-950/60 hover:bg-sky-900/60 border border-sky-600/50 text-sky-200 font-semibold flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5 truncate">
                <LayoutGrid className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">Organize Pages</span>
              </span>
              <span className="text-[10px] font-mono bg-sky-500/20 px-1 rounded shrink-0">
                {pageCount}p
              </span>
            </button>
          )}

          {pdfBytes && (
            <button
              onClick={() => {
                setIsStandardPdfModalOpen(true);
                setMobileDrawerOpen(false);
              }}
              className="px-2.5 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-600/50 text-red-200 font-semibold flex items-center gap-1.5 truncate"
            >
              <FileCheck className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="truncate">XFA → Standard PDF</span>
            </button>
          )}

          {onLoadAttachedXfa && (
            <button
              onClick={() => {
                onLoadAttachedXfa();
                setMobileDrawerOpen(false);
              }}
              className="px-2.5 py-2 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 border border-amber-600/50 text-amber-200 font-semibold flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Attached XFA</span>
              </span>
              <span className="text-[10px] font-mono bg-amber-500/20 px-1 rounded shrink-0">44</span>
            </button>
          )}

          {onLoadCanadaBookFund && (
            <button
              onClick={() => {
                onLoadCanadaBookFund();
                setMobileDrawerOpen(false);
              }}
              className="px-2.5 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-200 font-semibold flex items-center gap-1.5 truncate"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span className="truncate">Canada Book Fund</span>
            </button>
          )}

          <button
            onClick={() => {
              onLoadSampleXfa();
              setMobileDrawerOpen(false);
            }}
            className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium truncate text-left"
          >
            Sample Enterprise XFA
          </button>

          <button
            onClick={() => {
              onLoadSampleMedia();
              setMobileDrawerOpen(false);
            }}
            className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium truncate text-left"
          >
            Sample Media &amp; Fonts
          </button>

          {onOpenUrlModal && (
            <button
              onClick={() => {
                onOpenUrlModal();
                setMobileDrawerOpen(false);
              }}
              className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-medium flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Open From URL</span>
            </button>
          )}

          {hasXfa && (
            <>
              <button
                onClick={() => {
                  xmlInputRef.current?.click();
                  setMobileDrawerOpen(false);
                }}
                className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-left"
              >
                Import XML Dataset
              </button>
              <button
                onClick={() => {
                  onExportXml();
                  setMobileDrawerOpen(false);
                }}
                className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-medium flex items-center gap-1.5"
              >
                <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Export XML</span>
              </button>
              <button
                onClick={() => {
                  onExportJson();
                  setMobileDrawerOpen(false);
                }}
                className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-medium flex items-center gap-1.5"
              >
                <FileJson className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Export JSON</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Drag-and-Drop Page Organizer Modal */}
      <PageOrganizerModal
        isOpen={isPageOrganizerOpen}
        onClose={() => setIsPageOrganizerOpen(false)}
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
      {pdfBytes && (
        <RegularPdfConvertModal
          isOpen={isStandardPdfModalOpen}
          onClose={() => setIsStandardPdfModalOpen(false)}
          pdfBytes={pdfBytes}
          filename={filename}
          fields={fields}
          onShowToast={onShowToast}
          onLoadConvertedPdf={onLoadConvertedPdf}
        />
      )}
    </div>
  );
};


