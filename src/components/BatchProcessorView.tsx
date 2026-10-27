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
} from 'lucide-react';
import {
  BatchFileItem,
  BatchSchemaColumn,
  processPdfForBatch,
  extractBatchSchema,
  generateBatchCsv,
  generateBatchJson,
  generateBatchXlsx,
  generateBatchZip,
  downloadBatchFile,
  createSampleBatchFiles,
} from '../utils/batchProcessor';

interface BatchProcessorViewProps {
  onLoadSinglePdf?: (bytes: Uint8Array, filename: string) => void;
}

export function BatchProcessorView({ onLoadSinglePdf }: BatchProcessorViewProps) {
  const [items, setItems] = useState<BatchFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'normalized' | 'schema' | 'queue'>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<BatchFileItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs">
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
        </div>

        {/* Export Dropdown / Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search extracted data..."
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
          </div>
        )}
      </div>

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
