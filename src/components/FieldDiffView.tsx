import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  GitCompareArrows,
  Upload,
  ArrowLeftRight,
  Search,
  Download,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  MinusCircle,
  Sparkles,
  FileText,
  X,
  ChevronDown,
  ChevronRight,
  Layers,
  Filter,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { XFAField, XFASubform } from '../types/pdf';
import {
  DiffDocumentSummary,
  FieldDiffEntry,
  FieldDiffStatus,
  InlineDiffToken,
  parsePdfForFieldDiff,
  buildDiffSummaryFromLiveSession,
  buildSimulatedRevisionSummary,
  compareXfaDocuments,
  generateDiffCsvReport,
  generateDiffJsonReport,
} from '../utils/xfaFieldDiffEngine';
import { createSampleXfaPdf, createCanadaBookFundXfaPdf } from '../utils/samplePdfs';

interface FieldDiffViewProps {
  currentFilename?: string;
  currentPdfBytes?: Uint8Array | null;
  currentFields?: XFAField[];
  currentSubforms?: XFASubform[];
  currentHasXfa?: boolean;
  currentPageCount?: number;
  onShowToast?: (msg: string) => void;
}

type DiffFilterStatus = 'all' | 'discrepancies' | FieldDiffStatus;

function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const InlineTokensView: React.FC<{
  tokens: InlineDiffToken[];
  side: 'A' | 'B';
  emptyLabel: string;
}> = ({ tokens, side, emptyLabel }) => {
  if (!tokens || tokens.length === 0) {
    return <span className="italic text-slate-500 text-[11px]">{emptyLabel}</span>;
  }

  return (
    <span className="break-words whitespace-pre-wrap leading-relaxed">
      {tokens.map((tok, i) => {
        if (tok.type === 'removed') {
          return (
            <mark
              key={i}
              className="bg-rose-500/30 text-rose-100 px-0.5 rounded-xs line-through decoration-rose-400/80"
            >
              {tok.text}
            </mark>
          );
        }
        if (tok.type === 'added') {
          return (
            <mark
              key={i}
              className="bg-emerald-500/30 text-emerald-100 px-0.5 rounded-xs font-semibold"
            >
              {tok.text}
            </mark>
          );
        }
        return (
          <span key={i} className={side === 'A' ? 'text-slate-200' : 'text-slate-100'}>
            {tok.text}
          </span>
        );
      })}
    </span>
  );
};

export const FieldDiffView: React.FC<FieldDiffViewProps> = ({
  currentFilename = '',
  currentPdfBytes = null,
  currentFields = [],
  currentSubforms = [],
  currentHasXfa = false,
  currentPageCount = 1,
  onShowToast,
}) => {
  const [docA, setDocA] = useState<DiffDocumentSummary | null>(null);
  const [docB, setDocB] = useState<DiffDocumentSummary | null>(null);
  const [loadingSlot, setLoadingSlot] = useState<'A' | 'B' | null>(null);
  const [errorSlot, setErrorSlot] = useState<{ slot: 'A' | 'B'; message: string } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<'A' | 'B' | null>(null);

  // Filter & comparison controls
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DiffFilterStatus>('all');
  const [selectedSubform, setSelectedSubform] = useState<string>('all');
  const [groupBySubform, setGroupBySubform] = useState<boolean>(true);
  const [ignoreCase, setIgnoreCase] = useState<boolean>(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState<boolean>(true);
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});
  const [collapsedSubforms, setCollapsedSubforms] = useState<Record<string, boolean>>({});

  const fileInputARef = useRef<HTMLInputElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);

  // Pre-seed Document A with the currently active workspace document once on mount if available
  const seededOnceRef = useRef(false);
  useEffect(() => {
    if (!seededOnceRef.current && currentFilename && currentFields.length > 0 && !docA) {
      seededOnceRef.current = true;
      setDocA(
        buildDiffSummaryFromLiveSession(
          currentFilename,
          currentPdfBytes,
          currentFields,
          currentSubforms,
          currentHasXfa,
          currentPageCount
        )
      );
    }
  }, [currentFilename, currentPdfBytes, currentFields, currentSubforms, currentHasXfa, currentPageCount, docA]);

  const handleLoadFileIntoSlot = async (slot: 'A' | 'B', file: File) => {
    setLoadingSlot(slot);
    setErrorSlot(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const summary = await parsePdfForFieldDiff(bytes, file.name);
      if (slot === 'A') setDocA(summary);
      else setDocB(summary);
      onShowToast?.(
        `Loaded ${file.name} into Document ${slot} (${summary.fields.length} fields, ${summary.filledCount} filled)`
      );
    } catch (err: any) {
      console.error(`Failed to parse PDF for Slot ${slot}:`, err);
      setErrorSlot({
        slot,
        message: err?.message || 'Unable to parse PDF file. Ensure it is a valid PDF/XFA document.',
      });
    } finally {
      setLoadingSlot(null);
    }
  };

  const handleUseActiveDocument = (slot: 'A' | 'B') => {
    if (!currentFilename) return;
    const summary = buildDiffSummaryFromLiveSession(
      currentFilename,
      currentPdfBytes,
      currentFields,
      currentSubforms,
      currentHasXfa,
      currentPageCount
    );
    if (slot === 'A') setDocA(summary);
    else setDocB(summary);
    setErrorSlot(null);
    onShowToast?.(`Loaded active workspace document "${currentFilename}" into Document ${slot}`);
  };

  const handleLoadSampleIntoSlot = async (slot: 'A' | 'B', kind: 'enterprise' | 'cbf') => {
    setLoadingSlot(slot);
    setErrorSlot(null);
    try {
      const bytes =
        kind === 'cbf' ? await createCanadaBookFundXfaPdf() : await createSampleXfaPdf();
      const name =
        kind === 'cbf' ? 'cBF-FinRepDatFrm-eng.pdf' : 'Enterprise_Registry_XFA_Form.pdf';
      const summary = await parsePdfForFieldDiff(bytes, name);
      if (slot === 'A') setDocA(summary);
      else setDocB(summary);
      onShowToast?.(`Loaded ${name} into Document ${slot}`);
    } catch (err: any) {
      setErrorSlot({ slot, message: err?.message || 'Failed to load sample XFA PDF' });
    } finally {
      setLoadingSlot(null);
    }
  };

  const handleLoadSimulatedRevisionB = () => {
    if (!docA) return;
    const revised = buildSimulatedRevisionSummary(docA);
    setDocB(revised);
    setErrorSlot(null);
    onShowToast?.(`Generated sample revised XFA PDF "${revised.filename}" in Document B`);
  };

  const handleSwapDocuments = () => {
    if (!docA && !docB) return;
    const prevA = docA;
    const prevB = docB;
    setDocA(prevB);
    setDocB(prevA);
    onShowToast?.('Swapped Document A and Document B');
  };

  const diffResult = useMemo(() => {
    if (!docA || !docB) return null;
    return compareXfaDocuments(docA, docB, {
      ignoreCase,
      ignoreWhitespace,
    });
  }, [docA, docB, ignoreCase, ignoreWhitespace]);

  const filteredEntries = useMemo(() => {
    if (!diffResult) return [];
    const q = searchQuery.trim().toLowerCase();

    return diffResult.entries.filter(entry => {
      if (statusFilter === 'discrepancies' && entry.status === 'unchanged') return false;
      if (
        statusFilter !== 'all' &&
        statusFilter !== 'discrepancies' &&
        entry.status !== statusFilter
      ) {
        return false;
      }

      if (selectedSubform !== 'all' && entry.subform !== selectedSubform) {
        return false;
      }

      if (q) {
        const hay = `${entry.caption} ${entry.name} ${entry.subform} ${entry.valueA} ${entry.valueB}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [diffResult, statusFilter, selectedSubform, searchQuery]);

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, FieldDiffEntry[]>();
    for (const entry of filteredEntries) {
      if (!groups.has(entry.subform)) groups.set(entry.subform, []);
      groups.get(entry.subform)!.push(entry);
    }
    return Array.from(groups.entries());
  }, [filteredEntries]);

  const handleExportCsv = () => {
    if (!diffResult || !docA || !docB) return;
    const csv = generateDiffCsvReport(diffResult, docA.filename, docB.filename);
    const outName = `XFA_Field_Diff_${docA.filename.replace(/\.pdf$/i, '')}_vs_${docB.filename.replace(/\.pdf$/i, '')}.csv`;
    downloadTextFile(csv, outName, 'text/csv;charset=utf-8');
    onShowToast?.(`Exported field diff report (${diffResult.stats.discrepancyCount} discrepancies) to CSV`);
  };

  const handleExportJson = () => {
    if (!diffResult || !docA || !docB) return;
    const json = generateDiffJsonReport(diffResult, docA, docB);
    const outName = `XFA_Field_Diff_${docA.filename.replace(/\.pdf$/i, '')}_vs_${docB.filename.replace(/\.pdf$/i, '')}.json`;
    downloadTextFile(json, outName, 'application/json;charset=utf-8');
    onShowToast?.('Exported structured JSON diff report');
  };

  const renderSlotCard = (slot: 'A' | 'B', doc: DiffDocumentSummary | null) => {
    const inputRef = slot === 'A' ? fileInputARef : fileInputBRef;
    const isLoading = loadingSlot === slot;
    const isDragOver = dragOverSlot === slot;
    const slotError = errorSlot?.slot === slot ? errorSlot.message : null;
    const isSlotA = slot === 'A';

    return (
      <div
        onDragOver={e => {
          e.preventDefault();
          setDragOverSlot(slot);
        }}
        onDragLeave={() => setDragOverSlot(prev => (prev === slot ? null : prev))}
        onDrop={e => {
          e.preventDefault();
          setDragOverSlot(null);
          const file = e.dataTransfer.files?.[0];
          if (file) handleLoadFileIntoSlot(slot, file);
        }}
        className={`rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 ${
          isDragOver
            ? isSlotA
              ? 'bg-rose-950/30 border-rose-400 ring-2 ring-rose-500/30'
              : 'bg-emerald-950/30 border-emerald-400 ring-2 ring-emerald-500/30'
            : doc
            ? isSlotA
              ? 'bg-slate-900/90 border-rose-500/35'
              : 'bg-slate-900/90 border-emerald-500/35'
            : 'bg-slate-900/50 border-dashed border-slate-700 hover:border-slate-500'
        }`}
      >
        <input
          type="file"
          ref={inputRef}
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) {
              handleLoadFileIntoSlot(slot, file);
              e.target.value = '';
            }
          }}
        />

        {/* Slot Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 border ${
                isSlotA
                  ? 'bg-rose-950/70 text-rose-300 border-rose-600/50'
                  : 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50'
              }`}
            >
              Doc {slot} · {isSlotA ? 'Baseline' : 'Compare'}
            </span>
            {doc && (
              <span className="text-[10px] font-mono text-slate-400 truncate">
                {doc.sourceKind === 'live_session'
                  ? 'Active Session'
                  : doc.sourceKind === 'synthetic_demo'
                  ? 'Demo Revision'
                  : doc.hasXfa
                  ? 'XFA PDF'
                  : 'AcroForm PDF'}
              </span>
            )}
          </div>

          {doc && (
            <button
              type="button"
              onClick={() => (slot === 'A' ? setDocA(null) : setDocB(null))}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={`Clear Document ${slot}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Slot Body */}
        {isLoading ? (
          <div className="py-5 flex items-center justify-center gap-2.5 text-xs text-slate-300">
            <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <span>Extracting XFA template &amp; dataset fields...</span>
          </div>
        ) : doc ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText
                className={`w-4 h-4 shrink-0 ${isSlotA ? 'text-rose-400' : 'text-emerald-400'}`}
              />
              <span className="text-sm font-semibold text-slate-100 truncate" title={doc.filename}>
                {doc.filename}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-400">
              <span>{doc.fields.length} fields</span>
              <span>·</span>
              <span className="text-slate-200">{doc.filledCount} filled</span>
              <span>·</span>
              <span>{doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}</span>
              {doc.fileSizeBytes > 0 && (
                <>
                  <span>·</span>
                  <span>{formatBytes(doc.fileSizeBytes)}</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            className="py-3 text-center space-y-1.5 cursor-pointer group"
          >
            <Upload className="w-5 h-5 mx-auto text-slate-400 group-hover:text-sky-400 transition-colors" />
            <div className="text-xs font-medium text-slate-200">
              Drop an XFA PDF here or <span className="text-sky-400 underline">browse</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Supports Dynamic XFA, Static XFA, and Standard AcroForm PDFs
            </div>
          </div>
        )}

        {slotError && (
          <div className="text-[11px] text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{slotError}</span>
          </div>
        )}

        {/* Quick Slot Actions */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors cursor-pointer"
          >
            <Upload className="w-3 h-3 text-sky-400" />
            <span>{doc ? 'Replace PDF' : 'Select PDF'}</span>
          </button>

          {currentFilename && currentFields.length > 0 && (
            <button
              type="button"
              onClick={() => handleUseActiveDocument(slot)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/70 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors cursor-pointer"
              title={`Use currently loaded document (${currentFilename}) with live unsaved edits`}
            >
              <span>Active PDF</span>
            </button>
          )}

          {slot === 'B' && docA && (
            <button
              type="button"
              onClick={handleLoadSimulatedRevisionB}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-700/60 font-medium transition-colors cursor-pointer"
              title="Generate a realistic revised version of Document A to preview red/green discrepancies"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Demo Revision</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleLoadSampleIntoSlot(slot, 'enterprise')}
            className="px-2 py-1 rounded-md bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Sample XFA
          </button>

          <button
            type="button"
            onClick={() => handleLoadSampleIntoSlot(slot, 'cbf')}
            className="px-2 py-1 rounded-md bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Canada Book Fund
          </button>
        </div>
      </div>
    );
  };

  const renderStatusBadge = (entry: FieldDiffEntry) => {
    if (entry.status === 'modified') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40">
          <GitCompareArrows className="w-3 h-3" />
          <span>Changed</span>
        </span>
      );
    }
    if (entry.status === 'added') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/45">
          <PlusCircle className="w-3 h-3" />
          <span>{entry.presence === 'only_b' ? 'Only in B' : 'Populated'}</span>
        </span>
      );
    }
    if (entry.status === 'removed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/45">
          <MinusCircle className="w-3 h-3" />
          <span>{entry.presence === 'only_a' ? 'Only in A' : 'Cleared'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        <CheckCircle2 className="w-3 h-3 text-slate-500" />
        <span>Match</span>
      </span>
    );
  };

  const renderDiffRow = (entry: FieldDiffEntry) => {
    const isExpanded = Boolean(expandedRowIds[entry.id]);

    const leftCellClass =
      entry.status === 'removed'
        ? 'bg-rose-950/50 border-rose-500/55 text-rose-100'
        : entry.status === 'modified'
        ? 'bg-rose-950/30 border-rose-500/35 text-rose-100'
        : entry.status === 'added'
        ? 'bg-slate-950/60 border-slate-800/80 text-slate-500'
        : 'bg-slate-950/40 border-slate-800/70 text-slate-300';

    const rightCellClass =
      entry.status === 'added'
        ? 'bg-emerald-950/50 border-emerald-500/55 text-emerald-100'
        : entry.status === 'modified'
        ? 'bg-emerald-950/30 border-emerald-500/35 text-emerald-100'
        : entry.status === 'removed'
        ? 'bg-slate-950/60 border-slate-800/80 text-slate-500'
        : 'bg-slate-950/40 border-slate-800/70 text-slate-300';

    const leftAccentBar =
      entry.status === 'removed' || entry.status === 'modified'
        ? 'border-l-4 border-l-rose-500'
        : '';
    const rightAccentBar =
      entry.status === 'added' || entry.status === 'modified'
        ? 'border-l-4 border-l-emerald-500'
        : '';

    return (
      <div
        key={entry.id}
        className={`border-b border-slate-800/80 last:border-b-0 transition-colors ${
          entry.status !== 'unchanged' ? 'bg-slate-900/50 hover:bg-slate-900/90' : 'hover:bg-slate-900/40'
        }`}
      >
        <div
          onClick={() =>
            setExpandedRowIds(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))
          }
          className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 lg:gap-3 p-3 sm:px-4 items-start cursor-pointer"
        >
          {/* Field Identity & Status */}
          <div className="lg:col-span-4 space-y-1.5 min-w-0">
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="mt-0.5 text-slate-500 hover:text-slate-300 shrink-0"
                aria-label="Toggle field details"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-100 break-words">
                    {entry.caption}
                  </span>
                  {renderStatusBadge(entry)}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] font-mono text-slate-400">
                  <span className="truncate max-w-[200px]" title={entry.name}>
                    {entry.name}
                  </span>
                  <span>·</span>
                  <span className="uppercase text-slate-500">{entry.fieldType}</span>
                  {entry.numericDelta !== undefined && (
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-semibold ${
                        entry.numericDelta > 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {entry.numericDelta > 0 ? (
                        <TrendingUp className="w-2.5 h-2.5" />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5" />
                      )}
                      <span>
                        {entry.numericDelta > 0 ? '+' : ''}
                        {entry.numericDelta.toLocaleString()}
                        {entry.numericPercentChange !== undefined
                          ? ` (${entry.numericDelta > 0 ? '+' : ''}${entry.numericPercentChange}%)`
                          : ''}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Document A Value (Left / Red on discrepancy) */}
          <div className="lg:col-span-4 min-w-0">
            <div className="lg:hidden text-[10px] font-mono uppercase tracking-wider text-rose-300/80 mb-1">
              Doc A · {docA?.filename}
            </div>
            <div
              className={`rounded-lg border px-3 py-2 text-xs font-mono min-h-[36px] flex items-center ${leftCellClass} ${leftAccentBar}`}
            >
              {entry.presence === 'only_b' ? (
                <span className="italic text-slate-500 text-[11px]">
                  — Field not present in Document A —
                </span>
              ) : (
                <InlineTokensView
                  tokens={entry.tokensA}
                  side="A"
                  emptyLabel="(empty)"
                />
              )}
            </div>
          </div>

          {/* Document B Value (Right / Green on discrepancy) */}
          <div className="lg:col-span-4 min-w-0">
            <div className="lg:hidden text-[10px] font-mono uppercase tracking-wider text-emerald-300/80 mb-1">
              Doc B · {docB?.filename}
            </div>
            <div
              className={`rounded-lg border px-3 py-2 text-xs font-mono min-h-[36px] flex items-center ${rightCellClass} ${rightAccentBar}`}
            >
              {entry.presence === 'only_a' ? (
                <span className="italic text-rose-300/75 text-[11px]">
                  — Field removed / absent in Document B —
                </span>
              ) : (
                <InlineTokensView
                  tokens={entry.tokensB}
                  side="B"
                  emptyLabel="(empty)"
                />
              )}
            </div>
          </div>
        </div>

        {/* Expanded Technical Metadata & Attribute Diff Drawer */}
        {isExpanded && (
          <div className="px-4 sm:px-9 pb-3.5 pt-1 text-[11px] bg-slate-950/60 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-400">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                XFA Binding &amp; Location
              </div>
              <div className="font-mono text-slate-300 break-all">
                Subform: {entry.subform}
              </div>
              {(entry.fieldA?.dataRef || entry.fieldB?.dataRef) && (
                <div className="font-mono text-slate-400 break-all">
                  SOM/DataRef: {entry.fieldA?.dataRef || entry.fieldB?.dataRef}
                </div>
              )}
              {(entry.fieldA?.bounds?.pageNumber || entry.fieldB?.bounds?.pageNumber) && (
                <div className="font-mono text-slate-400">
                  Page: {entry.fieldA?.bounds?.pageNumber || entry.fieldB?.bounds?.pageNumber}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Character &amp; Value Metrics
              </div>
              <div className="font-mono text-slate-300">
                Doc A length: {entry.valueA.length} chars · Doc B length: {entry.valueB.length} chars
              </div>
              {entry.fieldA?.required || entry.fieldB?.required ? (
                <div className="text-amber-300/90">
                  Required: Doc A ({entry.fieldA?.required ? 'Yes' : 'No'}) · Doc B ({entry.fieldB?.required ? 'Yes' : 'No'})
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Structural Attribute Changes
              </div>
              {entry.attributeChanges.length > 0 ? (
                <ul className="space-y-0.5 text-amber-300">
                  {entry.attributeChanges.map((chg, idx) => (
                    <li key={idx}>• {chg}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500">No structural attribute changes detected.</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5 text-slate-100">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500/20 to-emerald-500/20 border border-slate-700 flex items-center justify-center">
              <GitCompareArrows className="w-4 h-4 text-sky-400" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              XFA Field Diff &amp; Side-by-Side Comparison
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Select two XFA PDFs to inspect field-by-field discrepancies side by side. Removals &amp; baseline values appear in{' '}
            <span className="text-rose-300 font-semibold">red</span>; additions &amp; updated values appear in{' '}
            <span className="text-emerald-300 font-semibold">green</span>.
          </p>
        </div>

        {diffResult && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 text-sky-400" />
              <span>Export JSON</span>
            </button>
          </div>
        )}
      </div>

      {/* Dual Document Selector Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
        {renderSlotCard('A', docA)}

        <div className="flex lg:flex-col items-center justify-center">
          <button
            type="button"
            onClick={handleSwapDocuments}
            disabled={!docA && !docB}
            className="inline-flex items-center gap-1.5 px-3 py-2 lg:p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-sky-300 disabled:opacity-40 transition-colors cursor-pointer"
            title="Swap Document A and Document B"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span className="lg:hidden text-xs font-medium">Swap A ↔ B</span>
          </button>
        </div>

        {renderSlotCard('B', docB)}
      </div>

      {/* Empty Prompt when only 0 or 1 document loaded */}
      {(!docA || !docB) && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-3">
          <GitCompareArrows className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm font-semibold text-slate-200">
              {!docA && !docB
                ? 'Select two XFA PDF documents to begin comparison'
                : !docB
                ? 'Select Document B to compare against Document A'
                : 'Select Document A to compare against Document B'}
            </h3>
            <p className="text-xs text-slate-400">
              Upload any two XFA or AcroForm PDFs above, or click{' '}
              <strong className="text-emerald-300">Demo Revision</strong> on Document B to preview live red/green field diffing immediately.
            </p>
          </div>
          {docA && !docB && (
            <button
              type="button"
              onClick={handleLoadSimulatedRevisionB}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Sample Revised PDF in Slot B</span>
            </button>
          )}
        </div>
      )}

      {/* Full Comparison Dashboard */}
      {diffResult && docA && docB && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-800 border-sky-500/70 ring-1 ring-sky-500/30'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Total Fields
              </div>
              <div className="text-xl font-bold font-mono text-white mt-0.5">
                {diffResult.stats.totalCompared}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {diffResult.stats.similarityPercent}% identical
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('discrepancies')}
              className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                statusFilter === 'discrepancies'
                  ? 'bg-amber-950/50 border-amber-500/70 ring-1 ring-amber-500/30'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                Discrepancies
              </div>
              <div className="text-xl font-bold font-mono text-amber-200 mt-0.5">
                {diffResult.stats.discrepancyCount}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">All differences</div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('modified')}
              className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                statusFilter === 'modified'
                  ? 'bg-amber-950/40 border-amber-400/70 ring-1 ring-amber-400/30'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                Modified Values
              </div>
              <div className="text-xl font-bold font-mono text-amber-300 mt-0.5">
                {diffResult.stats.modifiedCount}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Red ↔ Green</div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('added')}
              className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                statusFilter === 'added'
                  ? 'bg-emerald-950/60 border-emerald-500/80 ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/80 border-emerald-900/50 hover:border-emerald-700/70'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                Added / Populated
              </div>
              <div className="text-xl font-bold font-mono text-emerald-300 mt-0.5">
                +{diffResult.stats.addedCount}
              </div>
              <div className="text-[10px] text-emerald-400/70 mt-0.5">New in Doc B</div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('removed')}
              className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                statusFilter === 'removed'
                  ? 'bg-rose-950/60 border-rose-500/80 ring-1 ring-rose-500/30'
                  : 'bg-slate-900/80 border-rose-900/50 hover:border-rose-700/70'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">
                Removed / Cleared
              </div>
              <div className="text-xl font-bold font-mono text-rose-300 mt-0.5">
                -{diffResult.stats.removedCount}
              </div>
              <div className="text-[10px] text-rose-400/70 mt-0.5">Missing in Doc B</div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('unchanged')}
              className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                statusFilter === 'unchanged'
                  ? 'bg-slate-800 border-slate-500 ring-1 ring-slate-500/30'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Identical
              </div>
              <div className="text-xl font-bold font-mono text-slate-200 mt-0.5">
                {diffResult.stats.identicalCount}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Exact match</div>
            </button>
          </div>

          {/* Visual Proportion Bar */}
          {diffResult.stats.totalCompared > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-slate-200">
                  Document Agreement Ratio: <span className="font-mono text-sky-400">{diffResult.stats.similarityPercent}%</span>
                </span>
                <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
                  <span className="flex items-center gap-1 text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Added ({diffResult.stats.addedCount})
                  </span>
                  <span className="flex items-center gap-1 text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Modified ({diffResult.stats.modifiedCount})
                  </span>
                  <span className="flex items-center gap-1 text-rose-300">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Removed ({diffResult.stats.removedCount})
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-600" />
                    Match ({diffResult.stats.identicalCount})
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex">
                {diffResult.stats.identicalCount > 0 && (
                  <div
                    className="bg-slate-600 h-full transition-all"
                    style={{
                      width: `${(diffResult.stats.identicalCount / diffResult.stats.totalCompared) * 100}%`,
                    }}
                  />
                )}
                {diffResult.stats.modifiedCount > 0 && (
                  <div
                    className="bg-amber-400 h-full transition-all"
                    style={{
                      width: `${(diffResult.stats.modifiedCount / diffResult.stats.totalCompared) * 100}%`,
                    }}
                  />
                )}
                {diffResult.stats.addedCount > 0 && (
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{
                      width: `${(diffResult.stats.addedCount / diffResult.stats.totalCompared) * 100}%`,
                    }}
                  />
                )}
                {diffResult.stats.removedCount > 0 && (
                  <div
                    className="bg-rose-500 h-full transition-all"
                    style={{
                      width: `${(diffResult.stats.removedCount / diffResult.stats.totalCompared) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Filter & Comparison Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search field name, caption, or value..."
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {diffResult.subformNames.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedSubform}
                    onChange={e => setSelectedSubform(e.target.value)}
                    className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 max-w-[210px]"
                  >
                    <option value="all">All Subforms ({diffResult.subformNames.length})</option>
                    {diffResult.subformNames.map(sf => (
                      <option key={sf} value={sf}>
                        {sf}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <button
                type="button"
                onClick={() =>
                  setStatusFilter(prev => (prev === 'discrepancies' ? 'all' : 'discrepancies'))
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === 'discrepancies'
                    ? 'bg-amber-950/70 border-amber-500/70 text-amber-200'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Discrepancies Only</span>
              </button>

              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={groupBySubform}
                  onChange={e => setGroupBySubform(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-950 text-sky-500"
                />
                <span>Group by Subform</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={ignoreCase}
                  onChange={e => setIgnoreCase(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-950 text-sky-500"
                />
                <span>Ignore Case</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={ignoreWhitespace}
                  onChange={e => setIgnoreWhitespace(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-950 text-sky-500"
                />
                <span>Trim Spaces</span>
              </label>
            </div>
          </div>

          {/* Side-by-Side Comparison Grid */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg">
            {/* Desktop Sticky Column Header */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider">
              <div className="col-span-4 text-slate-400">
                Form Field ({filteredEntries.length} shown)
              </div>
              <div className="col-span-4 flex items-center gap-1.5 text-rose-300 truncate">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span className="truncate" title={docA.filename}>
                  Doc A: {docA.filename}
                </span>
              </div>
              <div className="col-span-4 flex items-center gap-1.5 text-emerald-300 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate" title={docB.filename}>
                  Doc B: {docB.filename}
                </span>
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-200">
                  {statusFilter === 'discrepancies' && diffResult.stats.discrepancyCount === 0
                    ? 'Zero discrepancies found — both XFA documents have identical field values!'
                    : 'No fields match your current search or filter criteria.'}
                </p>
                {statusFilter !== 'all' || searchQuery || selectedSubform !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('all');
                      setSearchQuery('');
                      setSelectedSubform('all');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-sky-300 font-medium cursor-pointer"
                  >
                    Reset Filters
                  </button>
                ) : null}
              </div>
            ) : groupBySubform ? (
              <div>
                {groupedEntries.map(([subformName, items]) => {
                  const isCollapsed = Boolean(collapsedSubforms[subformName]);
                  const sectionDiffs = items.filter(i => i.status !== 'unchanged').length;
                  return (
                    <div key={subformName} className="border-b border-slate-800 last:border-b-0">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedSubforms(prev => ({
                            ...prev,
                            [subformName]: !prev[subformName],
                          }))
                        }
                        className="w-full flex items-center justify-between gap-2 px-4 py-2 bg-slate-900/90 hover:bg-slate-800/80 text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-200 truncate">
                            {subformName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            ({items.length} {items.length === 1 ? 'field' : 'fields'})
                          </span>
                        </div>
                        {sectionDiffs > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/35 shrink-0">
                            {sectionDiffs} {sectionDiffs === 1 ? 'discrepancy' : 'discrepancies'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-emerald-400/80 shrink-0">
                            All identical
                          </span>
                        )}
                      </button>

                      {!isCollapsed && <div>{items.map(renderDiffRow)}</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>{filteredEntries.map(renderDiffRow)}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
