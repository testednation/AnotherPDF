import React, { useState, useMemo } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  Download,
  Copy,
  Check,
  Eye,
  Settings2,
  FolderArchive,
  ShieldCheck,
  Sparkles,
  Sliders,
  X,
  File,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import {
  XFAField,
  XFASubform,
  PdfDocumentMetadata,
  ExtractedTextPage,
  ExtractedResourceManifest,
} from '../types/pdf';
import {
  ConversionOptions,
  ConversionParams,
  generateDocx,
  generateXlsx,
  generateCsv,
  generateHtml,
  generateMarkdown,
  generateJson,
  generatePlainText,
  generateAllConvertedBundleZip,
} from '../utils/offlineConverters';
import { downloadResource } from '../utils/resourceExtractor';

interface ConversionViewProps {
  filename: string;
  metadata?: PdfDocumentMetadata | null;
  fields: XFAField[];
  subforms: XFASubform[];
  textPages: ExtractedTextPage[];
  manifest?: ExtractedResourceManifest | null;
  onShowToast?: (msg: string) => void;
}

export const ConversionView: React.FC<ConversionViewProps> = ({
  filename,
  metadata,
  fields,
  subforms,
  textPages,
  manifest,
  onShowToast,
}) => {
  // Conversion configuration
  const [options, setOptions] = useState<ConversionOptions>({
    includeMetadata: true,
    includeEmptyFields: false,
    includePageText: true,
    includeFieldProperties: true,
    theme: 'executive',
    documentTitle: metadata?.title || filename.replace(/\.pdf$/i, '').replace(/_/g, ' '),
    customNotes: 'Certified extracted document record containing verified XFA form fields and extracted page streams.',
  });

  const [activePreviewFormat, setActivePreviewFormat] = useState<'docx' | 'html' | 'markdown' | 'json' | 'txt' | 'csv' | null>(null);
  const [isExportingAllZip, setIsExportingAllZip] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const notify = (msg: string) => {
    if (onShowToast) onShowToast(msg);
  };

  const conversionParams: ConversionParams = useMemo(() => ({
    filename,
    metadata,
    fields,
    subforms,
    textPages,
    manifest,
    options,
  }), [filename, metadata, fields, subforms, textPages, manifest, options]);

  const baseDocName = filename.replace(/\.pdf$/i, '');

  const filledFieldsCount = useMemo(() => {
    return fields.filter(f => f.value && f.value.trim().length > 0).length;
  }, [fields]);

  // Handle Export Word (.docx)
  const handleExportDocx = async () => {
    setExportingFormat('docx');
    try {
      const blob = await generateDocx(conversionParams);
      downloadResource(blob, `${baseDocName}.docx`);
      notify(`Exported Microsoft Word document: ${baseDocName}.docx`);
    } catch (e: any) {
      console.error(e);
      notify(`Word export error: ${e.message}`);
    } finally {
      setExportingFormat(null);
    }
  };

  // Handle Export Excel (.xlsx)
  const handleExportXlsx = async () => {
    setExportingFormat('xlsx');
    try {
      const blob = await generateXlsx(conversionParams);
      downloadResource(blob, `${baseDocName}.xlsx`);
      notify(`Exported Microsoft Excel workbook: ${baseDocName}.xlsx`);
    } catch (e: any) {
      console.error(e);
      notify(`Excel export error: ${e.message}`);
    } finally {
      setExportingFormat(null);
    }
  };

  // Handle Export CSV (.csv)
  const handleExportCsv = () => {
    const csvStr = generateCsv(conversionParams);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8' });
    downloadResource(blob, `${baseDocName}_fields.csv`);
    notify(`Exported Excel-compatible CSV: ${baseDocName}_fields.csv`);
  };

  // Handle Export HTML (.html)
  const handleExportHtml = () => {
    const htmlStr = generateHtml(conversionParams);
    const blob = new Blob([htmlStr], { type: 'text/html;charset=utf-8' });
    downloadResource(blob, `${baseDocName}.html`);
    notify(`Exported standalone HTML document: ${baseDocName}.html`);
  };

  // Handle Export Markdown (.md)
  const handleExportMarkdown = () => {
    const mdStr = generateMarkdown(conversionParams);
    const blob = new Blob([mdStr], { type: 'text/markdown;charset=utf-8' });
    downloadResource(blob, `${baseDocName}.md`);
    notify(`Exported Markdown document: ${baseDocName}.md`);
  };

  // Handle Export JSON (.json)
  const handleExportJson = () => {
    const jsonStr = generateJson(conversionParams);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    downloadResource(blob, `${baseDocName}.json`);
    notify(`Exported structured JSON schema: ${baseDocName}.json`);
  };

  // Handle Export Plain Text (.txt)
  const handleExportTxt = () => {
    const txtStr = generatePlainText(conversionParams);
    const blob = new Blob([txtStr], { type: 'text/plain;charset=utf-8' });
    downloadResource(blob, `${baseDocName}.txt`);
    notify(`Exported plain text document: ${baseDocName}.txt`);
  };

  // Handle Export All Formats Bundle (.zip)
  const handleExportAllZip = async () => {
    setIsExportingAllZip(true);
    try {
      const zipBlob = await generateAllConvertedBundleZip(conversionParams);
      downloadResource(zipBlob, `${baseDocName}_all_offline_conversions.zip`);
      notify(`Exported complete multi-format bundle (Word, Excel, HTML, Markdown, JSON, TXT)`);
    } catch (e: any) {
      console.error(e);
      notify(`ZIP export error: ${e.message}`);
    } finally {
      setIsExportingAllZip(false);
    }
  };

  // Clipboard copy helper
  const copyContent = (text: string, formatKey: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(formatKey);
    notify(`Copied ${label} to clipboard`);
    setTimeout(() => {
      setCopiedFormat(curr => (curr === formatKey ? null : curr));
    }, 2000);
  };

  // Preview content generators
  const htmlPreview = useMemo(() => generateHtml(conversionParams), [conversionParams]);
  const markdownPreview = useMemo(() => generateMarkdown(conversionParams), [conversionParams]);
  const jsonPreview = useMemo(() => generateJson(conversionParams), [conversionParams]);
  const txtPreview = useMemo(() => generatePlainText(conversionParams), [conversionParams]);
  const csvPreview = useMemo(() => generateCsv(conversionParams), [conversionParams]);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Top Hero Banner & Master Export */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-100">
              Offline Document Converter &amp; Exporter
            </h1>
            <span className="text-xs text-sky-400 font-mono bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-sm">
              100% In-Browser Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Convert dynamic XFA PDFs, form values, and text streams to Microsoft Word (.docx), Excel (.xlsx), HTML5, Markdown, and JSON entirely client-side. Zero data leaves your device.
          </p>
        </div>

        <button
          onClick={handleExportAllZip}
          disabled={isExportingAllZip}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 active:bg-sky-500 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <FolderArchive className="w-4 h-4" />
          <span>{isExportingAllZip ? 'Packaging Formats...' : 'Export All Formats in ZIP'}</span>
        </button>
      </div>

      {/* Conversion Settings & Configuration Accordion/Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Sliders className="w-4 h-4 text-sky-400" />
            <span>Document Conversion Options &amp; Theme</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {filledFieldsCount} / {fields.length} fields filled · {textPages.length} pages
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Document Title */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-slate-400 font-medium">Converted Document Title</label>
            <input
              type="text"
              value={options.documentTitle}
              onChange={e => setOptions({ ...options, documentTitle: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
              placeholder="Document title for headers"
            />
          </div>

          {/* Styling Theme */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-medium">Formatting Palette</label>
            <select
              value={options.theme}
              onChange={e => setOptions({ ...options, theme: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value="executive">Executive Sky Blue (#0284c7)</option>
              <option value="slate">Modern Slate Neutral (#334155)</option>
              <option value="classic">Classic Navy Corporate (#1e3a8a)</option>
            </select>
          </div>

          {/* Empty fields inclusion */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-medium">Field Inclusions</label>
            <select
              value={options.includeEmptyFields ? 'all' : 'filled_only'}
              onChange={e => setOptions({ ...options, includeEmptyFields: e.target.value === 'all' })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value="filled_only">Only Filled Form Fields ({filledFieldsCount})</option>
              <option value="all">Include All Form Fields ({fields.length})</option>
            </select>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.includeMetadata}
              onChange={e => setOptions({ ...options, includeMetadata: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
            />
            <span>Include PDF Document Catalog Metadata</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.includePageText}
              onChange={e => setOptions({ ...options, includePageText: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
            />
            <span>Include Extracted Document Page Text</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.includeFieldProperties}
              onChange={e => setOptions({ ...options, includeFieldProperties: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
            />
            <span>Include Technical Field IDs &amp; XML Bindings</span>
          </label>
        </div>
      </div>

      {/* Target Formats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CARD 1: MICROSOFT WORD (.DOCX) */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-sky-950/80 border border-sky-800 text-sky-300">
                OpenXML Native
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                <span>Microsoft Word</span>
                <span className="text-slate-400 font-mono text-xs">(.docx)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Full-featured Word document containing formatted titles, metadata table, styled XFA form entries with alternating rows, and page text.
              </p>
            </div>

            <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
              <div>· Calibri typography &amp; styled headers</div>
              <div>· Standardized table layout &amp; borders</div>
              <div>· Opens in MS Word, Google Docs, Apple Pages</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={() => setActivePreviewFormat('docx')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>Preview</span>
            </button>
            <button
              onClick={handleExportDocx}
              disabled={exportingFormat === 'docx'}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportingFormat === 'docx' ? 'Building...' : 'Export Word'}</span>
            </button>
          </div>
        </div>

        {/* CARD 2: MICROSOFT EXCEL (.XLSX & CSV) */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300">
                Spreadsheet
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                <span>Microsoft Excel</span>
                <span className="text-slate-400 font-mono text-xs">(.xlsx &amp; .csv)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Tabular spreadsheet of all field names, captions, types, values, subform parents, and XML data paths formatted for data analysis.
              </p>
            </div>

            <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
              <div>· Styled headers with auto-width columns</div>
              <div>· Excel-ready UTF-8 CSV with BOM included</div>
              <div>· Ideal for audits &amp; financial form data</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={handleExportCsv}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
              title="Download Excel-compatible UTF-8 CSV"
            >
              <Download className="w-3 h-3 text-emerald-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportXlsx}
              disabled={exportingFormat === 'xlsx'}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportingFormat === 'xlsx' ? 'Building...' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        {/* CARD 3: STANDALONE HTML5 (.HTML) */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <FileCode className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-300">
                Printable Web
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                <span>Standalone HTML5</span>
                <span className="text-slate-400 font-mono text-xs">(.html)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Self-contained, responsive offline web page with embedded styling, printable layout, field badges, and clean typography.
              </p>
            </div>

            <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
              <div>· Zero external CSS/JS dependencies</div>
              <div>· Built-in @media print CSS for printing</div>
              <div>· Ready for offline archiving &amp; web hosting</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={() => setActivePreviewFormat('html')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Preview</span>
            </button>
            <button
              onClick={handleExportHtml}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export HTML</span>
            </button>
          </div>
        </div>

        {/* CARD 4: MARKDOWN (.MD) */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800 text-indigo-300">
                Documentation
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                <span>Markdown</span>
                <span className="text-slate-400 font-mono text-xs">(.md)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                GitHub-flavored Markdown format complete with YAML frontmatter, markdown tables, checkbox states, and section headings.
              </p>
            </div>

            <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
              <div>· Structured tables &amp; YAML metadata</div>
              <div>· Perfect for GitHub, Obsidian &amp; LLMs</div>
              <div>· One-click copy or download</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={() => copyContent(markdownPreview, 'md', 'Markdown')}
              className="px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1"
              title="Copy Markdown text"
            >
              {copiedFormat === 'md' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy</span>
            </button>
            <button
              onClick={() => setActivePreviewFormat('markdown')}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>Preview</span>
            </button>
            <button
              onClick={handleExportMarkdown}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-indigo-400 hover:bg-indigo-300 rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* CARD 5: STRUCTURED JSON (.JSON) */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <FileCode className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300">
                API Schema
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                <span>Structured JSON</span>
                <span className="text-slate-400 font-mono text-xs">(.json)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Developer-ready JSON object with field names, types, subform hierarchy, key-value mappings, and document metadata.
              </p>
            </div>

            <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
              <div>· Direct key-value map + detailed field array</div>
              <div>· Ideal for database ingestion &amp; automated APIs</div>
              <div>· Zero schema dependencies</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={() => copyContent(jsonPreview, 'json', 'JSON')}
              className="px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1"
              title="Copy JSON text"
            >
              {copiedFormat === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy</span>
            </button>
            <button
              onClick={() => setActivePreviewFormat('json')}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>Preview</span>
            </button>
            <button
              onClick={handleExportJson}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* CARD 6: PLAIN TEXT (.TXT) */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-slate-700/30 border border-slate-600 flex items-center justify-center text-slate-300">
                <File className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                Universal Plain
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                <span>Plain Text</span>
                <span className="text-slate-400 font-mono text-xs">(.txt)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Clean, unformatted text stream with structured sections, numbered field list, and page text.
              </p>
            </div>

            <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
              <div>· Formatted UTF-8 plain text</div>
              <div>· Zero formatting baggage</div>
              <div>· Compatible with all text tools &amp; terminals</div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={() => copyContent(txtPreview, 'txt', 'Plain Text')}
              className="px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1"
              title="Copy plain text"
            >
              {copiedFormat === 'txt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy</span>
            </button>
            <button
              onClick={() => setActivePreviewFormat('txt')}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-slate-300" />
              <span>Preview</span>
            </button>
            <button
              onClick={handleExportTxt}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-slate-200 hover:bg-white rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Offline Guarantee Assurance Banner */}
      <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-slate-200">Zero Cloud Processing:</strong> All Word documents (.docx), Excel spreadsheets (.xlsx), and web files are synthesized 100% locally in your browser memory.
          </span>
        </div>
        <span className="hidden sm:inline font-mono text-[11px] text-slate-500">
          OpenXML Engine v2.4 · Offline Certified
        </span>
      </div>

      {/* FORMAT PREVIEW MODAL */}
      {activePreviewFormat && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setActivePreviewFormat(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[88vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 uppercase font-mono">
                    {activePreviewFormat === 'docx' && 'Word Document (.docx) Layout Simulation'}
                    {activePreviewFormat === 'html' && 'Standalone HTML5 Document Preview'}
                    {activePreviewFormat === 'markdown' && 'Markdown (.md) Source Code'}
                    {activePreviewFormat === 'json' && 'Structured JSON Schema Preview'}
                    {activePreviewFormat === 'txt' && 'Plain Text (.txt) Stream'}
                    {activePreviewFormat === 'csv' && 'Excel CSV Table Preview'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Live client-side synthesis · {options.documentTitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActivePreviewFormat(null)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Display */}
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl overflow-auto select-text">
              {activePreviewFormat === 'html' ? (
                <iframe
                  title="HTML Preview"
                  srcDoc={htmlPreview}
                  className="w-full h-full min-h-[50vh] border-0 rounded-xl bg-white"
                />
              ) : activePreviewFormat === 'docx' ? (
                <div className="p-8 max-w-2xl mx-auto bg-white text-slate-900 font-sans shadow-sm my-4 rounded min-h-[50vh] space-y-4">
                  <div className="border-b-2 border-sky-600 pb-3">
                    <h1 className="text-2xl font-bold text-sky-700">{options.documentTitle}</h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Converted from PDF / XFA Archive ({filename}) · {new Date().toLocaleDateString()}
                    </p>
                  </div>
                  {options.customNotes && (
                    <div className="p-3 bg-sky-50 border-l-4 border-sky-600 text-xs italic text-sky-900">
                      {options.customNotes}
                    </div>
                  )}
                  <h2 className="text-base font-bold text-sky-800 pt-2">XFA Form Records &amp; Field Data</h2>
                  <table className="w-full text-xs border border-slate-200">
                    <thead className="bg-sky-600 text-white font-semibold">
                      <tr>
                        <th className="p-2 text-left border">Field Caption</th>
                        <th className="p-2 text-left border">Type</th>
                        <th className="p-2 text-left border">Assigned Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(options.includeEmptyFields ? fields : fields.filter(f => f.value && f.value.trim().length > 0))
                        .slice(0, 15)
                        .map((f, i) => (
                          <tr key={f.id} className={i % 2 === 1 ? 'bg-sky-50/50' : 'bg-white'}>
                            <td className="p-2 border font-medium">{f.caption || f.name}</td>
                            <td className="p-2 border font-mono text-[11px] text-slate-600">{f.type.toUpperCase()}</td>
                            <td className="p-2 border">{f.value || '(empty)'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-slate-400 italic text-center">
                    Simulated Word page view. Full OpenXML .docx file includes complete metadata, all tables, and page text.
                  </p>
                </div>
              ) : (
                <pre className="p-4 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre overflow-auto max-h-[60vh]">
                  {activePreviewFormat === 'markdown' && markdownPreview}
                  {activePreviewFormat === 'json' && jsonPreview}
                  {activePreviewFormat === 'txt' && txtPreview}
                  {activePreviewFormat === 'csv' && csvPreview}
                </pre>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between shrink-0 pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-500 font-mono">
                {activePreviewFormat === 'docx' && 'Format: OpenXML .docx'}
                {activePreviewFormat === 'html' && 'Format: Standalone HTML5'}
                {activePreviewFormat === 'markdown' && 'Format: GitHub Flavored Markdown'}
                {activePreviewFormat === 'json' && 'Format: Application JSON'}
                {activePreviewFormat === 'txt' && 'Format: UTF-8 Plain Text'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (activePreviewFormat === 'html') copyContent(htmlPreview, 'html', 'HTML');
                    if (activePreviewFormat === 'markdown') copyContent(markdownPreview, 'markdown', 'Markdown');
                    if (activePreviewFormat === 'json') copyContent(jsonPreview, 'json', 'JSON');
                    if (activePreviewFormat === 'txt') copyContent(txtPreview, 'txt', 'Plain Text');
                    if (activePreviewFormat === 'csv') copyContent(csvPreview, 'csv', 'CSV');
                  }}
                  className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Content</span>
                </button>

                <button
                  onClick={() => {
                    if (activePreviewFormat === 'docx') handleExportDocx();
                    if (activePreviewFormat === 'html') handleExportHtml();
                    if (activePreviewFormat === 'markdown') handleExportMarkdown();
                    if (activePreviewFormat === 'json') handleExportJson();
                    if (activePreviewFormat === 'txt') handleExportTxt();
                    if (activePreviewFormat === 'csv') handleExportCsv();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download This File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
