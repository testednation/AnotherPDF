import React, { useState, useEffect, useRef } from 'react';
import {
  FileCheck,
  CheckCircle2,
  X,
  Download,
  Layers,
  Sparkles,
  FileText,
  Check,
  Monitor,
  Printer,
  RefreshCw,
  Upload,
  ShieldAlert,
  ArrowRight,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { XFAField, XFASubform } from '../types/pdf';
import { PageAnnotations } from '../types/drawing';
import { extractXfaPackets, parseXfaTemplate } from '../utils/xfaEngine';
import {
  StandardPdfConversionMode,
  XfaToStandardConversionReport,
  convertXfaToStandardPdfWithReport,
} from '../utils/regularPdfConverter';

interface RegularPdfConvertModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array;
  filename: string;
  fields: XFAField[];
  pageAnnotations?: PageAnnotations;
  onLoadConvertedPdf?: (bytes: Uint8Array, filename: string) => void;
  onShowToast?: (msg: string) => void;
}

export const RegularPdfConvertModal: React.FC<RegularPdfConvertModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  filename,
  fields,
  pageAnnotations = {},
  onLoadConvertedPdf,
  onShowToast,
}) => {
  // Source XFA PDF state (defaults to active workspace document, or user can upload a custom XFA PDF)
  const [sourceBytes, setSourceBytes] = useState<Uint8Array>(pdfBytes);
  const [sourceFilename, setSourceFilename] = useState<string>(filename);
  const [sourceFields, setSourceFields] = useState<XFAField[]>(fields);
  const [isCustomFile, setIsCustomFile] = useState(false);
  const [isParsingUpload, setIsParsingUpload] = useState(false);

  const [conversionMode, setConversionMode] = useState<StandardPdfConversionMode>('interactive');
  const [dpiOption, setDpiOption] = useState<'150' | '300'>('150');
  const [includeValues, setIncludeValues] = useState(true);
  const [preserveReadOnlyState, setPreserveReadOnlyState] = useState(false);
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [documentTitle, setDocumentTitle] = useState(
    filename.replace(/\.pdf$/i, '').replace(/_/g, ' ') + ' (Standard PDF)'
  );

  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    message: string;
    percent: number;
  } | null>(null);
  const [convertedResult, setConvertedResult] = useState<{
    bytes: Uint8Array;
    size: number;
    downloadUrl: string;
    downloadName: string;
    report: XfaToStandardConversionReport;
  } | null>(null);
  const [showFieldMappingTable, setShowFieldMappingTable] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with workspace PDF when opened unless user uploaded a custom file
  useEffect(() => {
    if (isOpen && !isCustomFile) {
      setSourceBytes(pdfBytes);
      setSourceFilename(filename);
      setSourceFields(fields);
      setDocumentTitle(filename.replace(/\.pdf$/i, '').replace(/_/g, ' ') + ' (Standard PDF)');
      setConvertedResult(null);
    }
  }, [isOpen, pdfBytes, filename, fields, isCustomFile]);

  if (!isOpen) return null;

  const totalAnnotationsCount = Object.values(pageAnnotations).reduce(
    (acc, strokes) => acc + strokes.length,
    0
  );
  const filledFieldsCount = sourceFields.filter(
    f => f.value && f.value.trim().length > 0 && f.value !== '0'
  ).length;
  const calculatedFieldsCount = sourceFields.filter(f => Boolean(f.validation?.scriptExpr)).length;

  // Handle uploading an external XFA PDF directly into the conversion tool
  const handleCustomXfaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingUpload(true);
    setConvertedResult(null);

    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const packets = await extractXfaPackets(pdfDoc, bytes);
      const subforms = parseXfaTemplate(packets.templateXml, packets.datasetsXml);

      const extractedFields: XFAField[] = [];
      const collect = (list: XFASubform[]) => {
        list.forEach(sf => {
          extractedFields.push(...sf.fields);
          if (sf.subforms.length > 0) collect(sf.subforms);
        });
      };
      collect(subforms);

      setSourceBytes(bytes);
      setSourceFilename(file.name);
      setSourceFields(extractedFields);
      setIsCustomFile(true);
      setDocumentTitle(file.name.replace(/\.pdf$/i, '').replace(/_/g, ' ') + ' (Standard PDF)');
      onShowToast?.(
        `Loaded ${file.name} for conversion (${extractedFields.length} XFA fields detected)`
      );
    } catch (err: any) {
      console.error('Error parsing uploaded XFA PDF:', err);
      onShowToast?.(`Could not parse uploaded PDF: ${err.message}`);
    } finally {
      setIsParsingUpload(false);
      e.target.value = '';
    }
  };

  const handleUseWorkspaceDocument = () => {
    setIsCustomFile(false);
    setSourceBytes(pdfBytes);
    setSourceFilename(filename);
    setSourceFields(fields);
    setDocumentTitle(filename.replace(/\.pdf$/i, '').replace(/_/g, ' ') + ' (Standard PDF)');
    setConvertedResult(null);
  };

  const handleStartConversion = async () => {
    setIsConverting(true);
    setProgress({
      current: 0,
      total: 100,
      message: 'Starting XFA to Standard ISO 32000-1 PDF conversion...',
      percent: 5,
    });
    setConvertedResult(null);

    try {
      const { pdfBytes: convertedBytes, report } = await convertXfaToStandardPdfWithReport(
        sourceBytes,
        sourceFields,
        {
          mode: conversionMode,
          dpiScale: dpiOption === '300' ? 3.0 : 2.0,
          includeAnnotations: !isCustomFile && includeAnnotations,
          pageAnnotations: !isCustomFile ? pageAnnotations : {},
          includeFormValues: includeValues,
          preserveReadOnlyState,
          documentTitle,
          onProgress: setProgress,
        }
      );

      const blob = new Blob([convertedBytes as any], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const suffix =
        conversionMode === 'interactive'
          ? '_standard_acroform.pdf'
          : conversionMode === 'hybrid'
          ? '_standard_hybrid.pdf'
          : '_standard_flattened.pdf';
      const downloadName = sourceFilename.replace(/\.pdf$/i, '') + suffix;

      setConvertedResult({
        bytes: convertedBytes,
        size: convertedBytes.byteLength,
        downloadUrl,
        downloadName,
        report,
      });

      // Automatically trigger download of the standard PDF
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      onShowToast?.(
        `Converted to Standard PDF: ${downloadName} (${report.retainedFieldsCount} fields & ${report.retainedDataCount} values retained)`
      );
    } catch (err: any) {
      console.error('Standard PDF conversion error:', err);
      onShowToast?.(`Conversion failed: ${err.message}`);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="XFA to Standard PDF Converter"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full flex flex-col shadow-2xl text-slate-100 overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-100">
                  XFA to Standard PDF Converter
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ISO 32000-1 AcroForm &amp; Data Retention
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Strips proprietary LiveCycle XFA streams and converts form fields &amp; values into standard, universally viewable PDF format.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* 1. Input Source Selector: Active XFA Document or Upload Any XFA PDF */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                  Input XFA Document
                </span>
                {isCustomFile && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono">
                    Uploaded File
                  </span>
                )}
              </div>
              <div className="font-semibold text-slate-100 truncate font-mono text-xs">
                {sourceFilename}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                <span>
                  <strong className="text-sky-300">{sourceFields.length}</strong> XFA fields detected
                </span>
                <span>·</span>
                <span>
                  <strong className="text-emerald-300">{filledFieldsCount}</strong> populated values
                </span>
                {calculatedFieldsCount > 0 && (
                  <>
                    <span>·</span>
                    <span>
                      <strong className="text-amber-300">{calculatedFieldsCount}</strong> calculated
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleCustomXfaUpload}
                className="hidden"
              />
              {isCustomFile && (
                <button
                  type="button"
                  onClick={handleUseWorkspaceDocument}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                >
                  Use Active Doc
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsingUpload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-medium text-xs transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>{isParsingUpload ? 'Parsing XFA...' : 'Select Another XFA PDF'}</span>
              </button>
            </div>
          </div>

          {/* 2. Output Mode Selector (Best-Effort Interactivity Retention Options) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider font-mono">
              Select Standard PDF Output Strategy:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setConversionMode('interactive')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  conversionMode === 'interactive'
                    ? 'bg-sky-950/40 border-sky-500 text-sky-100 ring-1 ring-sky-500/30'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs mb-1 text-slate-100">
                    <Monitor className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Standard AcroForm</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Converts XFA fields to editable ISO 32000-1 AcroForm inputs (Text, CheckBox, Dropdown) with values retained.
                  </p>
                </div>
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-300 font-mono border border-sky-800 w-fit">
                  Editable Form Fields
                </span>
              </button>

              <button
                type="button"
                onClick={() => setConversionMode('hybrid')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  conversionMode === 'hybrid'
                    ? 'bg-indigo-950/40 border-indigo-500 text-indigo-100 ring-1 ring-indigo-500/30'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs mb-1 text-slate-100">
                    <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>Hybrid Best-Effort</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Bakes field values into the page canvas AND overlays AcroForm widgets so values appear in every viewer.
                  </p>
                </div>
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono border border-indigo-800 w-fit">
                  Max Data Retention
                </span>
              </button>

              <button
                type="button"
                onClick={() => setConversionMode('flattened')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  conversionMode === 'flattened'
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs mb-1 text-slate-100">
                    <Printer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Flattened Standard</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Permanently bakes all field labels, borders, and filled values into static PDF vector/page streams.
                  </p>
                </div>
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono border border-emerald-800 w-fit">
                  Read-Only Archival
                </span>
              </button>
            </div>
          </div>

          {/* 3. Interactivity & Best-Effort Retention Notice */}
          <div className="bg-amber-950/25 border border-amber-700/40 rounded-xl p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>How XFA Features Are Retained When Interactivity Is Reduced</span>
            </div>
            <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
              <li>
                <strong className="text-slate-100">Form Fields &amp; Current Data:</strong> All{' '}
                <span className="font-mono text-sky-300">{sourceFields.length}</span> fields and{' '}
                <span className="font-mono text-emerald-300">{filledFieldsCount}</span> filled dataset values are mapped to standard PDF coordinates.
              </li>
              <li>
                <strong className="text-slate-100">Dynamic Subforms &amp; Calculations:</strong> LiveCycle FormCalc/JavaScript expressions and dynamic subform reflow are evaluated and pinned to fixed ISO 32000-1 pages so their computed values are preserved.
              </li>
              <li>
                <strong className="text-slate-100">&ldquo;Please wait...&rdquo; Shell Replacement:</strong> If the input XFA PDF only contains a dummy fallback shell page, clean multi-page standard PDF pages are automatically synthesized from the XFA template.
              </li>
            </ul>
          </div>

          {/* 4. Conversion Parameters */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-400 text-[11px]">Page Render Resolution</label>
                <select
                  value={dpiOption}
                  onChange={e => setDpiOption(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="150">150 DPI (Balanced file size &amp; fast conversion)</option>
                  <option value="300">300 DPI (High print &amp; archival resolution)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 text-[11px]">Standard PDF Title Metadata</label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={e => setDocumentTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeValues}
                  onChange={e => setIncludeValues(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
                />
                <span>Retain field data ({filledFieldsCount} filled values)</span>
              </label>

              {conversionMode !== 'flattened' && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={preserveReadOnlyState}
                    onChange={e => setPreserveReadOnlyState(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
                  />
                  <span>Lock XFA read-only fields in output AcroForm</span>
                </label>
              )}

              {!isCustomFile && totalAnnotationsCount > 0 && (
                <label className="flex items-center gap-2 cursor-pointer select-none sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={includeAnnotations}
                    onChange={e => setIncludeAnnotations(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
                  />
                  <span>
                    Bake freehand ink annotations &amp; signatures ({totalAnnotationsCount} strokes)
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* 5. Progress Bar */}
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

          {/* 6. Conversion & Field Retention Report Card */}
          {convertedResult && (
            <div className="bg-emerald-950/25 border border-emerald-500/40 rounded-xl p-4 space-y-3.5 text-xs animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-200 block text-sm">
                      Standard PDF Generated ({convertedResult.report.pagesGenerated}{' '}
                      {convertedResult.report.pagesGenerated === 1 ? 'Page' : 'Pages'})
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {convertedResult.downloadName} · {(convertedResult.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onLoadConvertedPdf && (
                    <button
                      type="button"
                      onClick={() => {
                        onLoadConvertedPdf(convertedResult.bytes, convertedResult.downloadName);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Open the newly converted Standard PDF directly in the workspace viewer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open in Viewer</span>
                    </button>
                  )}

                  <a
                    href={convertedResult.downloadUrl}
                    download={convertedResult.downloadName}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </a>
                </div>
              </div>

              {/* Retention Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-800/40">
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Fields Retained</div>
                  <div className="text-sm font-bold font-mono text-sky-300">
                    {convertedResult.report.retainedFieldsCount}/{convertedResult.report.totalXfaFields}
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Data Values Kept</div>
                  <div className="text-sm font-bold font-mono text-emerald-300">
                    {convertedResult.report.retainedDataCount}
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">XFA Stream</div>
                  <div className="text-sm font-bold font-mono text-amber-300">Stripped</div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Shell Page</div>
                  <div className="text-sm font-bold font-mono text-slate-200">
                    {convertedResult.report.wasDynamicShellReplaced ? 'Synthesized' : 'Native'}
                  </div>
                </div>
              </div>

              {/* Expandable Field-by-Field Mapping Audit */}
              {convertedResult.report.fieldMappings.length > 0 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowFieldMappingTable(prev => !prev)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono text-sky-300 hover:text-sky-200 cursor-pointer"
                  >
                    {showFieldMappingTable ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {showFieldMappingTable ? 'Hide' : 'Inspect'} Field &amp; Interactivity Retention Map (
                      {convertedResult.report.fieldMappings.length} fields)
                    </span>
                  </button>

                  {showFieldMappingTable && (
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/90 divide-y divide-slate-800/70">
                      {convertedResult.report.fieldMappings.map(item => (
                        <div
                          key={item.id}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-semibold text-slate-200 truncate">
                                {item.caption}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                ({item.standardFieldName})
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {item.interactivityNote}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                            {item.retainedValue ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 max-w-[130px] truncate">
                                = &ldquo;{item.retainedValue}&rdquo;
                              </span>
                            ) : (
                              <span className="text-slate-500">Empty</span>
                            )}
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                              {item.standardWidgetType}
                            </span>
                            <span className="text-slate-400">P{item.pageNumber}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3 text-xs shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            onClick={handleStartConversion}
            disabled={isConverting}
            className="px-4 py-2 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isConverting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Converting XFA to Standard PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-950" />
                <span>
                  {conversionMode === 'interactive'
                    ? 'Convert to Standard AcroForm PDF (.pdf)'
                    : conversionMode === 'hybrid'
                    ? 'Convert to Hybrid Standard PDF (.pdf)'
                    : 'Convert to Flattened Standard PDF (.pdf)'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
