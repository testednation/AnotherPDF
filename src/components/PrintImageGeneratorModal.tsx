import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Camera,
  Download,
  Copy,
  Check,
  X,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  FolderArchive,
  Layers,
  Sliders,
  ChevronLeft,
  ChevronRight,
  FileImage,
  Printer,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { XFAField, XFASubform } from '../types/pdf';
import { PageAnnotations } from '../types/drawing';
import {
  FormPrintImageOptions,
  FormPrintImageResult,
  PrintImageDpi,
  PrintImageFormat,
  PrintImageColorMode,
  PrintImageLayoutMode,
  renderFormPrintImages,
  stitchPrintPagesVertically,
  bundlePrintImagesAsZip,
  getFormatExtension,
} from '../utils/formPrintImageRenderer';

interface PrintImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array | null;
  filename: string;
  fields: XFAField[];
  subforms?: XFASubform[];
  pageAnnotations?: PageAnnotations;
  onShowToast?: (msg: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function triggerBlobDownload(blob: Blob, downloadFilename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const PrintImageGeneratorModal: React.FC<PrintImageGeneratorModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  filename,
  fields,
  subforms = [],
  pageAnnotations = {},
  onShowToast,
}) => {
  const [dpi, setDpi] = useState<PrintImageDpi>(200);
  const [format, setFormat] = useState<PrintImageFormat>('png');
  const [colorMode, setColorMode] = useState<PrintImageColorMode>('color');
  const [layoutMode, setLayoutMode] = useState<PrintImageLayoutMode>('auto');
  const [showFieldBorders, setShowFieldBorders] = useState<boolean>(true);
  const [includeEmptyFields, setIncludeEmptyFields] = useState<boolean>(true);
  const [includePrintFooter, setIncludePrintFooter] = useState<boolean>(false);

  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState<{ message: string; percent: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<FormPrintImageResult | null>(null);

  const [activePageIndex, setActivePageIndex] = useState(0);
  const [zoomMode, setZoomMode] = useState<'fit' | 'actual'>('fit');
  const [copiedClipboard, setCopiedClipboard] = useState(false);
  const [isExportingAction, setIsExportingAction] = useState<'stitch' | 'zip' | null>(null);

  const renderSeqRef = useRef(0);

  const generatePrintPreview = useCallback(async () => {
    if (!pdfBytes) return;
    const seq = ++renderSeqRef.current;

    setIsRendering(true);
    setErrorMsg(null);
    setProgress({ message: 'Preparing print proof canvas...', percent: 5 });

    try {
      const options: FormPrintImageOptions = {
        dpi,
        format,
        jpegQuality: 0.95,
        colorMode,
        layoutMode,
        showFieldBorders,
        includeEmptyFields,
        includePrintFooter,
        includeAnnotations: true,
        pageAnnotations,
        documentTitle: filename.replace(/\.pdf$/i, '').replace(/_/g, ' '),
        onProgress: p => {
          if (seq === renderSeqRef.current) {
            setProgress({ message: p.message, percent: p.percent });
          }
        },
      };

      const rendered = await renderFormPrintImages(pdfBytes, fields, subforms, options);
      if (seq !== renderSeqRef.current) return;

      setResult(rendered);
      setActivePageIndex(prev => Math.min(prev, Math.max(0, rendered.pages.length - 1)));
    } catch (err: any) {
      if (seq !== renderSeqRef.current) return;
      console.error('Print image generation error:', err);
      setErrorMsg(err?.message || 'Failed to render print image preview');
    } finally {
      if (seq === renderSeqRef.current) {
        setIsRendering(false);
        setProgress(null);
      }
    }
  }, [
    pdfBytes,
    fields,
    subforms,
    dpi,
    format,
    colorMode,
    layoutMode,
    showFieldBorders,
    includeEmptyFields,
    includePrintFooter,
    pageAnnotations,
    filename,
  ]);

  // Auto-generate when modal opens or print configuration changes
  useEffect(() => {
    if (!isOpen || !pdfBytes) return;
    const timer = window.setTimeout(() => {
      generatePrintPreview();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isOpen, pdfBytes, generatePrintPreview]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPage = result?.pages[activePageIndex] || null;
  const totalPages = result?.pages.length || 0;
  const baseName = filename.replace(/\.pdf$/i, '');
  const ext = getFormatExtension(format);

  const handleDownloadCurrentPage = () => {
    if (!currentPage) return;
    const pageSuffix = totalPages > 1 ? `_page_${currentPage.pageNumber}` : '';
    const outName = `${baseName}_print_${dpi}dpi${pageSuffix}.${ext}`;
    triggerBlobDownload(currentPage.blob, outName);
    onShowToast?.(`Downloaded ${outName}`);
  };

  const handleDownloadStitchedSheet = async () => {
    if (!result || result.pages.length === 0) return;
    setIsExportingAction('stitch');
    try {
      const stitched = await stitchPrintPagesVertically(result.pages, format, 0.95);
      const outName = `${baseName}_print_all_pages_${dpi}dpi.${ext}`;
      triggerBlobDownload(stitched.blob, outName);
      onShowToast?.(`Downloaded combined ${totalPages}-page image (${stitched.widthPx}×${stitched.heightPx}px)`);
    } catch (err: any) {
      onShowToast?.(`Failed to stitch pages: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExportingAction(null);
    }
  };

  const handleDownloadAllZip = async () => {
    if (!result || result.pages.length === 0) return;
    setIsExportingAction('zip');
    try {
      const zipBlob = await bundlePrintImagesAsZip(result.pages, filename, format);
      const outName = `${baseName}_print_images_${dpi}dpi.zip`;
      triggerBlobDownload(zipBlob, outName);
      onShowToast?.(`Downloaded ZIP with ${totalPages} high-resolution page images`);
    } catch (err: any) {
      onShowToast?.(`Failed to create ZIP: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExportingAction(null);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!currentPage) return;
    try {
      let pngBlob = currentPage.blob;
      // Clipboard API requires image/png for broad browser support
      if (currentPage.mimeType !== 'image/png') {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = currentPage.dataUrl;
        });
        const c = document.createElement('canvas');
        c.width = currentPage.widthPx;
        c.height = currentPage.heightPx;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          pngBlob = await new Promise<Blob>((resolve, reject) =>
            c.toBlob(b => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png')
          );
        }
      }

      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
        setCopiedClipboard(true);
        onShowToast?.(`Copied Page ${currentPage.pageNumber} print image to clipboard`);
        setTimeout(() => setCopiedClipboard(false), 2000);
      } else {
        onShowToast?.('Clipboard image copy is not supported in this browser; use Download instead.');
      }
    } catch (err: any) {
      console.warn('Clipboard copy warning:', err);
      onShowToast?.('Unable to copy image to clipboard; please use Download.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Print Form Image Generator"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-slate-950 border border-slate-700/80 rounded-2xl w-full max-w-6xl h-[92vh] max-h-[860px] flex flex-col shadow-2xl text-slate-100 overflow-hidden"
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Camera className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  Print-Ready Form Image Snapshot
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-700/50 text-[10px] font-mono text-emerald-300">
                  <Printer className="w-3 h-3" />
                  <span>{dpi} DPI</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                High-fidelity print proof of <span className="text-slate-200 font-mono">{filename}</span> with all current form field values applied
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Left Options Sidebar + Right Live High-DPI Print Preview */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Left Settings Panel */}
          <aside className="w-full lg:w-80 bg-slate-900/50 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 overflow-y-auto shrink-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Print Output Settings</span>
              </div>
              <button
                type="button"
                onClick={generatePrintPreview}
                disabled={isRendering}
                className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 disabled:opacity-50 cursor-pointer"
                title="Re-render preview with latest field values"
              >
                <RefreshCw className={`w-3 h-3 ${isRendering ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Print Resolution (DPI) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400 block">
                Print Resolution (DPI)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {([150, 200, 300] as PrintImageDpi[]).map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDpi(val)}
                    className={`px-2 py-2 rounded-lg border text-center transition-all cursor-pointer ${
                      dpi === val
                        ? 'bg-emerald-950/70 border-emerald-500/70 text-emerald-200 shadow-xs'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono">{val}</div>
                    <div className="text-[10px] text-slate-400">
                      {val === 150 ? 'Proof' : val === 200 ? 'Standard' : 'Ultra HD'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Format */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400 block">
                Image File Format
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['png', 'jpeg', 'webp'] as PrintImageFormat[]).map(fmt => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-semibold uppercase transition-all cursor-pointer ${
                      format === fmt
                        ? 'bg-sky-950/70 border-sky-500/70 text-sky-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {fmt === 'jpeg' ? 'JPG' : fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Mode */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400 block">
                Ink / Color Mode
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setColorMode('color')}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    colorMode === 'color'
                      ? 'bg-sky-950/70 border-sky-500/70 text-sky-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Full Color
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode('grayscale')}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    colorMode === 'grayscale'
                      ? 'bg-slate-700 border-slate-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Laser Grayscale
                </button>
              </div>
            </div>

            {/* Layout Source */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400 block">
                Form Rendering Mode
              </label>
              <select
                value={layoutMode}
                onChange={e => setLayoutMode(e.target.value as PrintImageLayoutMode)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="auto">Auto (Exact PDF + Bypass XFA Shell)</option>
                <option value="exact_pdf">Exact PDF Canvas + Field Overlay</option>
                <option value="clean_print_sheet">Clean Structured Print Form Sheet</option>
              </select>
            </div>

            {/* Print Appearance Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer">
                <span>Show field borders &amp; boxes</span>
                <input
                  type="checkbox"
                  checked={showFieldBorders}
                  onChange={e => setShowFieldBorders(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30"
                />
              </label>

              <label className="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer">
                <span>Include empty form fields</span>
                <input
                  type="checkbox"
                  checked={includeEmptyFields}
                  onChange={e => setIncludeEmptyFields(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30"
                />
              </label>

              <label className="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer">
                <span>Add print proof footer &amp; page #</span>
                <input
                  type="checkbox"
                  checked={includePrintFooter}
                  onChange={e => setIncludePrintFooter(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30"
                />
              </label>
            </div>

            {/* Output Diagnostics Summary */}
            {result && currentPage && (
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Print Proof Ready</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-slate-400 font-mono">
                  <span>Dimensions:</span>
                  <span className="text-right text-slate-200">
                    {currentPage.widthPx}×{currentPage.heightPx}px
                  </span>
                  <span>Page Size:</span>
                  <span className="text-right text-slate-200">
                    {formatBytes(currentPage.sizeBytes)}
                  </span>
                  <span>Pages:</span>
                  <span className="text-right text-slate-200">{totalPages}</span>
                  <span>Fields Filled:</span>
                  <span className="text-right text-emerald-300">
                    {result.totalFilledFields} / {result.totalFieldsRendered}
                  </span>
                </div>
                {result.wasDynamicShellSynthesized && (
                  <p className="text-[10px] text-amber-300/90 bg-amber-950/40 border border-amber-800/40 rounded-md px-2 py-1.5 leading-snug">
                    Synthesized clean multi-page print sheet from live XFA template &amp; field values.
                  </p>
                )}
              </div>
            )}
          </aside>

          {/* Right Preview Stage */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-950">
            {/* Stage Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900/70 border-b border-slate-800 shrink-0 text-xs">
              <div className="flex items-center gap-2">
                {totalPages > 1 ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActivePageIndex(i => Math.max(0, i - 1))}
                      disabled={activePageIndex <= 0}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-mono text-slate-300">
                      Page {activePageIndex + 1} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActivePageIndex(i => Math.min(totalPages - 1, i + 1))}
                      disabled={activePageIndex >= totalPages - 1}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400 font-mono flex items-center gap-1.5">
                    <FileImage className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Page 1 of 1</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoomMode('fit')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                    zoomMode === 'fit'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                  <span>Fit Page</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoomMode('actual')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                    zoomMode === 'actual'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>100% Pixels</span>
                </button>
              </div>
            </div>

            {/* Main Proofing Canvas Backdrop */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-start justify-center bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:18px_18px]">
              {isRendering ? (
                <div className="my-auto flex flex-col items-center gap-3 text-center max-w-sm">
                  <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-200">
                      {progress?.message || 'Rendering high-fidelity print image...'}
                    </p>
                    <div className="w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden mx-auto">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-200"
                        style={{ width: `${progress?.percent ?? 35}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : errorMsg ? (
                <div className="my-auto max-w-md bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
                  <p className="text-xs font-semibold text-rose-200">{errorMsg}</p>
                  <button
                    type="button"
                    onClick={generatePrintPreview}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
                  >
                    Retry Render
                  </button>
                </div>
              ) : currentPage ? (
                <div
                  className={`bg-white shadow-[0_18px_50px_rgba(0,0,0,0.65)] ring-1 ring-slate-700/60 transition-all ${
                    zoomMode === 'fit' ? 'max-h-full max-w-full' : ''
                  }`}
                >
                  <img
                    src={currentPage.dataUrl}
                    alt={`Printed form preview - Page ${currentPage.pageNumber}`}
                    className={
                      zoomMode === 'fit'
                        ? 'block max-w-full max-h-[58vh] w-auto h-auto object-contain'
                        : 'block max-w-none'
                    }
                    style={
                      zoomMode === 'actual'
                        ? { width: `${currentPage.widthPx}px`, height: `${currentPage.heightPx}px` }
                        : undefined
                    }
                  />
                </div>
              ) : null}
            </div>

            {/* Multi-Page Thumbnail Strip */}
            {result && result.pages.length > 1 && (
              <div className="px-4 py-2.5 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2.5 overflow-x-auto shrink-0">
                {result.pages.map((p, idx) => (
                  <button
                    key={p.pageNumber}
                    type="button"
                    onClick={() => setActivePageIndex(idx)}
                    className={`relative shrink-0 rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                      idx === activePageIndex
                        ? 'border-emerald-400 ring-2 ring-emerald-500/30'
                        : 'border-slate-700 opacity-70 hover:opacity-100'
                    }`}
                    title={`Page ${p.pageNumber} (${p.widthPx}×${p.heightPx}px)`}
                  >
                    <img
                      src={p.dataUrl}
                      alt={`Page ${p.pageNumber}`}
                      className="h-14 w-auto bg-white object-contain"
                    />
                    <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-slate-950/85 text-[9px] font-mono text-white">
                      {p.pageNumber}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Export Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-slate-900 border-t border-slate-800 shrink-0">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Rendered 100% locally in-browser with live field values · No server upload
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleCopyToClipboard}
              disabled={!currentPage || isRendering}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {copiedClipboard ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-sky-400" />
                  <span>Copy Image</span>
                </>
              )}
            </button>

            {totalPages > 1 && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadStitchedSheet}
                  disabled={!result || isRendering || isExportingAction !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Combine all pages vertically into one continuous high-resolution image"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isExportingAction === 'stitch' ? 'Stitching...' : 'Combined Sheet'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAllZip}
                  disabled={!result || isRendering || isExportingAction !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-sky-950/80 hover:bg-sky-900 text-sky-200 border border-sky-700/70 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Download every page as an individual high-DPI image inside a ZIP archive"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-sky-400" />
                  <span>{isExportingAction === 'zip' ? 'Zipping...' : `All ${totalPages} Pages (ZIP)`}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDownloadCurrentPage}
              disabled={!currentPage || isRendering}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                Download {totalPages > 1 ? `Page ${activePageIndex + 1}` : 'Print Image'} (.{ext.toUpperCase()})
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
