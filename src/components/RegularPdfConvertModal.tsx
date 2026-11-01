import React, { useState } from 'react';
import {
  FileCheck,
  CheckCircle2,
  X,
  Download,
  Layers,
  Sparkles,
  Sliders,
  AlertCircle,
  FileText,
  Check,
  ShieldCheck,
  Smartphone,
  Monitor,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { XFAField } from '../types/pdf';
import { PageAnnotations } from '../types/drawing';
import { convertXfaToRegularPdf } from '../utils/regularPdfConverter';

interface RegularPdfConvertModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array;
  filename: string;
  fields: XFAField[];
  pageAnnotations?: PageAnnotations;
  onShowToast?: (msg: string) => void;
}

export const RegularPdfConvertModal: React.FC<RegularPdfConvertModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  filename,
  fields,
  pageAnnotations = {},
  onShowToast,
}) => {
  const [conversionMode, setConversionMode] = useState<'interactive' | 'flattened'>('interactive');
  const [dpiOption, setDpiOption] = useState<'150' | '300'>('150');
  const [includeValues, setIncludeValues] = useState(true);
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [documentTitle, setDocumentTitle] = useState(
    filename.replace(/\.pdf$/i, '').replace(/_/g, ' ') + ' (Standard Form)'
  );

  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; message: string; percent: number } | null>(null);
  const [convertedResult, setConvertedResult] = useState<{ size: number; downloadUrl: string; downloadName: string } | null>(null);

  if (!isOpen) return null;

  const totalAnnotationsCount = Object.values(pageAnnotations).reduce((acc, strokes) => acc + strokes.length, 0);
  const filledFieldsCount = fields.filter(f => f.value && f.value.trim().length > 0).length;

  const handleStartConversion = async () => {
    setIsConverting(true);
    setProgress({ current: 0, total: 100, message: 'Starting universal PDF conversion...', percent: 5 });
    setConvertedResult(null);

    try {
      const convertedBytes = await convertXfaToRegularPdf(pdfBytes, fields, {
        mode: conversionMode,
        dpiScale: dpiOption === '300' ? 3.0 : 2.0,
        includeAnnotations,
        pageAnnotations,
        includeFormValues: includeValues,
        documentTitle,
        onProgress: setProgress,
      });

      const blob = new Blob([convertedBytes as any], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const suffix = conversionMode === 'interactive' ? '_regular_acroform.pdf' : '_flattened_standard.pdf';
      const downloadName = filename.replace(/\.pdf$/i, '') + suffix;

      setConvertedResult({
        size: convertedBytes.byteLength,
        downloadUrl,
        downloadName,
      });

      // Auto trigger download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (onShowToast) {
        onShowToast(`Converted and downloaded: ${downloadName}`);
      }
    } catch (err: any) {
      console.error('Regular PDF conversion error:', err);
      if (onShowToast) {
        onShowToast(`Conversion failed: ${err.message}`);
      }
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl text-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <FileCheck className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-slate-100">
                  Convert XFA to Regular PDF
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ISO 32000-1 Standard
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Transforms dynamic XFA forms into universally compatible regular PDFs with zero "Please wait..." errors
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Universal Compatibility Explainer Banner */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-sky-400 font-semibold">
              <Sparkles className="w-4 h-4" />
              <span>Universal PDF Compatibility Guarantee</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Standard browsers (Chrome, Safari, Edge, Firefox, iOS, and Android) cannot render dynamic XFA packets and display a blank "Please wait" page. This converter converts the rendered XFA document into an authentic standard ISO PDF with standard AcroForm interactive form fields.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 pt-1 font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3 h-3" /> Chrome &amp; Safari
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3 h-3" /> macOS Preview &amp; iOS
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3 h-3" /> Android &amp; Linux
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3 h-3" /> Adobe Acrobat Reader
              </span>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider font-mono">
              Select Output Format:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConversionMode('interactive')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  conversionMode === 'interactive'
                    ? 'bg-sky-950/40 border-sky-500 text-sky-100 ring-1 ring-sky-500/30'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                  <Monitor className="w-4 h-4 text-sky-400" />
                  <span>Standard AcroForm PDF</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Generates an interactive, fillable PDF with standard text boxes, checkboxes, and dropdowns. Users can edit values in any PDF viewer.
                </p>
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-300 font-mono border border-sky-800">
                  Recommended for Fillable Forms
                </span>
              </button>

              <button
                type="button"
                onClick={() => setConversionMode('flattened')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  conversionMode === 'flattened'
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span>Flattened Standard PDF</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Bakes all completed form field values, tables, and typography into certified static page streams. Form fields cannot be altered.
                </p>
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono border border-emerald-800">
                  Ideal for Archival &amp; Printing
                </span>
              </button>
            </div>
          </div>

          {/* Options & Configuration */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block font-mono">
              Conversion Parameters:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-400 text-[11px]">Print Quality &amp; DPI</label>
                <select
                  value={dpiOption}
                  onChange={e => setDpiOption(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="150">150 DPI (Balanced file size, fast render)</option>
                  <option value="300">300 DPI (Ultra high print resolution)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-[11px]">Document Title</label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={e => setDocumentTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-2 text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeValues}
                  onChange={e => setIncludeValues(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
                />
                <span>Include completed form values ({filledFieldsCount} fields currently filled)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAnnotations}
                  onChange={e => setIncludeAnnotations(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
                />
                <span>
                  Include handwritten annotations &amp; signatures ({totalAnnotationsCount} strokes recorded)
                </span>
              </label>
            </div>
          </div>

          {/* Progress Bar (Visible while converting) */}
          {isConverting && progress && (
            <div className="bg-slate-950/80 border border-sky-500/30 rounded-xl p-4 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-sky-400 font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{progress.message}</span>
                </div>
                <span className="font-mono text-slate-300">{progress.percent}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-sky-500 to-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Result Card (When completed) */}
          {convertedResult && (
            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-semibold text-emerald-200 block">
                    Regular PDF Created Successfully!
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {convertedResult.downloadName} ({(convertedResult.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              </div>

              <a
                href={convertedResult.downloadUrl}
                download={convertedResult.downloadName}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Re-download PDF</span>
              </a>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 text-xs shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleStartConversion}
            disabled={isConverting}
            className="px-4 py-2 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 active:from-sky-600 active:to-emerald-600 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isConverting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Converting XFA to Regular PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-950" />
                <span>
                  {conversionMode === 'interactive'
                    ? 'Convert to Interactive Regular PDF (.pdf)'
                    : 'Convert to Flattened Regular PDF (.pdf)'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
