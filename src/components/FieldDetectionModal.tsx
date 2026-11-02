import React, { useState, useEffect } from 'react';
import {
  Scan,
  Sparkles,
  Check,
  CheckCheck,
  X,
  Sliders,
  Layers,
  HelpCircle,
  AlertCircle,
  FileText,
  CheckSquare,
  ListFilter,
  Hash,
  Calendar,
  PenTool,
  Download,
  Filter,
  Search,
  ArrowRight,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { XFAField } from '../types/pdf';
import {
  DetectedFormField,
  DetectionScanSummary,
  DetectionScanOptions,
} from '../types/detection';
import { detectAllFormFields } from '../utils/formFieldDetector';

interface FieldDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array;
  currentFields: XFAField[];
  currentPage?: number;
  onAcceptFields?: (acceptedFields: DetectedFormField[]) => void;
  onNavigateToField?: (page: number, x: number, y: number) => void;
  onOpenConvertRegularPdf?: () => void;
}

export const FieldDetectionModal: React.FC<FieldDetectionModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  currentFields,
  currentPage = 1,
  onAcceptFields,
  onNavigateToField,
  onOpenConvertRegularPdf,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [summary, setSummary] = useState<DetectionScanSummary | null>(null);
  const [scanOptions, setScanOptions] = useState<DetectionScanOptions>({
    includeXfa: true,
    includeAcroForm: true,
    includeHeuristics: true,
    sensitivity: 'balanced',
    pageRange: 'all',
  });

  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPage, setFilterPage] = useState<number | 'all'>('all');
  const [filterSource, setFilterSource] = useState<string>('all');

  const runDetection = async (opts = scanOptions) => {
    setIsScanning(true);
    try {
      const res = await detectAllFormFields(pdfBytes, currentFields, {
        ...opts,
        currentPage,
      });
      setSummary(res);
      // Auto-select all detected fields
      setSelectedFieldIds(new Set(res.fields.map(f => f.id)));
    } catch (err) {
      console.error('Detection scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen && !summary) {
      runDetection();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedFieldIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!summary) return;
    if (selectedFieldIds.size === summary.fields.length) {
      setSelectedFieldIds(new Set());
    } else {
      setSelectedFieldIds(new Set(summary.fields.map(f => f.id)));
    }
  };

  const handleAcceptSelected = () => {
    if (!summary || !onAcceptFields) return;
    const toAccept = summary.fields.filter(f => selectedFieldIds.has(f.id));
    onAcceptFields(toAccept);
    onClose();
  };

  // Filtered fields list
  const filteredFields = (summary?.fields || []).filter(f => {
    if (filterType !== 'all' && f.type !== filterType) return false;
    if (filterPage !== 'all' && f.pageNumber !== filterPage) return false;
    if (filterSource !== 'all' && f.source !== filterSource) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        f.caption.toLowerCase().includes(q) ||
        (f.originalLabel && f.originalLabel.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getTypeIcon = (type: DetectedFormField['type']) => {
    switch (type) {
      case 'check':
        return <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />;
      case 'choice':
        return <ListFilter className="w-3.5 h-3.5 text-purple-400" />;
      case 'numeric':
        return <Hash className="w-3.5 h-3.5 text-amber-400" />;
      case 'date':
        return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      case 'signature':
        return <PenTool className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-sky-400" />;
    }
  };

  const getSourceBadge = (source: DetectedFormField['source']) => {
    switch (source) {
      case 'xfa_template':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 font-mono font-medium">
            XFA Schema
          </span>
        );
      case 'acroform_widget':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono font-medium">
            AcroForm Widget
          </span>
        );
      case 'heuristic_analysis':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono font-medium">
            Visual Heuristic
          </span>
        );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Scan className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-slate-100">
                  Form Field Detection &amp; Auto-Recognition
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Multi-Tier Scanner
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Scans XFA bindings, AcroForm widgets, and visual text layouts to locate and classify form controls
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

        {/* Scan Summary Ribbon */}
        {summary && (
          <>
            {summary.isDynamicXfaFallback && (
              <div className="bg-amber-950/40 border-b border-amber-800/60 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Dynamic LiveCycle XFA PDF Detected:</strong> Successfully auto-detected <strong>{summary.totalDetected} interactive fields</strong> from XML Form Architecture.
                  </span>
                </div>
                {onOpenConvertRegularPdf && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenConvertRegularPdf();
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-500 rounded-md transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <span>Convert to Regular PDF</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
            <div className="bg-slate-950/60 border-b border-slate-800 px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Total Detected</span>
                <span className="text-base font-bold text-sky-400">{summary.totalDetected} fields</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Sources</span>
                <span className="text-slate-200 font-mono text-[11px]">
                  {summary.bySource.xfa} XFA · {summary.bySource.acroform} Acro · {summary.bySource.heuristic} Heuristic
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Avg. Confidence</span>
                <span className="text-emerald-400 font-bold">{Math.round(summary.averageConfidence * 100)}%</span>
              </div>
              <div className="flex items-center justify-end">
                <button
                  onClick={() => runDetection()}
                  disabled={isScanning}
                  className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'Scanning...' : 'Rescan'}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search detected fields by name or label..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="text">Text Fields</option>
              <option value="check">Checkboxes</option>
              <option value="choice">Dropdowns</option>
              <option value="numeric">Numeric</option>
              <option value="date">Dates</option>
              <option value="signature">Signatures</option>
              <option value="multiline">Multi-line</option>
            </select>

            <select
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
            >
              <option value="all">All Sources</option>
              <option value="xfa_template">XFA Schema</option>
              <option value="acroform_widget">AcroForm Widgets</option>
              <option value="heuristic_analysis">Visual Heuristic</option>
            </select>

            <select
              value={filterPage}
              onChange={e => setFilterPage(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-slate-950 border border-slate-700/80 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
            >
              <option value="all">All Pages</option>
              {Array.from(new Set((summary?.fields || []).map(f => f.pageNumber)))
                .sort((a, b) => a - b)
                .map(p => (
                  <option key={p} value={p}>Page {p}</option>
                ))}
            </select>
          </div>
        </div>

        {/* Fields List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isScanning ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">Scanning PDF text layers, XFA template, and layout geometries...</p>
              <p className="text-[11px] text-slate-500">Detecting form controls, checkboxes, and fillable fields</p>
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800/80 p-6">
              No form fields matching current search or filters.
            </div>
          ) : (
            filteredFields.map(f => {
              const isSelected = selectedFieldIds.has(f.id);

              return (
                <div
                  key={f.id}
                  className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'bg-slate-950/80 border-sky-500/40 shadow-xs'
                      : 'bg-slate-950/40 border-slate-800/60 opacity-70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(f.id)}
                    className="mt-1 rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 cursor-pointer"
                  />

                  <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 shrink-0 mt-0.5">
                    {getTypeIcon(f.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-100 truncate">
                          {f.caption || f.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Page {f.pageNumber}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {getSourceBadge(f.source)}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                            f.confidence >= 0.95
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : f.confidence >= 0.85
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-sky-950 text-sky-300 border border-sky-800'
                          }`}
                        >
                          {Math.round(f.confidence * 100)}% Confidence
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                      <span>Name: <strong className="text-slate-300">{f.name}</strong></span>
                      <span>•</span>
                      <span>
                        Bounds: [x:{Math.round(f.bounds.x)}, y:{Math.round(f.bounds.y)}, w:{Math.round(f.bounds.width)}, h:{Math.round(f.bounds.height)}]
                      </span>
                      {f.value && (
                        <>
                          <span>•</span>
                          <span>Value: <strong className="text-sky-300">{f.value}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  {onNavigateToField && (
                    <button
                      onClick={() => onNavigateToField(f.pageNumber, f.bounds.x, f.bounds.y)}
                      className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition-colors shrink-0"
                      title="Jump to this field on PDF canvas"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px]"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>
                {selectedFieldIds.size === (summary?.fields.length || 0)
                  ? 'Deselect All'
                  : 'Select All'}
              </span>
            </button>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 text-[11px]">
              {selectedFieldIds.size} of {summary?.fields.length || 0} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenConvertRegularPdf && (
              <button
                onClick={() => {
                  onClose();
                  onOpenConvertRegularPdf();
                }}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Convert XFA to Regular PDF</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {onAcceptFields && (
              <button
                onClick={handleAcceptSelected}
                disabled={selectedFieldIds.size === 0}
                className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Accept &amp; Import Fields ({selectedFieldIds.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
