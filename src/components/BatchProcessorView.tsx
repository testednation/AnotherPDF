import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  Upload,
  Files,
  FileSpreadsheet,
  FileCode,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  Columns,
  ListFilter,
  Layers,
  Sparkles,
  Info,
  Eye,
  FileText,
  X,
  RefreshCw,
  Table as TableIcon,
  Archive,
  ShieldCheck,
  ShieldAlert,
  Award,
  FileCheck,
  ChevronRight,
  Sliders,
  GitMerge,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  ExternalLink,
  Copy,
  BarChart3,
  KeyRound,
  Lock,
} from 'lucide-react';
import { BatchAnalysisSummary } from './BatchAnalysisSummary';
import {
  BatchFileItem,
  BatchSchemaColumn,
  BatchMergeOptions,
  BatchMergeResult,
  BatchPkcs7Options,
  BatchPkcs7DocumentResult,
  ConsolidatedPreflightReport,
  ConsolidatedViolation,
  processPdfForBatch,
  extractBatchSchema,
  generateBatchCsv,
  generateBatchJson,
  generateBatchXlsx,
  generateBatchZip,
  downloadBatchFile,
  createSampleBatchFiles,
  generateConsolidatedPreflightReport,
  generateConsolidatedPreflightCsv,
  generateConsolidatedPreflightJson,
  generateConsolidatedPreflightTextCertificate,
  generateBatchMergedXdp,
  generateBatchMergedPdf,
  generateMergedAnalyticsCsv,
  generateMergedAnalyticsJson,
  buildPkcs7DictionaryAndXmlPreview,
  injectPkcs7Batch,
  generatePkcs7BatchZip,
} from '../utils/batchProcessor';
import {
  PreflightProfile,
  PreflightSummary,
  PreflightIssue,
  PreflightSeverity,
} from '../types/preflight';
import { generatePreflightTextReport } from '../utils/preflightEngine';

interface BatchProcessorViewProps {
  onLoadSinglePdf?: (bytes: Uint8Array, filename: string) => void;
}

export function BatchProcessorView({ onLoadSinglePdf }: BatchProcessorViewProps) {
  const [items, setItems] = useState<BatchFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'normalized' | 'schema' | 'queue' | 'preflight' | 'merge' | 'analysis' | 'pkcs7'>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<BatchFileItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Preflight Dashboard States
  const [preflightProfile, setPreflightProfile] = useState<PreflightProfile>('comprehensive');
  const [preflightSeverityFilter, setPreflightSeverityFilter] = useState<'all' | 'pass' | 'warning' | 'fail'>('all');
  const [selectedPreflightDoc, setSelectedPreflightDoc] = useState<PreflightSummary | null>(null);
  const [preflightDetailFilter, setPreflightDetailFilter] = useState<'all' | 'error' | 'warning' | 'passed'>('all');

  // Batch Merge Studio States
  const [mergeOptions, setMergeOptions] = useState<BatchMergeOptions>({
    targetFormat: 'pdf_merged',
    packageTitle: 'Consolidated Enterprise XFA Portfolio',
    includeCoverSheet: true,
    includeTableOfContents: true,
    includeDocumentSeparators: true,
    pdfMergeMode: 'interactive_acroform',
    xdpMergeMode: 'master_subform_assembly',
    includeEmptyFields: true,
  });
  const [excludedMergeIds, setExcludedMergeIds] = useState<Set<string>>(new Set());
  const [lastMergeResult, setLastMergeResult] = useState<BatchMergeResult | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  // Batch PKCS#7 Signature Placeholder States
  const [pkcs7Options, setPkcs7Options] = useState<BatchPkcs7Options>({
    fieldName: 'Authorized_PKCS7_Signature_1',
    filter: 'Adobe.PPKLite',
    subFilter: 'adbe.pkcs7.detached',
    placeholderSizeBytes: 8192,
    signerName: 'Enterprise Compliance Signatory',
    reason: 'I attest to the accuracy and regulatory compliance of this XFA form submission',
    location: 'Ottawa, ON, Canada (Enterprise PKI Gateway)',
    contactInfo: 'pki-signing-authority@enterprise.internal',
    targetPageMode: 'last_page',
    boxPosition: 'bottom_right',
    injectXfaTemplateNode: true,
    renderVisualStamp: true,
    lockSigFlags: true,
  });
  const [pkcs7Results, setPkcs7Results] = useState<BatchPkcs7DocumentResult[]>([]);
  const [isInjectingPkcs7, setIsInjectingPkcs7] = useState(false);
  const [pkcs7InspectorTab, setPkcs7InspectorTab] = useState<'pdf_dict' | 'xfa_xml' | 'openssl'>('pdf_dict');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Derive unified schema from current completed items
  const schema = useMemo(() => {
    return extractBatchSchema(items);
  }, [items]);

  // Statistics
  const stats = useMemo(() => {
    const completed = items.filter(i => i.status === 'completed');
    const errors = items.filter(i => i.status === 'error');
    const totalFields = completed.reduce((sum, i) => sum + i.fields.length, 0);
    const avgCompletion = completed.length > 0
      ? Math.round(completed.reduce((sum, i) => sum + i.metadata.completionPercentage, 0) / completed.length)
      : 0;

    return {
      total: items.length,
      completedCount: completed.length,
      errorCount: errors.length,
      totalFields,
      uniqueColumns: schema.length,
      avgCompletion,
    };
  }, [items, schema]);

  // Handle uploaded files
  const handleFilesSelected = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (files.length === 0) {
      showToast('Please select valid .pdf files.');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: files.length });

    const newItems: BatchFileItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingProgress({ current: i + 1, total: files.length });

      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const processed = await processPdfForBatch(bytes, file.name);
        newItems.push(processed);
      } catch (err: any) {
        newItems.push({
          id: 'err_' + Math.random().toString(36).substring(2, 8),
          filename: file.name,
          fileSize: file.size,
          status: 'error',
          errorMessage: err.message || 'Failed to read file buffer',
          fields: [],
          dataMap: {},
          metadata: {
            formTitle: file.name,
            xfaType: 'Standard PDF',
            pageCount: 1,
            subformCount: 0,
            packetCount: 0,
            completionPercentage: 0,
            processedAt: new Date().toISOString(),
          },
        });
      }
    }

    setItems(prev => [...prev, ...newItems]);
    setIsProcessing(false);
    setProcessingProgress(null);
    showToast(`Successfully processed ${files.length} PDF document(s).`);
  }, []);

  // One-click demo batch load
  const handleLoadSampleBatch = async () => {
    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: 3 });

    try {
      const sampleFiles = await createSampleBatchFiles();
      const processedItems: BatchFileItem[] = [];

      for (let i = 0; i < sampleFiles.length; i++) {
        const sf = sampleFiles[i];
        setProcessingProgress({ current: i + 1, total: sampleFiles.length });
        const processed = await processPdfForBatch(sf.bytes, sf.filename);
        processedItems.push(processed);
      }

      setItems(prev => [...prev, ...processedItems]);
      showToast('Loaded 3 sample enterprise XFA submissions!');
    } catch (err: any) {
      console.error('Error generating sample batch:', err);
      showToast('Failed to generate sample batch: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  };

  // Remove individual file
  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Clear all
  const handleClearAll = () => {
    if (items.length > 0 && confirm('Clear all files in the batch queue?')) {
      setItems([]);
      setSelectedItemForDetail(null);
    }
  };

  // Export handlers
  const handleExportCsv = (mode: 'matrix' | 'normalized') => {
    if (items.length === 0) return;
    const csvContent = generateBatchCsv(items, mode, schema);
    const fname = mode === 'matrix' ? 'consolidated_xfa_matrix.csv' : 'consolidated_xfa_normalized.csv';
    downloadBatchFile(csvContent, fname, 'text/csv;charset=utf-8;');
    showToast(`Exported ${fname}`);
  };

  const handleExportJson = (format: 'nested' | 'flat_matrix') => {
    if (items.length === 0) return;
    const jsonStr = generateBatchJson(items, format, schema);
    const fname = format === 'nested' ? 'consolidated_xfa_complete.json' : 'consolidated_xfa_records.json';
    downloadBatchFile(jsonStr, fname, 'application/json');
    showToast(`Exported ${fname}`);
  };

  const handleExportXlsx = async () => {
    if (items.length === 0) return;
    setIsExporting(true);
    try {
      const blob = await generateBatchXlsx(items, schema);
      downloadBatchFile(blob, 'consolidated_xfa_data.xlsx');
      showToast('Exported consolidated Excel workbook (.xlsx)');
    } catch (err: any) {
      showToast('Excel export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportZip = async () => {
    if (items.length === 0) return;
    setIsExporting(true);
    try {
      const blob = await generateBatchZip(items, schema);
      downloadBatchFile(blob, 'xfa_batch_extraction_bundle.zip');
      showToast('Downloaded full batch ZIP bundle');
    } catch (err: any) {
      showToast('ZIP export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Preflight Consolidated Report calculation
  const preflightReport: ConsolidatedPreflightReport = useMemo(() => {
    return generateConsolidatedPreflightReport(items, preflightProfile);
  }, [items, preflightProfile]);

  // Preflight Export Handlers
  const handleExportPreflightCsv = () => {
    if (items.length === 0) return;
    const csvContent = generateConsolidatedPreflightCsv(preflightReport);
    const fname = `consolidated_preflight_audit_${preflightProfile}.csv`;
    downloadBatchFile(csvContent, fname, 'text/csv;charset=utf-8;');
    showToast(`Exported ${fname}`);
  };

  const handleExportPreflightJson = () => {
    if (items.length === 0) return;
    const jsonStr = generateConsolidatedPreflightJson(preflightReport);
    const fname = `consolidated_preflight_audit_${preflightProfile}.json`;
    downloadBatchFile(jsonStr, fname, 'application/json');
    showToast(`Exported ${fname}`);
  };

  const handleExportPreflightCertificate = () => {
    if (items.length === 0) return;
    const textReport = generateConsolidatedPreflightTextCertificate(preflightReport);
    const fname = `preflight_compliance_certificate_${preflightProfile}.txt`;
    downloadBatchFile(textReport, fname, 'text/plain');
    showToast(`Exported ${fname}`);
  };

  // Selected items for Batch Merge (preserving items array order)
  const selectedMergeIds = useMemo(() => {
    return items
      .filter(i => i.status === 'completed' && !excludedMergeIds.has(i.id))
      .map(i => i.id);
  }, [items, excludedMergeIds]);

  // Live XDP Merge Preview
  const liveMergedXdpPreview = useMemo(() => {
    if (items.length === 0) return null;
    return generateBatchMergedXdp(items, {
      ...mergeOptions,
      targetFormat: 'xdp',
      selectedFileIds: selectedMergeIds,
    });
  }, [items, mergeOptions, selectedMergeIds]);

  // Toggle file selection for merge
  const handleToggleMergeFile = (id: string) => {
    setExcludedMergeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Reorder document in batch queue / merge sequence
  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    setItems(prev => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  // Execute Batch Merge (XDP or PDF)
  const handleExecuteBatchMerge = async (
    overrideFormat?: 'xdp' | 'pdf_merged' | 'pdf_xfa_combined',
    openInViewerAfter = false
  ) => {
    if (selectedMergeIds.length === 0) {
      showToast('Select at least one completed document to merge.');
      return;
    }

    const activeFormat = overrideFormat || mergeOptions.targetFormat;
    setIsMerging(true);

    try {
      const effectiveOptions: BatchMergeOptions = {
        ...mergeOptions,
        targetFormat: activeFormat,
        selectedFileIds: selectedMergeIds,
      };

      if (activeFormat === 'xdp') {
        const result = generateBatchMergedXdp(items, effectiveOptions);
        setLastMergeResult(result);
        if (result.xdpContent) {
          downloadBatchFile(result.xdpContent, result.filename, result.mimeType);
          showToast(`Merged ${result.mergedCount} documents into ${result.filename}`);
        }
      } else {
        const result = await generateBatchMergedPdf(items, effectiveOptions);
        setLastMergeResult(result);
        if (result.pdfBytes) {
          if (openInViewerAfter && onLoadSinglePdf) {
            onLoadSinglePdf(result.pdfBytes, result.filename);
            showToast(`Loaded merged PDF (${result.totalPagesGenerated} pages) into Viewer`);
          } else {
            const blob = new Blob([new Uint8Array(result.pdfBytes)], { type: 'application/pdf' });
            downloadBatchFile(blob, result.filename, 'application/pdf');
            showToast(
              `Merged ${result.mergedCount} documents into ${result.filename} (${result.totalPagesGenerated} pages)`
            );
          }
        }
      }
    } catch (err: any) {
      console.error('Batch merge failed:', err);
      showToast('Batch merge error: ' + (err.message || 'Unknown error'));
    } finally {
      setIsMerging(false);
    }
  };

  // Aggregate field data from all merged XFA PDFs into a single CSV or JSON export file for external analytics
  const handleExportMergedAnalytics = (format: 'csv' | 'json') => {
    const completedCount = items.filter(i => i.status === 'completed').length;
    if (completedCount === 0) {
      showToast('Upload and process at least one XFA PDF document to export merged analytics.');
      return;
    }

    const effectiveOptions: Partial<BatchMergeOptions> = {
      ...mergeOptions,
      selectedFileIds: selectedMergeIds,
    };

    if (format === 'csv') {
      const result = generateMergedAnalyticsCsv(items, effectiveOptions, schema);
      downloadBatchFile(result.content, result.filename, 'text/csv;charset=utf-8;');
      showToast(
        `Exported aggregated CSV (${result.mergedCount} merged PDFs, ${result.fieldCount} fields) → ${result.filename}`
      );
    } else {
      const result = generateMergedAnalyticsJson(items, effectiveOptions, schema);
      downloadBatchFile(result.content, result.filename, 'application/json');
      showToast(
        `Exported aggregated JSON (${result.mergedCount} merged PDFs, ${result.fieldCount} fields) → ${result.filename}`
      );
    }
  };

  // Live PKCS#7 PDF Dictionary & XFA <signature> XML Preview
  const pkcs7Preview = useMemo(() => {
    return buildPkcs7DictionaryAndXmlPreview(pkcs7Options);
  }, [pkcs7Options]);

  // Execute Batch PKCS#7 Signature Placeholder Injection across selected XFA PDFs
  const handleExecuteBatchPkcs7 = async (downloadZipAfter = false) => {
    if (selectedMergeIds.length === 0) {
      showToast('Select at least one completed XFA PDF document to inject PKCS#7 placeholders.');
      return;
    }

    setIsInjectingPkcs7(true);
    try {
      const effectiveOptions: BatchPkcs7Options = {
        ...pkcs7Options,
        selectedFileIds: selectedMergeIds,
      };

      const { updatedItems, results } = await injectPkcs7Batch(items, effectiveOptions);
      setItems(updatedItems);
      setPkcs7Results(results);

      if (downloadZipAfter && results.length > 0) {
        const { zipBlob, zipFilename } = await generatePkcs7BatchZip(results, effectiveOptions);
        downloadBatchFile(zipBlob, zipFilename, 'application/zip');
        showToast(
          `Injected PKCS#7 (/Type /Sig) placeholders into ${results.length} PDFs and downloaded ${zipFilename}`
        );
      } else {
        showToast(
          `Injected PKCS#7 (${pkcs7Options.subFilter}, ${pkcs7Options.placeholderSizeBytes}B) into ${results.length} XFA PDF(s)!`
        );
      }
    } catch (err: any) {
      console.error('Batch PKCS#7 injection error:', err);
      showToast('PKCS#7 injection failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsInjectingPkcs7(false);
    }
  };

  // Filtered rows for Matrix view
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item => {
      if (item.filename.toLowerCase().includes(q)) return true;
      if (item.metadata.formTitle.toLowerCase().includes(q)) return true;
      if (item.metadata.xfaType.toLowerCase().includes(q)) return true;
      return Object.values(item.dataMap).some(val => val.toLowerCase().includes(q));
    });
  }, [items, searchQuery]);

  // Filtered Preflight Documents for Audit view
  const filteredPreflightDocuments = useMemo(() => {
    return preflightReport.documentSummaries.filter(doc => {
      if (preflightSeverityFilter === 'pass' && doc.overallStatus !== 'pass') return false;
      if (preflightSeverityFilter === 'warning' && doc.overallStatus !== 'warning') return false;
      if (preflightSeverityFilter === 'fail' && doc.overallStatus !== 'fail') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = doc.documentName.toLowerCase().includes(q);
        const matchesIssues = doc.issues.some(
          i => i.ruleId.toLowerCase().includes(q) || i.message.toLowerCase().includes(q) || i.ruleName.toLowerCase().includes(q)
        );
        return matchesName || matchesIssues;
      }

      return true;
    });
  }, [preflightReport, preflightSeverityFilter, searchQuery]);

  // Normalized rows flat list
  const normalizedRows = useMemo(() => {
    const list: {
      fileId: string;
      filename: string;
      formTitle: string;
      field: BatchFileItem['fields'][0];
    }[] = [];

    for (const item of items) {
      if (item.status !== 'completed') continue;
      for (const f of item.fields) {
        list.push({
          fileId: item.id,
          filename: item.filename,
          formTitle: item.metadata.formTitle,
          field: f,
        });
      }
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(r =>
      r.filename.toLowerCase().includes(q) ||
      r.field.name.toLowerCase().includes(q) ||
      r.field.caption.toLowerCase().includes(q) ||
      r.field.value.toLowerCase().includes(q) ||
      (r.field.subform && r.field.subform.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-sky-600 text-white px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium flex items-center gap-2 border border-sky-400/40 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Batch XFA Field Extractor &amp; Consolidator
                <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full font-mono">
                  100% Offline
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Upload multiple dynamic or static XFA forms to automatically discover schemas, merge records, and export unified CSV, JSON, or Excel files.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept=".pdf"
            className="hidden"
            onChange={e => {
              if (e.target.files) handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload PDFs</span>
          </button>

          <button
            onClick={handleLoadSampleBatch}
            disabled={isProcessing}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-sky-300 text-slate-200 border border-slate-700 text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Load 3 sample enterprise XFA submissions to test extraction"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Load Sample Batch</span>
          </button>

          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={isProcessing}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 border border-slate-700/80 text-xs font-medium rounded-md transition-colors cursor-pointer"
              title="Clear all documents"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar during Batch Ingestion */}
      {processingProgress && (
        <div className="bg-sky-950/60 border-b border-sky-800/60 px-6 py-2 flex items-center justify-between text-xs text-sky-200">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
            <span>
              Extracting packet stream ({processingProgress.current} of {processingProgress.total} documents)...
            </span>
          </div>
          <div className="w-48 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
            <div
              className="bg-sky-400 h-full transition-all duration-300"
              style={{
                width: `${(processingProgress.current / processingProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Statistics Banner */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Batch Documents</div>
          <div className="text-xl font-bold text-slate-100 mt-0.5 flex items-center gap-2">
            {stats.total}
            {stats.completedCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-mono font-normal">
                {stats.completedCount} ready
              </span>
            )}
            {stats.errorCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-rose-500/20 text-rose-400 rounded font-mono font-normal">
                {stats.errorCount} errors
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Unified Schema Columns</div>
          <div className="text-xl font-bold text-sky-400 mt-0.5 flex items-center gap-1.5">
            <Columns className="w-4 h-4 text-sky-500" />
            {stats.uniqueColumns}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Total Values Extracted</div>
          <div className="text-xl font-bold text-emerald-400 mt-0.5">
            {stats.totalFields.toLocaleString()}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Avg Completion Rate</div>
          <div className="text-xl font-bold text-indigo-400 mt-0.5">
            {stats.avgCompletion}%
          </div>
        </div>
      </div>

      {/* Action Strip: Export Bar & Sub-Tabs */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs flex-wrap">
          <button
            onClick={() => setActiveSubTab('matrix')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'matrix'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Consolidated Matrix</span>
          </button>

          <button
            onClick={() => setActiveSubTab('normalized')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'normalized'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Normalized Records ({normalizedRows.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('schema')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'schema'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Schema Dictionary ({schema.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('queue')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'queue'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Files className="w-3.5 h-3.5" />
            <span>Files Queue ({items.length})</span>
          </button>

          {/* Consolidated Preflight Audit Sub-Tab */}
          <button
            onClick={() => setActiveSubTab('preflight')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'preflight'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Consolidated Preflight Compliance Audit across all batch documents"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Preflight Audit</span>
            {items.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono border ${
                  preflightReport.failedDocuments > 0
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : preflightReport.warningDocuments > 0
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {preflightReport.fleetComplianceRate}%
              </span>
            )}
          </button>

          {/* Batch Merge Sub-Tab */}
          <button
            onClick={() => setActiveSubTab('merge')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'merge'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Merge multiple XFA PDFs into a single consolidated XDP package or multi-page PDF document"
          >
            <GitMerge className="w-3.5 h-3.5 text-purple-300" />
            <span>Batch Merge ({selectedMergeIds.length})</span>
          </button>

          {/* Batch Analysis Sub-Tab */}
          <button
            onClick={() => setActiveSubTab('analysis')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'analysis'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Comparative Recharts visual analytics of field completion rates across all merged documents"
          >
            <BarChart3 className="w-3.5 h-3.5 text-sky-300" />
            <span>Batch Analysis</span>
            {items.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-sky-500/20 text-sky-300 border border-sky-500/40">
                {stats.avgCompletion}%
              </span>
            )}
          </button>

          {/* Batch PKCS#7 Signature Placeholder Sub-Tab */}
          <button
            onClick={() => setActiveSubTab('pkcs7')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'pkcs7'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Inject standard ISO 32000-1 PKCS#7 (/Type /Sig) signature placeholders into multiple XFA PDFs at once"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-300" />
            <span>Batch PKCS#7 Sign</span>
            {pkcs7Results.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {pkcs7Results.length} Ready
              </span>
            )}
          </button>
        </div>

        {/* Export Dropdown / Contextual Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeSubTab === 'preflight'
                  ? 'Filter documents or rules...'
                  : 'Search extracted data...'
              }
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-44 sm:w-56"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {activeSubTab === 'pkcs7' ? (
            /* Batch PKCS#7 Contextual Action Buttons */
            <>
              <button
                onClick={() => handleExecuteBatchPkcs7(false)}
                disabled={selectedMergeIds.length === 0 || isInjectingPkcs7}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Inject PKCS#7 signature placeholders into all selected XFA PDFs in queue"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Inject PKCS#7 Placeholders ({selectedMergeIds.length})</span>
              </button>

              <button
                onClick={() => handleExecuteBatchPkcs7(true)}
                disabled={selectedMergeIds.length === 0 || isInjectingPkcs7}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Inject PKCS#7 placeholders and download all prepared PDFs + signing manifest as a ZIP bundle"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Inject &amp; Download PKCS#7 ZIP</span>
              </button>
            </>
          ) : activeSubTab === 'merge' || activeSubTab === 'analysis' ? (
            /* Batch Merge & Batch Analysis Contextual Action Buttons */
            <>
              <button
                onClick={() => handleExportMergedAnalytics('csv')}
                disabled={selectedMergeIds.length === 0 || isMerging}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Aggregate field data from all merged XFA PDFs into a single CSV file for external analytics"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Merged Analytics CSV</span>
              </button>

              <button
                onClick={() => handleExportMergedAnalytics('json')}
                disabled={selectedMergeIds.length === 0 || isMerging}
                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Aggregate field data from all merged XFA PDFs into a single JSON file for external analytics"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Merged Analytics JSON</span>
              </button>

              <button
                onClick={() => handleExecuteBatchMerge('xdp')}
                disabled={selectedMergeIds.length === 0 || isMerging}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Merge selected files into a single Adobe XML Data Package (.xdp)"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Merge to XDP (.xdp)</span>
              </button>

              <button
                onClick={() => handleExecuteBatchMerge('pdf_merged')}
                disabled={selectedMergeIds.length === 0 || isMerging}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Merge selected files into a single multi-page PDF document (.pdf)"
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Merge to PDF (.pdf)</span>
              </button>

              {onLoadSinglePdf && (
                <button
                  onClick={() => handleExecuteBatchMerge('pdf_xfa_combined', true)}
                  disabled={selectedMergeIds.length === 0 || isMerging}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 disabled:opacity-40 text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Generate merged Hybrid PDF + XFA and open directly in the PDF Viewer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Merge &amp; Open in Viewer</span>
                </button>
              )}
            </>
          ) : activeSubTab === 'preflight' ? (
            /* Preflight Audit Contextual Export Buttons */
            <>
              <button
                onClick={handleExportPreflightCsv}
                disabled={items.length === 0 || isExporting}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download Consolidated Preflight Audit CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Audit CSV</span>
              </button>

              <button
                onClick={handleExportPreflightJson}
                disabled={items.length === 0 || isExporting}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download Consolidated Preflight JSON report"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Audit JSON</span>
              </button>

              <button
                onClick={handleExportPreflightCertificate}
                disabled={items.length === 0 || isExporting}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 disabled:opacity-40 text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download Executive Compliance Certificate (.txt)"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Certificate (TXT)</span>
              </button>
            </>
          ) : (
            /* Data Extraction Export Buttons */
            <>
              {/* Consolidated CSV (Matrix) */}
              <button
                onClick={() => handleExportCsv('matrix')}
                disabled={items.length === 0 || isExporting}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download Consolidated Wide Matrix CSV (UTF-8 BOM Excel ready)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Matrix CSV</span>
              </button>

              {/* Consolidated CSV (Normalized) */}
              <button
                onClick={() => handleExportCsv('normalized')}
                disabled={items.length === 0 || isExporting}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 disabled:opacity-40 text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download Normalized Long CSV (1 row per field)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Long CSV</span>
              </button>

              {/* Consolidated JSON */}
              <button
                onClick={() => handleExportJson('flat_matrix')}
                disabled={items.length === 0 || isExporting}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Export Consolidated JSON array"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>

              {/* Consolidated Excel (.xlsx) */}
              <button
                onClick={handleExportXlsx}
                disabled={items.length === 0 || isExporting}
                className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Generate multi-sheet Microsoft Excel (.xlsx) workbook directly in browser"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>

              {/* Complete ZIP Archive */}
              <button
                onClick={handleExportZip}
                disabled={items.length === 0 || isExporting}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 disabled:opacity-40 text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download full batch ZIP archive with all tables and individual JSON extractions"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>ZIP Bundle</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {items.length === 0 ? (
          /* Empty State / Dropzone */
          <div
            onDragOver={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={e => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files) {
                handleFilesSelected(e.dataTransfer.files);
              }
            }}
            className="h-full min-h-[380px] border-2 border-dashed border-slate-800 hover:border-sky-500/60 rounded-xl flex flex-col items-center justify-center p-8 text-center transition-colors bg-slate-900/30"
          >
            <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4 shadow-lg shadow-sky-950/40">
              <Layers className="w-8 h-8" />
            </div>

            <h3 className="text-base font-semibold text-slate-100 mb-1">
              Upload Multiple XFA PDF Documents
            </h3>
            <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
              Drag and drop any number of PDF files here, or use the file picker. All XFA template packets, subforms, and datasets XML will be extracted and consolidated client-side without uploading to any server.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-md flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Select PDF Files</span>
              </button>

              <button
                onClick={handleLoadSampleBatch}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Load Sample Batch (3 Forms)</span>
              </button>
            </div>

            <div className="mt-8 flex items-center gap-6 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dynamic &amp; Static XFA Support</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>AcroForm Fallback</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Consolidated CSV &amp; JSON</span>
              </div>
            </div>
          </div>
        ) : (
          /* Populated Tabs */
          <div className="h-full flex flex-col">
            {/* Sub-Tab 1: Consolidated Matrix View */}
            {activeSubTab === 'matrix' && (
              <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-xl">
                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="font-semibold text-slate-200">Consolidated Wide Matrix</span>
                    <span>•</span>
                    <span>{filteredItems.length} rows (PDFs)</span>
                    <span>•</span>
                    <span>{schema.length} dynamic field columns</span>
                  </div>
                  <div className="text-[11px] text-slate-500 italic">
                    Scroll horizontally to inspect all unified columns
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-950/90 text-slate-400 sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold sticky left-0 z-20 bg-slate-950 border-r border-slate-800 min-w-[200px]">
                          Document Name
                        </th>
                        <th className="py-2.5 px-3 font-semibold min-w-[140px]">Form Title</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[110px]">XFA Type</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[80px]">Fields</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[90px]">Completion</th>
                        {schema.map(col => (
                          <th
                            key={col.key}
                            className="py-2.5 px-3 font-semibold min-w-[160px] max-w-[220px] truncate border-l border-slate-850"
                            title={`${col.label} (${col.key}) - ${col.type}`}
                          >
                            <div className="truncate">{col.label}</div>
                            <div className="text-[10px] text-slate-500 font-mono truncate">{col.key}</div>
                          </th>
                        ))}
                        <th className="py-2.5 px-3 font-semibold text-right min-w-[80px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredItems.map(item => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-800/40 transition-colors group"
                        >
                          <td className="py-2.5 px-3 font-medium text-slate-200 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-850 border-r border-slate-800">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span className="truncate" title={item.filename}>{item.filename}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 truncate max-w-[180px]" title={item.metadata.formTitle}>
                            {item.metadata.formTitle}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                                item.metadata.xfaType === 'Dynamic XFA'
                                  ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                                  : item.metadata.xfaType === 'Static XFA'
                                  ? 'bg-sky-950/60 text-sky-300 border-sky-800/60'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {item.metadata.xfaType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {item.fields.length}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-emerald-400 h-full"
                                  style={{ width: `${item.metadata.completionPercentage}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {item.metadata.completionPercentage}%
                              </span>
                            </div>
                          </td>

                          {/* Dynamic Schema Columns */}
                          {schema.map(col => {
                            const val = item.dataMap[col.key] ??
                              item.fields.find(f => f.name === col.key || f.caption === col.label)?.value;

                            return (
                              <td
                                key={col.key}
                                className="py-2.5 px-3 text-slate-300 border-l border-slate-800/60 truncate max-w-[220px]"
                                title={val || ''}
                              >
                                {val ? (
                                  <span className="truncate">{val}</span>
                                ) : (
                                  <span className="text-slate-600 italic">--</span>
                                )}
                              </td>
                            );
                          })}

                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => setSelectedItemForDetail(item)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Inspect Form Packet & Field Details"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Normalized Long Records View */}
            {activeSubTab === 'normalized' && (
              <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-xl">
                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div>
                    <span className="font-semibold text-slate-200">Normalized Field Records</span>
                    <span> — {normalizedRows.length} total field values across all files</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Standard 1-row-per-field database layout
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-950/90 text-slate-400 sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Document</th>
                        <th className="py-2.5 px-3 font-semibold">Field ID / Key</th>
                        <th className="py-2.5 px-3 font-semibold">Field Caption / Label</th>
                        <th className="py-2.5 px-3 font-semibold">Type</th>
                        <th className="py-2.5 px-3 font-semibold">Value</th>
                        <th className="py-2.5 px-3 font-semibold">Subform / Container</th>
                        <th className="py-2.5 px-3 font-semibold">Required</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {normalizedRows.map((row, idx) => (
                        <tr key={`${row.fileId}_${row.field.id}_${idx}`} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 text-slate-300 font-medium truncate max-w-[160px]">
                            {row.filename}
                          </td>
                          <td className="py-2 px-3 font-mono text-sky-400 truncate max-w-[140px]">
                            {row.field.name || row.field.id}
                          </td>
                          <td className="py-2 px-3 text-slate-200 font-medium">
                            {row.field.caption}
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono">
                              {row.field.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-emerald-300 font-medium">
                            {row.field.value || <span className="text-slate-600 italic">(empty)</span>}
                          </td>
                          <td className="py-2 px-3 text-slate-400 truncate max-w-[140px]">
                            {row.field.subform || 'Root'}
                          </td>
                          <td className="py-2 px-3">
                            {row.field.required ? (
                              <span className="text-[10px] px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded">Yes</span>
                            ) : (
                              <span className="text-slate-500">No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Schema Dictionary */}
            {activeSubTab === 'schema' && (
              <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-xl">
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-100">
                    Unified Batch Schema Dictionary ({schema.length} fields discovered)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Every unique field encountered across all uploaded XFA templates, showing presence frequency and sample values.
                  </p>
                </div>

                <div className="flex-1 overflow-auto p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {schema.map(col => (
                      <div
                        key={col.key}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col justify-between hover:border-slate-700 transition-colors"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-slate-200">
                              {col.label}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-sky-950/80 text-sky-300 border border-sky-800/80 rounded font-mono">
                              {col.type}
                            </span>
                          </div>

                          <div className="text-[11px] font-mono text-slate-400 mb-2 truncate" title={col.key}>
                            Key: {col.key}
                          </div>

                          {col.subform && (
                            <div className="text-[11px] text-slate-500 mb-2">
                              Subform: <span className="text-slate-300">{col.subform}</span>
                            </div>
                          )}

                          {col.sampleValues.length > 0 && (
                            <div className="mt-2">
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-medium">Sample Values</div>
                              <div className="flex flex-wrap gap-1">
                                {col.sampleValues.slice(0, 3).map((sv, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[11px] px-2 py-0.5 bg-slate-800/90 text-emerald-300 rounded font-mono truncate max-w-[200px]"
                                    title={sv}
                                  >
                                    {sv}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Appears in:</span>
                          <span className="font-semibold text-sky-400">
                            {col.occurrences} of {items.length} file(s)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 4: Document Queue */}
            {activeSubTab === 'queue' && (
              <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-xl">
                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">Queued Documents ({items.length})</span>
                  <span>Manage files or inspect individual XML packets</span>
                </div>

                <div className="flex-1 overflow-auto divide-y divide-slate-800/60">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-850/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded-lg text-sky-400">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                            <span>{item.filename}</span>
                            <span className="text-[10px] text-slate-400">
                              ({Math.round(item.fileSize / 1024)} KB)
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>Title: <strong className="text-slate-300">{item.metadata.formTitle}</strong></span>
                            <span>•</span>
                            <span>{item.metadata.xfaType}</span>
                            <span>•</span>
                            <span>{item.fields.length} fields</span>
                            <span>•</span>
                            <span className="text-emerald-400">{item.metadata.completionPercentage}% filled</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.status === 'completed' ? (
                          <span className="text-[11px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Completed
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {item.errorMessage || 'Error'}
                          </span>
                        )}

                        <button
                          onClick={() => setSelectedItemForDetail(item)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs rounded transition-colors cursor-pointer"
                        >
                          Inspect
                        </button>

                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Tab 5: Consolidated Preflight Audit Dashboard */}
            {activeSubTab === 'preflight' && (
              <div className="flex-1 flex flex-col space-y-4 overflow-auto">
                {/* Executive Scorecard Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 shrink-0">
                  {/* Fleet Compliance Rate */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Fleet Compliance Rate
                      </span>
                      <Award className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span
                        className={`text-3xl font-bold font-mono ${
                          preflightReport.fleetComplianceRate >= 90
                            ? 'text-emerald-400'
                            : preflightReport.fleetComplianceRate >= 75
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {preflightReport.fleetComplianceRate}%
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        ({preflightReport.totalPassedRules}/{preflightReport.totalRulesEvaluated})
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          preflightReport.fleetComplianceRate >= 90
                            ? 'bg-emerald-400'
                            : preflightReport.fleetComplianceRate >= 75
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                        style={{ width: `${preflightReport.fleetComplianceRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Clean Pass Count */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Clean Pass Documents
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-emerald-400 font-mono">
                        {preflightReport.passedDocuments}
                      </span>
                      <span className="text-xs text-slate-400">
                        of {preflightReport.totalDocuments} total
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-400/80 font-medium mt-1">
                      {preflightReport.documentComplianceRate}% fleet clean pass
                    </div>
                  </div>

                  {/* Warnings Count */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Advisories &amp; Warnings
                      </span>
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-amber-400 font-mono">
                        {preflightReport.warningDocuments}
                      </span>
                      <span className="text-xs text-slate-400">
                        files ({preflightReport.totalWarnings} notices)
                      </span>
                    </div>
                    <div className="text-[11px] text-amber-400/80 font-medium mt-1">
                      Minor metadata or font advisories
                    </div>
                  </div>

                  {/* Critical Failures */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Critical Failures
                      </span>
                      <XCircle className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-rose-400 font-mono">
                        {preflightReport.failedDocuments}
                      </span>
                      <span className="text-xs text-slate-400">
                        files ({preflightReport.totalErrors} errors)
                      </span>
                    </div>
                    <div className="text-[11px] text-rose-400/80 font-medium mt-1">
                      Requires immediate form remediation
                    </div>
                  </div>

                  {/* Audit Profile & Evaluations */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Active Profile
                      </span>
                      <ShieldCheck className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="mt-2">
                      <div className="text-sm font-bold text-sky-300 truncate capitalize">
                        {preflightProfile.replace('-', ' ')}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {preflightReport.totalRulesEvaluated} rule assertions evaluated
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                      ISO 32000 / XFA Engine
                    </div>
                  </div>
                </div>

                {/* Profile Selector Toolbar */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-md shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-sky-400" />
                      <span>Audit Profile:</span>
                    </span>

                    <div className="flex items-center gap-1 flex-wrap">
                      {(
                        [
                          { id: 'comprehensive', label: 'Comprehensive (All Rules)' },
                          { id: 'xfa-compliance', label: 'XFA & Form Architecture' },
                          { id: 'pdfa-archival', label: 'PDF/A Archival (ISO 19005)' },
                          { id: 'print-quality', label: 'Print Production' },
                          { id: 'accessibility', label: 'Section 508 Accessibility' },
                        ] as { id: PreflightProfile; label: string }[]
                      ).map(p => (
                        <button
                          key={p.id}
                          onClick={() => setPreflightProfile(p.id)}
                          className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                            preflightProfile === p.id
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Severity Filter Pills */}
                  <div className="flex items-center gap-1.5 self-start lg:self-auto">
                    <span className="text-xs text-slate-400 font-medium">Filter Status:</span>
                    <button
                      onClick={() => setPreflightSeverityFilter('all')}
                      className={`px-2 py-0.5 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                        preflightSeverityFilter === 'all'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All ({preflightReport.totalDocuments})
                    </button>
                    <button
                      onClick={() => setPreflightSeverityFilter('pass')}
                      className={`px-2 py-0.5 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                        preflightSeverityFilter === 'pass'
                          ? 'bg-emerald-600 text-white'
                          : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      Pass ({preflightReport.passedDocuments})
                    </button>
                    <button
                      onClick={() => setPreflightSeverityFilter('warning')}
                      className={`px-2 py-0.5 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                        preflightSeverityFilter === 'warning'
                          ? 'bg-amber-600 text-white'
                          : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      Warnings ({preflightReport.warningDocuments})
                    </button>
                    <button
                      onClick={() => setPreflightSeverityFilter('fail')}
                      className={`px-2 py-0.5 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                        preflightSeverityFilter === 'fail'
                          ? 'bg-rose-600 text-white'
                          : 'text-rose-400 hover:text-rose-300'
                      }`}
                    >
                      Failing ({preflightReport.failedDocuments})
                    </button>
                  </div>
                </div>

                {/* Top Portfolio Risk Factors / Violations Panel */}
                {preflightReport.topViolations.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>Primary Non-Compliance Risk Factors in Fleet</span>
                          <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-mono">
                            {preflightReport.topViolations.length} detected
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Aggregated rule violations ranked by frequency and document blast radius across the uploaded portfolio.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {preflightReport.topViolations.slice(0, 6).map((v, idx) => (
                        <div
                          key={`${v.ruleId}_${idx}`}
                          className="bg-slate-950 border border-slate-800/90 hover:border-slate-700 rounded-lg p-3 flex flex-col justify-between transition-colors"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase ${
                                  v.severity === 'error'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                {v.severity}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Rule {v.ruleId}
                              </span>
                            </div>

                            <div className="text-xs font-semibold text-slate-200 mb-1">
                              {v.ruleName}
                            </div>

                            <div className="text-[11px] text-slate-400 mb-2 line-clamp-2">
                              {v.sampleDetail}
                            </div>

                            {v.suggestedFix && (
                              <div className="text-[11px] text-sky-400 bg-sky-950/40 border border-sky-800/40 rounded px-2 py-1 mb-2">
                                <strong>Fix:</strong> {v.suggestedFix}
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Occurrences:</span>
                            <span className="font-semibold text-amber-300 font-mono">
                              {v.count} hit(s) in {v.affectedDocuments.length} doc(s)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Consolidated Documents Compliance Table */}
                <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl min-h-[360px]">
                  <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-sky-400" />
                      <span className="font-semibold text-slate-200">
                        Document Compliance Register
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400">
                        {filteredPreflightDocuments.length} of {preflightReport.totalDocuments} document(s) shown
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono">
                      Target Profile: {preflightProfile.toUpperCase()}
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-950/90 text-slate-400 sticky top-0 z-10 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold min-w-[200px]">Document Name</th>
                          <th className="py-2.5 px-3 font-semibold min-w-[120px]">Overall Status</th>
                          <th className="py-2.5 px-3 font-semibold min-w-[140px]">Compliance Score</th>
                          <th className="py-2.5 px-3 font-semibold min-w-[80px]">Errors</th>
                          <th className="py-2.5 px-3 font-semibold min-w-[80px]">Warnings</th>
                          <th className="py-2.5 px-3 font-semibold min-w-[80px]">Passed</th>
                          <th className="py-2.5 px-3 font-semibold min-w-[240px]">Primary Findings</th>
                          <th className="py-2.5 px-3 font-semibold text-right min-w-[100px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredPreflightDocuments.map(doc => {
                          const docScore = doc.totalChecks > 0
                            ? Math.round((doc.passedCount / doc.totalChecks) * 100)
                            : 100;

                          const matchingItem = items.find(i => i.filename === doc.documentName);

                          return (
                            <tr
                              key={doc.documentName}
                              className="hover:bg-slate-850/50 transition-colors group"
                            >
                              <td className="py-2.5 px-3 font-medium text-slate-200">
                                <div className="flex items-center gap-2 truncate">
                                  <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                  <div className="truncate">
                                    <div className="truncate font-semibold" title={doc.documentName}>
                                      {doc.documentName}
                                    </div>
                                    {matchingItem && (
                                      <div className="text-[10px] text-slate-500 truncate">
                                        {matchingItem.metadata.formTitle} • {matchingItem.metadata.xfaType}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-2.5 px-3">
                                {doc.overallStatus === 'pass' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    <CheckCircle2 className="w-3 h-3" />
                                    PASS
                                  </span>
                                )}
                                {doc.overallStatus === 'warning' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    <AlertTriangle className="w-3 h-3" />
                                    WARNING
                                  </span>
                                )}
                                {doc.overallStatus === 'fail' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    <XCircle className="w-3 h-3" />
                                    FAIL
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 bg-slate-800 rounded-full h-2 overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-300 ${
                                        docScore >= 90
                                          ? 'bg-emerald-400'
                                          : docScore >= 75
                                          ? 'bg-amber-400'
                                          : 'bg-rose-400'
                                      }`}
                                      style={{ width: `${docScore}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-mono font-bold text-slate-200">
                                    {docScore}%
                                  </span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 font-mono">
                                {doc.errorsCount > 0 ? (
                                  <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded font-bold">
                                    {doc.errorsCount}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">0</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 font-mono">
                                {doc.warningsCount > 0 ? (
                                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-bold">
                                    {doc.warningsCount}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">0</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 font-mono text-emerald-400">
                                {doc.passedCount}
                              </td>

                              <td className="py-2.5 px-3 max-w-[280px]">
                                <div className="flex flex-wrap gap-1">
                                  {doc.issues
                                    .filter(i => i.severity === 'error' || i.severity === 'warning')
                                    .slice(0, 2)
                                    .map(i => (
                                      <span
                                        key={i.id}
                                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono truncate max-w-[240px] border ${
                                          i.severity === 'error'
                                            ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                                            : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                                        }`}
                                        title={`${i.ruleId}: ${i.message}`}
                                      >
                                        [{i.ruleId}] {i.message}
                                      </span>
                                    ))}
                                  {doc.issues.filter(i => i.severity === 'error' || i.severity === 'warning').length === 0 && (
                                    <span className="text-[11px] text-emerald-400 font-medium">
                                      Zero non-compliance violations
                                    </span>
                                  )}
                                  {doc.issues.filter(i => i.severity === 'error' || i.severity === 'warning').length > 2 && (
                                    <span className="text-[10px] text-slate-500 self-center">
                                      +{doc.issues.filter(i => i.severity === 'error' || i.severity === 'warning').length - 2} more
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => setSelectedPreflightDoc(doc)}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs rounded transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
                                  title="Inspect full audit checklist for this document"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Findings</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 6: Batch Merge Studio (Single XDP Package or Merged PDF Document) */}
            {activeSubTab === 'merge' && (
              <div className="flex-1 flex flex-col space-y-4 overflow-auto">
                {/* Top Summary Banner & Quick Execute Bar */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg shrink-0">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400 shrink-0">
                      <GitMerge className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-100">
                          Batch XFA Document &amp; XDP Package Merger
                        </h2>
                        <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full font-mono">
                          {selectedMergeIds.length} of {items.filter(i => i.status === 'completed').length} Selected
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                        Combine multiple uploaded XFA PDF forms into a single consolidated Adobe XML Data Package (<code className="text-purple-300">.xdp</code>) or a unified multi-page PDF document (<code className="text-sky-300">.pdf</code>) with an executive cover sheet, table of contents, and interactive AcroForm or hybrid XFA streams.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleExecuteBatchMerge(mergeOptions.targetFormat, false)}
                      disabled={selectedMergeIds.length === 0 || isMerging}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-md flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      {isMerging ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>
                        {mergeOptions.targetFormat === 'xdp'
                          ? 'Generate & Download Merged XDP (.xdp)'
                          : mergeOptions.targetFormat === 'pdf_xfa_combined'
                          ? 'Generate & Download Hybrid PDF+XFA (.pdf)'
                          : 'Generate & Download Merged PDF (.pdf)'}
                      </span>
                    </button>

                    {onLoadSinglePdf && mergeOptions.targetFormat !== 'xdp' && (
                      <button
                        onClick={() => handleExecuteBatchMerge(mergeOptions.targetFormat, true)}
                        disabled={selectedMergeIds.length === 0 || isMerging}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 disabled:opacity-40 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Build the merged PDF and open it immediately in the main workspace viewer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Open Merged PDF in Workspace</span>
                      </button>
                    )}

                    {/* Direct Aggregate Field Data Export Buttons for Merged XFA PDFs */}
                    <button
                      onClick={() => handleExportMergedAnalytics('csv')}
                      disabled={selectedMergeIds.length === 0}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Aggregate field data from all merged XFA PDFs into a single CSV export file for external analytics"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Aggregate Merged CSV</span>
                    </button>

                    <button
                      onClick={() => handleExportMergedAnalytics('json')}
                      disabled={selectedMergeIds.length === 0}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Aggregate field data from all merged XFA PDFs into a single JSON export file for external analytics"
                    >
                      <FileCode className="w-4 h-4" />
                      <span>Aggregate Merged JSON</span>
                    </button>
                  </div>
                </div>

                {/* Last Generated Merge Result Banner */}
                {lastMergeResult && (
                  <div className="bg-emerald-950/30 border border-emerald-700/50 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-emerald-200 flex items-center gap-2">
                          <span>Ready: {lastMergeResult.filename}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-900/60 text-emerald-300 rounded">
                            {(lastMergeResult.sizeBytes / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-0.5">
                          Merged <strong>{lastMergeResult.mergedCount}</strong> documents •{' '}
                          <strong>{lastMergeResult.totalFieldsMerged}</strong> form fields consolidated •{' '}
                          <strong>{lastMergeResult.totalPagesGenerated}</strong> total pages generated
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {lastMergeResult.xdpContent && (
                        <button
                          onClick={() =>
                            downloadBatchFile(
                              lastMergeResult.xdpContent!,
                              lastMergeResult.filename.endsWith('.xdp')
                                ? lastMergeResult.filename
                                : lastMergeResult.filename.replace(/\.pdf$/i, '.xdp'),
                              'application/vnd.adobe.xdp+xml'
                            )
                          }
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-medium rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          <span>Download .XDP</span>
                        </button>
                      )}
                      {lastMergeResult.pdfBytes && (
                        <>
                          <button
                            onClick={() =>
                              downloadBatchFile(
                                new Blob([new Uint8Array(lastMergeResult.pdfBytes!)], { type: 'application/pdf' }),
                                lastMergeResult.filename,
                                'application/pdf'
                              )
                            }
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download .PDF</span>
                          </button>
                          {onLoadSinglePdf && (
                            <button
                              onClick={() =>
                                onLoadSinglePdf(lastMergeResult.pdfBytes!, lastMergeResult.filename)
                              }
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-md flex items-center gap-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Inspect in Viewer</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Main 2-Column Merge Studio Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left Column (5 cols): Merge Configuration & Document Sequence */}
                  <div className="lg:col-span-5 flex flex-col space-y-4">
                    {/* 1. Target Package Format & Architecture */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3.5">
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Sliders className="w-3.5 h-3.5 text-purple-400" />
                        <span>1. Merge Output Format &amp; Options</span>
                      </h3>

                      {/* Package Title */}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Merged Package / Portfolio Title
                        </label>
                        <input
                          type="text"
                          value={mergeOptions.packageTitle}
                          onChange={e =>
                            setMergeOptions(prev => ({ ...prev, packageTitle: e.target.value }))
                          }
                          placeholder="e.g., Q4 Enterprise XFA Submissions Portfolio"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      {/* Target Format Radio Cards */}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                          Target Output Format
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          {(
                            [
                              {
                                id: 'pdf_merged',
                                title: 'Single Merged PDF Document (.pdf)',
                                desc: 'Standard ISO 32000-1 multi-page PDF combining all forms with cover sheet & AcroForm/flattened fields.',
                                badge: 'Universal PDF',
                              },
                              {
                                id: 'xdp',
                                title: 'Single Consolidated XDP Package (.xdp)',
                                desc: 'Adobe XML Data Package uniting <template>, <xfa:datasets>, and <config> packets across all files.',
                                badge: 'XFA XML Package',
                              },
                              {
                                id: 'pdf_xfa_combined',
                                title: 'Hybrid Merged PDF + Embedded XFA Stream (.pdf)',
                                desc: 'Multi-page PDF document that also embeds the unified XDP XML packet stream inside /AcroForm /XFA.',
                                badge: 'Dual-Mode Hybrid',
                              },
                            ] as const
                          ).map(opt => (
                            <div
                              key={opt.id}
                              onClick={() =>
                                setMergeOptions(prev => ({ ...prev, targetFormat: opt.id }))
                              }
                              className={`p-2.5 rounded-lg border transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                                mergeOptions.targetFormat === opt.id
                                  ? 'bg-purple-950/30 border-purple-500/70 text-slate-100'
                                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <div className="text-xs font-semibold text-slate-200">
                                  {opt.title}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                  {opt.desc}
                                </div>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-purple-300 shrink-0">
                                {opt.badge}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Conditional Architecture Mode Selector */}
                      {mergeOptions.targetFormat === 'xdp' ? (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            XDP Template &amp; Dataset Assembly Mode
                          </label>
                          <select
                            value={mergeOptions.xdpMergeMode}
                            onChange={e =>
                              setMergeOptions(prev => ({
                                ...prev,
                                xdpMergeMode: e.target.value as BatchMergeOptions['xdpMergeMode'],
                              }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                          >
                            <option value="master_subform_assembly">
                              Master Subform Assembly (Dedicated page-break &lt;subform&gt; per PDF)
                            </option>
                            <option value="multi_dataset_envelope">
                              Multi-Dataset Superset Schema (Repeatable &lt;submissionRecord&gt; envelope)
                            </option>
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            PDF Page Synthesis &amp; Field Rendering Mode
                          </label>
                          <select
                            value={mergeOptions.pdfMergeMode}
                            onChange={e =>
                              setMergeOptions(prev => ({
                                ...prev,
                                pdfMergeMode: e.target.value as BatchMergeOptions['pdfMergeMode'],
                              }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                          >
                            <option value="interactive_acroform">
                              Interactive AcroForm Fields (Editable text &amp; checkbox controls)
                            </option>
                            <option value="flattened_summary">
                              Flattened Archival Layout (Read-only high-contrast form cards)
                            </option>
                            <option value="native_pages">
                              Copy Native PDF Pages + Structured XFA Data Supplement
                            </option>
                          </select>
                        </div>
                      )}

                      {/* Structure Toggles */}
                      <div className="pt-1 space-y-2 border-t border-slate-800/80">
                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mergeOptions.includeCoverSheet}
                            onChange={e =>
                              setMergeOptions(prev => ({
                                ...prev,
                                includeCoverSheet: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-700 bg-slate-950 text-purple-500"
                          />
                          <span>Include Executive Portfolio Cover Banner &amp; KPIs</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mergeOptions.includeTableOfContents}
                            onChange={e =>
                              setMergeOptions(prev => ({
                                ...prev,
                                includeTableOfContents: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-700 bg-slate-950 text-purple-500"
                          />
                          <span>Include Merged Document Manifest &amp; Table of Contents</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mergeOptions.includeDocumentSeparators}
                            onChange={e =>
                              setMergeOptions(prev => ({
                                ...prev,
                                includeDocumentSeparators: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-700 bg-slate-950 text-purple-500"
                          />
                          <span>Stamp Document Separator Headers on Each Form Section</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mergeOptions.includeEmptyFields}
                            onChange={e =>
                              setMergeOptions(prev => ({
                                ...prev,
                                includeEmptyFields: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-700 bg-slate-950 text-purple-500"
                          />
                          <span>Include Empty / Unfilled XFA Fields in Merged Output</span>
                        </label>
                      </div>
                    </div>

                    {/* 2. Document Selection & Merge Sequence */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md flex flex-col">
                      <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          2. Document Merge Order ({selectedMergeIds.length} active)
                        </span>
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            onClick={() => setExcludedMergeIds(new Set())}
                            className="text-sky-400 hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-slate-600">|</span>
                          <button
                            onClick={() =>
                              setExcludedMergeIds(new Set(items.map(i => i.id)))
                            }
                            className="text-slate-400 hover:underline cursor-pointer"
                          >
                            None
                          </button>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-800/60 max-h-72 overflow-auto">
                        {items.map((item, idx) => {
                          const isSelected =
                            item.status === 'completed' && !excludedMergeIds.has(item.id);
                          return (
                            <div
                              key={item.id}
                              className={`px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                                isSelected ? 'bg-slate-900/90' : 'bg-slate-950/60 opacity-60'
                              }`}
                            >
                              <div
                                onClick={() =>
                                  item.status === 'completed' && handleToggleMergeFile(item.id)
                                }
                                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-purple-400 shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-600 shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium text-slate-200 truncate flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                                      #{idx + 1}
                                    </span>
                                    <span className="truncate">{item.filename}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                                    <span>{item.metadata.xfaType}</span>
                                    <span>•</span>
                                    <span>{item.fields.length} fields</span>
                                    <span>•</span>
                                    <span className="text-emerald-400">
                                      {item.metadata.completionPercentage}% filled
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Reorder Up/Down Buttons */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleMoveItem(idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded cursor-pointer"
                                  title="Move earlier in merge sequence"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleMoveItem(idx, 'down')}
                                  disabled={idx === items.length - 1}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded cursor-pointer"
                                  title="Move later in merge sequence"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Column (7 cols): Live Consolidated XDP & Architecture Inspector */}
                  <div className="lg:col-span-7 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
                    <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-sky-400" />
                          <span>Consolidated XDP XML Packet Stream Preview</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Live preview of the merged <code className="text-sky-300">&lt;xdp:xdp&gt;</code> package uniting{' '}
                          {liveMergedXdpPreview?.mergedCount || 0} document(s) and{' '}
                          {liveMergedXdpPreview?.totalFieldsMerged || 0} fields
                        </p>
                      </div>

                      {liveMergedXdpPreview?.xdpContent && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                            {(liveMergedXdpPreview.sizeBytes / 1024).toFixed(1)} KB XML
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(liveMergedXdpPreview.xdpContent || '');
                              showToast('Copied consolidated XDP XML to clipboard');
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy XDP</span>
                          </button>
                          <button
                            onClick={() => handleExecuteBatchMerge('xdp')}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Save .XDP</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Packet Stream Architecture Pills */}
                    <div className="px-4 py-2 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-slate-400 font-medium">Embedded XDP Packets:</span>
                      <span className="px-2 py-0.5 rounded bg-sky-950/70 text-sky-300 border border-sky-800/60 font-mono">
                        &lt;config&gt; (Acrobat XCI 3.0)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/60 font-mono">
                        &lt;template&gt; ({mergeOptions.xdpMergeMode === 'master_subform_assembly' ? `${selectedMergeIds.length} Subforms` : 'Superset Schema'})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 font-mono">
                        &lt;xfa:datasets&gt; ({liveMergedXdpPreview?.totalFieldsMerged || 0} Bound Values)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60 font-mono">
                        &lt;x:xmpmeta&gt; (RDF Dublin Core)
                      </span>
                    </div>

                    {/* XML Code Viewer */}
                    <div className="flex-1 p-4 bg-slate-950 overflow-auto max-h-[520px]">
                      {liveMergedXdpPreview?.xdpContent ? (
                        <pre className="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre">
                          {liveMergedXdpPreview.xdpContent}
                        </pre>
                      ) : (
                        <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                          Select at least one completed document to preview the consolidated XDP package.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Embedded Batch Analysis Summary for Merged Documents */}
                <BatchAnalysisSummary
                  items={items}
                  selectedMergeIds={selectedMergeIds}
                  schema={schema}
                  lastMergeResult={lastMergeResult}
                  onInspectDocument={item => setSelectedItemForDetail(item)}
                  onExportMergedAnalytics={handleExportMergedAnalytics}
                />
              </div>
            )}

            {/* Sub-Tab 7: Batch Analysis Summary (Comparative Field Completion Charts) */}
            {activeSubTab === 'analysis' && (
              <div className="flex-1 flex flex-col space-y-4 overflow-auto">
                <BatchAnalysisSummary
                  items={items}
                  selectedMergeIds={selectedMergeIds}
                  schema={schema}
                  lastMergeResult={lastMergeResult}
                  onInspectDocument={item => setSelectedItemForDetail(item)}
                  onExportMergedAnalytics={handleExportMergedAnalytics}
                />
              </div>
            )}

            {/* Sub-Tab 8: Batch PKCS#7 Signature Placeholder Injector */}
            {activeSubTab === 'pkcs7' && (
              <div className="flex-1 flex flex-col space-y-4 overflow-auto">
                {/* Top Summary Banner & Batch Execute Controls */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg shrink-0">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-100">
                          Batch PKCS#7 Cryptographic Signature Placeholder Injector
                        </h2>
                        <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full font-mono">
                          /{pkcs7Options.subFilter} • {pkcs7Options.placeholderSizeBytes} Bytes Reserved
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded-full font-mono">
                          {selectedMergeIds.length} Target PDF(s)
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
                        Injects an ISO 32000-1 <code className="text-amber-300">/Type /Sig</code> dictionary with pre-allocated <code className="text-sky-300">/ByteRange</code> and hex <code className="text-emerald-300">/Contents &lt;0000...&gt;</code> buffer, an AcroForm <code className="text-purple-300">/FT /Sig</code> widget annotation, and an XFA 3.3 <code className="text-amber-300">&lt;signature&gt;</code> template node across multiple XFA PDFs at once for high-throughput HSM / PKCS#11 / OpenSSL batch signing.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleExecuteBatchPkcs7(false)}
                      disabled={selectedMergeIds.length === 0 || isInjectingPkcs7}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-md flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      {isInjectingPkcs7 ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <KeyRound className="w-4 h-4" />
                      )}
                      <span>Inject PKCS#7 into {selectedMergeIds.length} PDF(s)</span>
                    </button>

                    <button
                      onClick={() => handleExecuteBatchPkcs7(true)}
                      disabled={selectedMergeIds.length === 0 || isInjectingPkcs7}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-md flex items-center gap-2 transition-colors cursor-pointer"
                      title="Inject PKCS#7 signature placeholders and download ZIP bundle with signing manifest"
                    >
                      <Download className="w-4 h-4" />
                      <span>Inject &amp; Download Batch ZIP</span>
                    </button>
                  </div>
                </div>

                {/* Main 2-Column PKCS#7 Studio Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left Column (5 cols): Cryptographic Parameters & Target Files */}
                  <div className="lg:col-span-5 flex flex-col space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3.5">
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>1. PKCS#7 / CMS Envelope &amp; Signer Parameters</span>
                      </h3>

                      {/* Field Name & SubFilter */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Signature Field Name (/T)
                          </label>
                          <input
                            type="text"
                            value={pkcs7Options.fieldName}
                            onChange={e =>
                              setPkcs7Options(prev => ({ ...prev, fieldName: e.target.value }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Reserved /Contents Buffer
                          </label>
                          <select
                            value={pkcs7Options.placeholderSizeBytes}
                            onChange={e =>
                              setPkcs7Options(prev => ({
                                ...prev,
                                placeholderSizeBytes: Number(e.target.value) as 4096 | 8192 | 16384,
                              }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          >
                            <option value={4096}>4,096 Bytes (8 KB Hex — Basic RSA/ECDSA)</option>
                            <option value={8192}>8,192 Bytes (16 KB Hex — Cert Chain + TSA)</option>
                            <option value={16384}>16,384 Bytes (32 KB Hex — PAdES LTV + OCSP)</option>
                          </select>
                        </div>
                      </div>

                      {/* Cryptographic SubFilter & Filter */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            PKCS#7 /SubFilter Profile
                          </label>
                          <select
                            value={pkcs7Options.subFilter}
                            onChange={e =>
                              setPkcs7Options(prev => ({
                                ...prev,
                                subFilter: e.target.value as BatchPkcs7Options['subFilter'],
                              }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                          >
                            <option value="adbe.pkcs7.detached">/adbe.pkcs7.detached (ISO 32000 CMS)</option>
                            <option value="ETSI.CAdES.detached">/ETSI.CAdES.detached (PAdES B-B)</option>
                            <option value="adbe.pkcs7.sha1">/adbe.pkcs7.sha1 (PKCS#7 SHA-1)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Signature Handler /Filter
                          </label>
                          <select
                            value={pkcs7Options.filter}
                            onChange={e =>
                              setPkcs7Options(prev => ({
                                ...prev,
                                filter: e.target.value as BatchPkcs7Options['filter'],
                              }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                          >
                            <option value="Adobe.PPKLite">/Adobe.PPKLite (Standard Acrobat)</option>
                            <option value="Entrust.PPKEF">/Entrust.PPKEF (Entrust PKI)</option>
                            <option value="VeriSign.PPKVS">/VeriSign.PPKVS (VeriSign)</option>
                          </select>
                        </div>
                      </div>

                      {/* Signer CN & Contact Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Signer Common Name (/Name)
                          </label>
                          <input
                            type="text"
                            value={pkcs7Options.signerName}
                            onChange={e =>
                              setPkcs7Options(prev => ({ ...prev, signerName: e.target.value }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Signer Contact (/ContactInfo)
                          </label>
                          <input
                            type="text"
                            value={pkcs7Options.contactInfo}
                            onChange={e =>
                              setPkcs7Options(prev => ({ ...prev, contactInfo: e.target.value }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* Reason & Location */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Signing Reason (/Reason)
                          </label>
                          <input
                            type="text"
                            value={pkcs7Options.reason}
                            onChange={e =>
                              setPkcs7Options(prev => ({ ...prev, reason: e.target.value }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Signing Location (/Location)
                          </label>
                          <input
                            type="text"
                            value={pkcs7Options.location}
                            onChange={e =>
                              setPkcs7Options(prev => ({ ...prev, location: e.target.value }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* Target Page & Widget Placement */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Target Page Placement
                          </label>
                          <select
                            value={pkcs7Options.targetPageMode}
                            onChange={e =>
                              setPkcs7Options(prev => ({
                                ...prev,
                                targetPageMode: e.target.value as BatchPkcs7Options['targetPageMode'],
                              }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          >
                            <option value="last_page">Last Page of Each PDF</option>
                            <option value="first_page">First Page of Each PDF</option>
                            <option value="append_signature_page">Append Dedicated Signature Page</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Signature Widget Coordinates
                          </label>
                          <select
                            value={pkcs7Options.boxPosition}
                            onChange={e =>
                              setPkcs7Options(prev => ({
                                ...prev,
                                boxPosition: e.target.value as BatchPkcs7Options['boxPosition'],
                              }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          >
                            <option value="bottom_right">Bottom Right ([340, 34, 576, 112])</option>
                            <option value="bottom_left">Bottom Left ([36, 34, 272, 112])</option>
                            <option value="top_right">Top Right ([340, 672, 576, 750])</option>
                          </select>
                        </div>
                      </div>

                      {/* Cryptographic & XFA Checkboxes */}
                      <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
                        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pkcs7Options.injectXfaTemplateNode}
                            onChange={e =>
                              setPkcs7Options(prev => ({
                                ...prev,
                                injectXfaTemplateNode: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-700 bg-slate-950 text-amber-500"
                          />
                          <span>
                            Inject XFA 3.3 <code className="text-amber-300">&lt;ui&gt;&lt;signature/&gt;&lt;/ui&gt;</code> Node into XFA Packet
                          </span>
                        </label>

                        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pkcs7Options.renderVisualStamp}
                            onChange={e =>
                              setPkcs7Options(prev => ({
                                ...prev,
                                renderVisualStamp: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-700 bg-slate-950 text-amber-500"
                          />
                          <span>Stamp Visual Cryptographic Appearance Box on Target Page</span>
                        </label>

                        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pkcs7Options.lockSigFlags}
                            onChange={e =>
                              setPkcs7Options(prev => ({
                                ...prev,
                                lockSigFlags: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-700 bg-slate-950 text-amber-500"
                          />
                          <span>
                            Set <code className="text-sky-300">/SigFlags 3</code> (SignaturesExist | AppendOnly) in <code className="text-sky-300">/AcroForm</code>
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Right Column (7 cols): Live PDF /Type /Sig Object Inspector & Prepared Files Table */}
                  <div className="lg:col-span-7 flex flex-col space-y-4">
                    {/* Live ASN.1 / PDF /Type /Sig & XFA XML Preview Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md flex flex-col">
                      <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                            Injected PKCS#7 Structure Preview
                          </span>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
                          <button
                            onClick={() => setPkcs7InspectorTab('pdf_dict')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                              pkcs7InspectorTab === 'pdf_dict'
                                ? 'bg-amber-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            PDF /Type /Sig Object
                          </button>
                          <button
                            onClick={() => setPkcs7InspectorTab('xfa_xml')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                              pkcs7InspectorTab === 'xfa_xml'
                                ? 'bg-amber-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            XFA &lt;signature&gt; XML
                          </button>
                          <button
                            onClick={() => setPkcs7InspectorTab('openssl')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                              pkcs7InspectorTab === 'openssl'
                                ? 'bg-amber-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            OpenSSL / HSM Command
                          </button>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-950 max-h-56 overflow-auto">
                        <pre className="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre">
                          {pkcs7InspectorTab === 'pdf_dict'
                            ? pkcs7Preview.pdfSigDictPreview
                            : pkcs7InspectorTab === 'xfa_xml'
                            ? pkcs7Preview.xfaSignatureXmlPreview
                            : pkcs7Preview.openSslCommandPreview}
                        </pre>
                      </div>
                    </div>

                    {/* Batch Document PKCS#7 Injection Status Table */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md flex-1 flex flex-col">
                      <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="font-bold text-slate-200 uppercase tracking-wider">
                            Batch PKCS#7 Target Documents ({selectedMergeIds.length} Selected)
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Click &ldquo;Inject PKCS#7&rdquo; above to stamp all selected files at once
                        </span>
                      </div>

                      <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="py-2.5 px-3 font-semibold w-10">Target</th>
                              <th className="py-2.5 px-3 font-semibold">Document</th>
                              <th className="py-2.5 px-3 font-semibold">Signature Field</th>
                              <th className="py-2.5 px-3 font-semibold">PKCS#7 Status</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {items.map(item => {
                              const isSelected =
                                item.status === 'completed' && !excludedMergeIds.has(item.id);
                              const pkcs7 = item.pkcs7Result;
                              return (
                                <tr key={item.id} className="hover:bg-slate-800/40">
                                  <td className="py-2.5 px-3">
                                    <button
                                      onClick={() =>
                                        item.status === 'completed' && handleToggleMergeFile(item.id)
                                      }
                                      className="cursor-pointer text-slate-300"
                                    >
                                      {isSelected ? (
                                        <CheckSquare className="w-4 h-4 text-amber-400" />
                                      ) : (
                                        <Square className="w-4 h-4 text-slate-600" />
                                      )}
                                    </button>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-medium text-slate-200 truncate max-w-[180px]" title={item.filename}>
                                      {item.filename}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {item.metadata.xfaType} • {item.metadata.pageCount} page(s)
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-amber-300">
                                    {pkcs7 ? pkcs7.fieldName : pkcs7Options.fieldName}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {pkcs7 ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Injected (Pg {pkcs7.targetPageNumber} • {pkcs7.placeholderSizeBytes}B)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                                        Pending Injection
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="inline-flex items-center gap-1.5">
                                      {pkcs7 && (
                                        <button
                                          onClick={() =>
                                            downloadBatchFile(
                                              new Blob([new Uint8Array(pkcs7.pdfBytes)], {
                                                type: 'application/pdf',
                                              }),
                                              pkcs7.signedReadyFilename,
                                              'application/pdf'
                                            )
                                          }
                                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium rounded inline-flex items-center gap-1 cursor-pointer"
                                          title="Download PKCS#7-prepared PDF"
                                        >
                                          <Download className="w-3 h-3" />
                                          <span>.PDF</span>
                                        </button>
                                      )}
                                      {onLoadSinglePdf && item.pdfBytes && (
                                        <button
                                          onClick={() =>
                                            onLoadSinglePdf(
                                              item.pdfBytes!,
                                              pkcs7 ? pkcs7.signedReadyFilename : item.filename
                                            )
                                          }
                                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-medium rounded inline-flex items-center gap-1 cursor-pointer"
                                          title="Open in main PDF Canvas Viewer"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                          <span>Viewer</span>
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preflight Findings Inspection Modal */}
      {selectedPreflightDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg border ${
                    selectedPreflightDoc.overallStatus === 'pass'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : selectedPreflightDoc.overallStatus === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <span>{selectedPreflightDoc.documentName}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                        selectedPreflightDoc.overallStatus === 'pass'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : selectedPreflightDoc.overallStatus === 'warning'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {selectedPreflightDoc.overallStatus}
                    </span>
                  </h3>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>Profile: <strong>{selectedPreflightDoc.profile.toUpperCase()}</strong></span>
                    <span>•</span>
                    <span className="text-emerald-400">{selectedPreflightDoc.passedCount} Passed</span>
                    <span>•</span>
                    <span className="text-amber-400">{selectedPreflightDoc.warningsCount} Warnings</span>
                    <span>•</span>
                    <span className="text-rose-400">{selectedPreflightDoc.errorsCount} Errors</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedPreflightDoc(null)}
                className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Filter Tabs inside Modal */}
            <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Show:</span>
                <button
                  onClick={() => setPreflightDetailFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    preflightDetailFilter === 'all'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({selectedPreflightDoc.issues.length})
                </button>
                <button
                  onClick={() => setPreflightDetailFilter('error')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    preflightDetailFilter === 'error'
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-400 hover:text-rose-300'
                  }`}
                >
                  Errors ({selectedPreflightDoc.errorsCount})
                </button>
                <button
                  onClick={() => setPreflightDetailFilter('warning')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    preflightDetailFilter === 'warning'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-400 hover:text-amber-300'
                  }`}
                >
                  Warnings ({selectedPreflightDoc.warningsCount})
                </button>
                <button
                  onClick={() => setPreflightDetailFilter('passed')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    preflightDetailFilter === 'passed'
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-400 hover:text-emerald-300'
                  }`}
                >
                  Passed ({selectedPreflightDoc.passedCount})
                </button>
              </div>

              <div className="text-[11px] text-slate-500 font-mono">
                {new Date(selectedPreflightDoc.timestamp).toLocaleTimeString()}
              </div>
            </div>

            {/* Modal Body: Issue Cards */}
            <div className="flex-1 overflow-auto p-5 space-y-3">
              {selectedPreflightDoc.issues
                .filter(i => {
                  if (preflightDetailFilter === 'all') return true;
                  return i.severity === preflightDetailFilter;
                })
                .map(issue => (
                  <div
                    key={issue.id}
                    className={`border rounded-lg p-3.5 transition-colors ${
                      issue.severity === 'error'
                        ? 'bg-rose-950/20 border-rose-800/50'
                        : issue.severity === 'warning'
                        ? 'bg-amber-950/20 border-amber-800/50'
                        : 'bg-emerald-950/20 border-emerald-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {issue.severity === 'error' && (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        {issue.severity === 'warning' && (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        {issue.severity === 'passed' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-100">
                          {issue.ruleName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.2 bg-slate-800 rounded">
                          {issue.ruleId}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-slate-800 text-slate-300">
                          Target: {issue.targetType}
                        </span>
                        {issue.pageNumber && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            Page {issue.pageNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-slate-300 font-medium ml-6 mb-1">
                      {issue.message}
                    </div>

                    <div className="text-[11px] text-slate-400 ml-6 leading-relaxed">
                      {issue.detail}
                    </div>

                    {issue.suggestedFix && (
                      <div className="mt-2 ml-6 text-[11px] text-sky-300 bg-sky-950/50 border border-sky-800/60 rounded p-2 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>Recommended Fix:</strong> {issue.suggestedFix}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                {selectedPreflightDoc.documentName}
              </span>
              <button
                onClick={() => setSelectedPreflightDoc(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Slide-Over / Modal */}
      {selectedItemForDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    {selectedItemForDetail.filename}
                  </h3>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>{selectedItemForDetail.metadata.formTitle}</span>
                    <span>•</span>
                    <span>{selectedItemForDetail.metadata.xfaType}</span>
                    <span>•</span>
                    <span>{selectedItemForDetail.fields.length} extracted fields</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedItemForDetail(null)}
                className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-5 space-y-4">
              {/* Field Grid */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Extracted Form Fields ({selectedItemForDetail.fields.length})
                </h4>
                <div className="bg-slate-950 border border-slate-800 rounded-lg max-h-60 overflow-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3 font-semibold">Field Name</th>
                        <th className="py-2 px-3 font-semibold">Caption / Label</th>
                        <th className="py-2 px-3 font-semibold">Type</th>
                        <th className="py-2 px-3 font-semibold">Extracted Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {selectedItemForDetail.fields.map(f => (
                        <tr key={f.id} className="hover:bg-slate-900/60">
                          <td className="py-1.5 px-3 text-sky-400">{f.name || f.id}</td>
                          <td className="py-1.5 px-3 text-slate-200 font-sans">{f.caption}</td>
                          <td className="py-1.5 px-3 text-slate-400">{f.type}</td>
                          <td className="py-1.5 px-3 text-emerald-300 font-sans font-medium">
                            {f.value || <span className="text-slate-600 font-mono italic">(empty)</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Raw Datasets XML Snippet */}
              {selectedItemForDetail.rawXml && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Extracted XFA XML Datasets Packet
                  </h4>
                  <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 max-h-48 overflow-auto whitespace-pre">
                    {selectedItemForDetail.rawXml}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                ID: {selectedItemForDetail.id}
              </span>
              <button
                onClick={() => setSelectedItemForDetail(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
