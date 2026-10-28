import React, { useRef } from 'react';
import {
  Upload,
  FileCheck2,
  FileCode,
  FileJson,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { PdfDocumentMetadata } from '../types/pdf';

interface DocumentToolbarProps {
  filename: string;
  metadata: PdfDocumentMetadata | null;
  onFileUpload: (file: File) => void;
  onLoadSampleXfa: () => void;
  onLoadSampleMedia: () => void;
  onLoadCanadaBookFund?: () => void;
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
  onFileUpload,
  onLoadSampleXfa,
  onLoadSampleMedia,
  onLoadCanadaBookFund,
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

  const percentComplete = totalFieldsCount > 0 ? Math.round((completedFieldsCount / totalFieldsCount) * 100) : 0;

  return (
    <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Document details and XFA indicator */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 truncate">
            <span className="text-sm font-semibold text-slate-200 truncate max-w-[240px] md:max-w-[340px]" title={filename}>
              {filename}
            </span>

            {/* Zero-pill style unboxed metadata */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono shrink-0">
              <span>·</span>
              <span>{metadata?.pageCount || 1} {metadata?.pageCount === 1 ? 'page' : 'pages'}</span>
              <span>·</span>
              <span>{formatFileSize(metadata?.fileSizeBytes)}</span>
            </div>
          </div>

          {/* Form architecture tag */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            {hasXfa ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-sky-950/70 border border-sky-600/40 text-sky-300 font-mono text-[11px]">
                <CheckCircle2 className="w-3 h-3 text-sky-400" />
                <span>{metadata?.xfaType === 'dynamic' ? 'Dynamic XFA' : 'Static XFA'} Form</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
                <Layers className="w-3 h-3 text-slate-400" />
                <span>Standard PDF</span>
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

        {/* Right: Actions (Open, Sample load, Import/Export data) */}
        <div className="flex items-center gap-2 shrink-0">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
            title="Open any PDF or XFA file from your device"
          >
            <Upload className="w-3.5 h-3.5 text-slate-300" />
            <span>Open PDF</span>
          </button>

          {/* Sample quick-loaders */}
          <div className="flex items-center rounded-md bg-slate-800/80 p-0.5 border border-slate-700/80">
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
              title="Open document from direct web URL"
            >
              <span>From URL</span>
            </button>
          )}

          {/* Convert to Office Quick Trigger */}
          {onSwitchToConvert && (
            <button
              onClick={onSwitchToConvert}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-md transition-colors"
              title="Convert this document to Microsoft Word (.docx), Excel, HTML, or Markdown offline"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Convert to</span>
              <span>Word / Office</span>
            </button>
          )}

          {/* Data import/export buttons (if XFA is loaded) */}
          {hasXfa && (
            <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-slate-800">
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
    </div>
  );
};
