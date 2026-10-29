import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  CheckCircle,
  FileText,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  PenTool,
  HelpCircle,
  Hash,
  Calendar,
  CheckSquare,
  Square,
  MinusSquare,
  ListFilter,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Eraser,
  Edit3,
  Layers,
  X,
  Check,
  Filter,
  ShieldAlert,
  ShieldCheck,
  Zap,
  ArrowRight,
  Info,
  Undo2,
  Redo2,
  Sliders,
  Lightbulb,
  History,
} from 'lucide-react';
import { XFASubform, XFAField, ValidationError } from '../types/pdf';
import { validateAllFields, quickFixFieldValue } from '../utils/validationEngine';
import { useFormHistory, HistoryEntry } from '../hooks/useFormHistory';
import { BeginnerFormWizard } from './BeginnerFormWizard';
import { FieldTooltipPopover } from './FieldTooltipPopover';

export interface BulkFieldUpdates {
  readOnly?: boolean;
  visibility?: 'visible' | 'invisible' | 'hidden';
  required?: boolean;
  resetValues?: boolean;
  clearValues?: boolean;
  setValue?: string;
}

interface XfaFormEditorProps {
  subforms: XFASubform[];
  hasXfa: boolean;
  onFieldValueChange: (fieldId: string, newValue: string) => void;
  onAutofillSample: () => void;
  onResetDefaults: () => void;
  onLoadSampleXfa: () => void;
  onSwitchToResources: () => void;
  onBulkUpdateFields?: (fieldIds: string[], updates: BulkFieldUpdates) => void;
  onExportPdf?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  history?: HistoryEntry[];
  currentIndex?: number;
  jumpToHistoryIndex?: (index: number) => void;
}

export const XfaFormEditor: React.FC<XfaFormEditorProps> = ({
  subforms,
  hasXfa,
  onFieldValueChange,
  onAutofillSample,
  onResetDefaults,
  onLoadSampleXfa,
  onSwitchToResources,
  onBulkUpdateFields,
  onExportPdf,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  history,
  currentIndex,
  jumpToHistoryIndex,
}) => {
  const [editorMode, setEditorMode] = useState<'beginner' | 'advanced'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xfa_editor_mode');
      if (saved === 'advanced' || saved === 'beginner') return saved;
    }
    return 'beginner';
  });

  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    localStorage.setItem('xfa_editor_mode', editorMode);
  }, [editorMode]);

  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [activeSignatureField, setActiveSignatureField] = useState<string | null>(null);

  // Bulk Edit Mode States
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());
  const [setValueModalOpen, setSetValueModalOpen] = useState(false);
  const [batchValueInput, setBatchValueInput] = useState('');

  // Validation Engine States
  const [showOnlyInvalid, setShowOnlyInvalid] = useState(false);
  const [isValidationDrawerOpen, setIsValidationDrawerOpen] = useState(false);
  const [validationToast, setValidationToast] = useState<string | null>(null);

  // Internal history tracker fallback if not provided by parent
  const internalHistory = useFormHistory({
    onApplyValue: onFieldValueChange,
    onNotify: (msg) => {
      setValidationToast(msg);
      setTimeout(() => setValidationToast(null), 3500);
    },
  });

  const activeCanUndo = canUndo !== undefined ? canUndo : internalHistory.canUndo;
  const activeCanRedo = canRedo !== undefined ? canRedo : internalHistory.canRedo;
  const activeUndo = onUndo || internalHistory.undo;
  const activeRedo = onRedo || internalHistory.redo;
  const activeHistory = history || internalHistory.history;
  const activeCurrentIndex = currentIndex !== undefined ? currentIndex : internalHistory.currentIndex;
  const activeJumpToHistory = jumpToHistoryIndex || internalHistory.jumpToHistoryIndex;

  // Keyboard shortcut listener for Alt+B to switch modes
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setEditorMode(prev => (prev === 'beginner' ? 'advanced' : 'beginner'));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Flattened list of all fields across all subforms
  const allFields = useMemo(() => {
    const list: XFAField[] = [];
    const collect = (sfList: XFASubform[]) => {
      sfList.forEach(sf => {
        list.push(...sf.fields);
        if (sf.subforms.length > 0) collect(sf.subforms);
      });
    };
    collect(subforms);
    return list;
  }, [subforms]);

  // Execute field validation engine across all fields and subforms
  const validationReport = useMemo(() => {
    return validateAllFields(allFields);
  }, [allFields]);

  // Filter subforms and fields based on search query and validation filter
  const filteredSubforms = useMemo(() => {
    let list = subforms;

    // Filter only invalid fields if requested
    if (showOnlyInvalid) {
      list = list
        .map(sf => {
          const invalidFields = sf.fields.filter(f => validationReport.fieldErrorMap.has(f.id));
          const invalidChildren = sf.subforms.filter(c => c.fields.some(f => validationReport.fieldErrorMap.has(f.id)));
          if (invalidFields.length > 0 || invalidChildren.length > 0) {
            return {
              ...sf,
              fields: invalidFields,
              subforms: invalidChildren,
            };
          }
          return null;
        })
        .filter(Boolean) as XFASubform[];
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();

    return list
      .map(sf => {
        const matchingFields = sf.fields.filter(
          f =>
            f.name.toLowerCase().includes(q) ||
            f.caption.toLowerCase().includes(q) ||
            f.value.toLowerCase().includes(q) ||
            (f.dataRef && f.dataRef.toLowerCase().includes(q))
        );
        const matchingSubforms = sf.subforms.filter(child =>
          child.fields.some(
            f =>
              f.name.toLowerCase().includes(q) ||
              f.caption.toLowerCase().includes(q) ||
              f.value.toLowerCase().includes(q)
          )
        );

        if (
          matchingFields.length > 0 ||
          matchingSubforms.length > 0 ||
          sf.title.toLowerCase().includes(q)
        ) {
          return {
            ...sf,
            fields: matchingFields.length > 0 ? matchingFields : sf.fields,
            subforms: matchingSubforms,
          };
        }
        return null;
      })
      .filter(Boolean) as XFASubform[];
  }, [subforms, searchQuery, showOnlyInvalid, validationReport]);

  const handleAutoFixAll = () => {
    let fixedCount = 0;
    validationReport.errors.concat(validationReport.warnings).forEach(err => {
      const field = allFields.find(f => f.id === err.fieldId);
      if (field) {
        const fixedVal = quickFixFieldValue(field, err);
        if (fixedVal !== null && fixedVal !== field.value) {
          onFieldValueChange(field.id, fixedVal);
          fixedCount++;
        }
      }
    });
    setValidationToast(fixedCount > 0 ? `Auto-fixed ${fixedCount} fields to conform with XFA picture patterns.` : 'No auto-fixable format errors found.');
    setTimeout(() => setValidationToast(null), 3500);
  };


  // Total and filled field counters
  const totalFields = allFields.length;
  const filledFields = useMemo(() => {
    return allFields.filter(f => f.value && f.value.trim().length > 0 && f.value !== '0').length;
  }, [allFields]);

  // Bulk Selection Handlers
  const handleToggleField = (id: string) => {
    setSelectedFieldIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSubform = (sf: XFASubform) => {
    const subformFieldIds: string[] = [];
    const collect = (item: XFASubform) => {
      item.fields.forEach(f => subformFieldIds.push(f.id));
      item.subforms.forEach(collect);
    };
    collect(sf);

    const allSelected = subformFieldIds.every(id => selectedFieldIds.has(id));

    setSelectedFieldIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        subformFieldIds.forEach(id => next.delete(id));
      } else {
        subformFieldIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const next = new Set<string>();
    allFields.forEach(f => next.add(f.id));
    setSelectedFieldIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedFieldIds(new Set());
  };

  const handleInvertSelection = () => {
    setSelectedFieldIds(prev => {
      const next = new Set<string>();
      allFields.forEach(f => {
        if (!prev.has(f.id)) next.add(f.id);
      });
      return next;
    });
  };

  const handleSelectByType = (type: XFAField['type']) => {
    const next = new Set<string>();
    allFields.forEach(f => {
      if (f.type === type) next.add(f.id);
    });
    setSelectedFieldIds(next);
  };

  const handleSelectByCondition = (condition: 'required' | 'readOnly' | 'empty' | 'hidden') => {
    const next = new Set<string>();
    allFields.forEach(f => {
      if (condition === 'required' && f.required) next.add(f.id);
      else if (condition === 'readOnly' && f.readOnly) next.add(f.id);
      else if (condition === 'empty' && (!f.value || f.value.trim() === '' || f.value === '0')) next.add(f.id);
      else if (condition === 'hidden' && (f.visibility === 'hidden' || f.visibility === 'invisible')) next.add(f.id);
    });
    setSelectedFieldIds(next);
  };

  const applyBulkUpdate = (updates: BulkFieldUpdates) => {
    if (selectedFieldIds.size === 0) return;
    onBulkUpdateFields?.(Array.from(selectedFieldIds), updates);
  };

  const handleApplyBatchValue = () => {
    applyBulkUpdate({ setValue: batchValueInput });
    setSetValueModalOpen(false);
    setBatchValueInput('');
  };

  const handleFieldChange = (fieldId: string, newValue: string) => {
    const target = allFields.find(f => f.id === fieldId);
    if (target && !onUndo) {
      internalHistory.recordChange(
        fieldId,
        target.name,
        target.caption || target.name,
        target.value || '',
        newValue
      );
    }
    onFieldValueChange(fieldId, newValue);
  };

  if (!hasXfa || subforms.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-lg font-semibold text-slate-100">
              No Dynamic XFA Form Architecture Detected
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              This file is a standard PDF without embedded XML Forms Architecture (<code className="text-slate-300 font-mono text-xs">/XFA</code>) packets.
              You can explore the PDF pages, or extract all embedded resources (images, fonts, attachments, and text).
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onLoadSampleXfa}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors shadow-sm"
            >
              Load Sample Dynamic XFA Form
            </button>
            <button
              onClick={onSwitchToResources}
              className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              Extract Resources from this PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  // BEGINNER MODE PRESENTATION
  if (editorMode === 'beginner') {
    return (
      <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-5 pb-24">
        {/* Beginner Top Mode Switcher Bar */}
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-300">Editor Experience:</span>
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
              <button
                onClick={() => setEditorMode('beginner')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs"
              >
                <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
                <span>Simple Mode (Beginner)</span>
              </button>
              <button
                onClick={() => setEditorMode('advanced')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                title="Switch to full power editor with XML, trees, and bulk editing"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Power / Advanced View</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">Alt+B</kbd> to toggle view
            </span>
            {onExportPdf && (
              <button
                onClick={onExportPdf}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-xs"
              >
                Save Filled PDF
              </button>
            )}
          </div>
        </div>

        <BeginnerFormWizard
          subforms={subforms}
          allFields={allFields}
          onFieldValueChange={handleFieldChange}
          onAutofillSample={onAutofillSample}
          onResetDefaults={onResetDefaults}
          canUndo={activeCanUndo}
          canRedo={activeCanRedo}
          onUndo={activeUndo}
          onRedo={activeRedo}
          history={activeHistory}
          currentIndex={activeCurrentIndex}
          onExportPdf={onExportPdf}
          onSwitchToAdvanced={() => setEditorMode('advanced')}
        />
      </div>
    );
  }

  // ADVANCED POWER EDITOR PRESENTATION
  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-5 pb-24">
      {/* Top Banner & Quick Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-100">
              XFA Interactive Form Editor
            </h1>
            <span className="text-xs text-sky-400 font-mono bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-sm">
              Live Two-Way Sync
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Form modifications update the XML <code className="font-mono text-slate-300">&lt;datasets&gt;</code> packet and will be saved directly into the PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 mr-1">
            <button
              onClick={() => setEditorMode('beginner')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              title="Switch to Simple Beginner Wizard view"
            >
              <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simple Mode</span>
            </button>
            <button
              onClick={() => setEditorMode('advanced')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-xs"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Advanced</span>
            </button>
          </div>

          {/* History Undo Button */}
          <button
            onClick={activeUndo}
            disabled={!activeCanUndo}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeCanUndo
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-xs'
                : 'bg-slate-900/60 text-slate-500 border border-slate-800/60 cursor-not-allowed'
            }`}
            title="Undo last field change (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Undo</span>
            {activeCanUndo && (
              <span className="text-[10px] bg-slate-950 text-sky-300 px-1.5 py-0.2 rounded font-mono font-bold">
                {activeCurrentIndex + 1}
              </span>
            )}
          </button>

          {/* History Redo Button */}
          <button
            onClick={activeRedo}
            disabled={!activeCanRedo}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeCanRedo
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-xs'
                : 'bg-slate-900/60 text-slate-500 border border-slate-800/60 cursor-not-allowed'
            }`}
            title="Redo previously undone change (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Redo</span>
            {activeCanRedo && (
              <span className="text-[10px] bg-slate-950 text-sky-300 px-1.5 py-0.2 rounded font-mono font-bold">
                {activeHistory.length - activeCurrentIndex - 1}
              </span>
            )}
          </button>

          {/* History Log Popover Button */}
          <button
            onClick={() => setShowHistoryModal(prev => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all ${
              showHistoryModal
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
            }`}
            title="View last 10 changes history log"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>History</span>
            <span className="text-[10px] text-slate-400 font-mono">
              ({activeHistory.length})
            </span>
          </button>

          {/* Bulk Edit Toggle Button */}
          <button
            onClick={() => {
              if (isBulkMode) {
                setIsBulkMode(false);
                setSelectedFieldIds(new Set());
              } else {
                setIsBulkMode(true);
              }
            }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all shadow-xs ${
              isBulkMode
                ? 'bg-sky-500 text-slate-950 font-semibold border border-sky-400'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Toggle Bulk Edit mode to select and modify multiple fields at once"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isBulkMode ? 'Bulk Edit Active' : 'Bulk Edit Mode'}</span>
            {isBulkMode && selectedFieldIds.size > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950 text-sky-300 font-mono font-bold">
                {selectedFieldIds.size}
              </span>
            )}
          </button>

          <button
            onClick={onAutofillSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
            title="Autofill form with realistic compliance test values"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Autofill Sample</span>
          </button>
          <button
            onClick={onResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors"
            title="Reset all fields to their original values"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 10-Step History Log Dialog / Drawer */}
      {showHistoryModal && (
        <div className="bg-slate-900 border border-sky-700/60 rounded-xl p-4 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Local State History Tracker (Last 10 Changes)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400">
                Current State: Step {activeCurrentIndex + 1} of {activeHistory.length}
              </span>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {activeHistory.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No field modifications recorded yet. Edit any field to start tracking history up to 10 changes.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs">
              {activeHistory.map((entry, idx) => {
                const isCurrent = idx === activeCurrentIndex;
                const isPast = idx <= activeCurrentIndex;
                const timeAgo = Math.round((Date.now() - entry.timestamp) / 1000);

                return (
                  <div
                    key={entry.id}
                    className={`p-2 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                      isCurrent
                        ? 'bg-sky-950/40 border-sky-500/80 text-sky-100 ring-1 ring-sky-500/30'
                        : isPast
                        ? 'bg-slate-900/70 border-slate-800 text-slate-300'
                        : 'bg-slate-950/40 border-slate-900 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate text-[11px] flex items-center gap-1.5">
                          <span>{entry.fieldCaption || entry.fieldName}</span>
                          {isCurrent && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-500 text-slate-950 font-bold">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate">
                          <span className="line-through text-slate-500">{entry.prevValue || 'empty'}</span>
                          <span className="mx-1 text-sky-400">&rarr;</span>
                          <span className="text-slate-200">{entry.nextValue || 'empty'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {timeAgo < 60 ? `${timeAgo}s ago` : `${Math.round(timeAgo / 60)}m ago`}
                      </span>
                      {!isCurrent && (
                        <button
                          onClick={() => activeJumpToHistory(idx)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-medium border border-slate-700 transition-colors"
                        >
                          Jump here
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Field Validation Engine Status Ribbon */}
      <div className={`rounded-xl border transition-all p-4 ${
        validationReport.errorCount > 0
          ? 'bg-rose-950/20 border-rose-800/60 shadow-xs'
          : validationReport.warningCount > 0
          ? 'bg-amber-950/20 border-amber-800/60'
          : 'bg-emerald-950/20 border-emerald-800/50'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {validationReport.errorCount > 0 ? (
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              </div>
            ) : validationReport.warningCount > 0 ? (
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-100">
                  XFA Field Validation Engine
                </span>
                {validationReport.errorCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-900/80 text-rose-200 border border-rose-700">
                    {validationReport.errorCount} {validationReport.errorCount === 1 ? 'Error' : 'Errors'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-900/80 text-emerald-200 border border-emerald-700">
                    Compliant
                  </span>
                )}
                {validationReport.warningCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-900/80 text-amber-200 border border-amber-700">
                    {validationReport.warningCount} {validationReport.warningCount === 1 ? 'Warning' : 'Warnings'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {validationReport.errorCount > 0
                  ? `Identified ${validationReport.errorCount} constraint ${validationReport.errorCount === 1 ? 'violation' : 'violations'} against XFA picture clauses, null tests, and business logic.`
                  : validationReport.warningCount > 0
                  ? `All mandatory fields filled. ${validationReport.warningCount} advisory ${validationReport.warningCount === 1 ? 'warning requires' : 'warnings require'} verification.`
                  : 'All fields satisfy XFA XML validation patterns, formatting picture clauses, and cross-field balance constraints.'}
              </p>
            </div>
          </div>

          {/* Validation Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Auto-Fix button if any fixes are possible */}
            <button
              onClick={handleAutoFixAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg transition-colors"
              title="Automatically standardize phone formats, postal codes, and calendar dates"
            >
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span>Auto-Fix Formats</span>
            </button>

            {/* Filter Invalid Fields toggle */}
            <button
              onClick={() => setShowOnlyInvalid(!showOnlyInvalid)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border ${
                showOnlyInvalid
                  ? 'bg-rose-500 text-slate-950 font-semibold border-rose-400'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{showOnlyInvalid ? 'Showing Invalid Only' : 'Filter Invalid Fields'}</span>
            </button>

            {/* Inspect All Issues Drawer Toggle */}
            <button
              onClick={() => setIsValidationDrawerOpen(!isValidationDrawerOpen)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border ${
                isValidationDrawerOpen
                  ? 'bg-slate-700 text-slate-100 border-slate-600'
                  : 'bg-slate-800 text-slate-300 hover:text-slate-100 border-slate-700'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>
                {isValidationDrawerOpen ? 'Close Issues' : `Inspect Issues (${validationReport.allIssues.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* Temporary Auto-Fix Toast */}
        {validationToast && (
          <div className="mt-2.5 px-3 py-1.5 bg-sky-950/90 border border-sky-700 rounded-lg text-xs text-sky-200 flex items-center gap-2 animate-in fade-in duration-150">
            <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>{validationToast}</span>
          </div>
        )}

        {/* Expandable Validation Issues Drawer */}
        {isValidationDrawerOpen && (
          <div className="mt-3.5 pt-3.5 border-t border-slate-800 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
              <span>Active Validation Constraints Breakdown:</span>
              <span className="text-[11px] font-mono text-slate-400">
                {validationReport.errors.length} errors, {validationReport.warnings.length} warnings
              </span>
            </div>

            {validationReport.allIssues.length === 0 ? (
              <p className="text-xs text-emerald-400 py-2 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>No validation errors detected. All fields comply with XFA specifications.</span>
              </p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {validationReport.allIssues.map(issue => (
                  <div
                    key={issue.id}
                    className={`flex items-start justify-between gap-3 p-2 rounded-lg border text-xs ${
                      issue.severity === 'error'
                        ? 'bg-rose-950/40 border-rose-900/60 text-rose-200'
                        : issue.severity === 'warning'
                        ? 'bg-amber-950/30 border-amber-900/50 text-amber-200'
                        : 'bg-sky-950/30 border-sky-900/50 text-sky-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {issue.severity === 'error' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-200">
                            {issue.fieldCaption || issue.fieldName}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900/80 text-slate-300 border border-slate-700">
                            {issue.ruleType.replace('_', ' ')}
                          </span>
                          {issue.expectedPattern && (
                            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800">
                              Pattern: {issue.expectedPattern}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">{issue.message}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const elem = document.getElementById(`field-${issue.fieldId}`);
                        if (elem) {
                          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          elem.focus();
                        }
                      }}
                      className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:underline"
                    >
                      <span>Jump</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Edit Dedicated Action & Selection Controls Bar */}
      {isBulkMode && (
        <div className="bg-sky-950/30 border border-sky-800/70 rounded-xl p-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="font-semibold text-slate-200">
                Bulk Selection Tools:
              </span>
              <span className="text-slate-400 font-mono">
                {selectedFieldIds.size} of {totalFields} fields selected
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={handleSelectAll}
                className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
              >
                Select All
              </button>
              <button
                onClick={handleDeselectAll}
                disabled={selectedFieldIds.size === 0}
                className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md transition-colors disabled:opacity-40"
              >
                Clear
              </button>
              <button
                onClick={handleInvertSelection}
                className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md transition-colors"
              >
                Invert
              </button>
            </div>
          </div>

          {/* Quick Category Selectors */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-sky-900/40 text-[11px]">
            <span className="text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3 text-sky-400" /> Quick Select:
            </span>
            <button
              onClick={() => handleSelectByType('text')}
              className="px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              Text fields
            </button>
            <button
              onClick={() => handleSelectByType('numeric')}
              className="px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              Numeric
            </button>
            <button
              onClick={() => handleSelectByType('check')}
              className="px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              Checkboxes
            </button>
            <button
              onClick={() => handleSelectByCondition('required')}
              className="px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              Required only
            </button>
            <button
              onClick={() => handleSelectByCondition('readOnly')}
              className="px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              Read-Only only
            </button>
            <button
              onClick={() => handleSelectByCondition('empty')}
              className="px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              Unfilled / Empty
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-lg px-3.5 py-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search fields by title, variable name, or XML binding..."
            className="w-full bg-slate-950/60 border border-slate-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono shrink-0">
          <span>
            <strong className="text-slate-200 font-semibold">{filledFields}</strong> / {totalFields} fields filled
          </span>
        </div>
      </div>

      {/* Subform Sections */}
      <div className="space-y-4">
        {filteredSubforms.map(subform => (
          <SubformSection
            key={subform.id}
            subform={subform}
            isCollapsed={Boolean(collapsedSections[subform.id])}
            onToggle={() => toggleSection(subform.id)}
            onFieldValueChange={handleFieldChange}
            activeSignatureField={activeSignatureField}
            setActiveSignatureField={setActiveSignatureField}
            isBulkMode={isBulkMode}
            selectedFieldIds={selectedFieldIds}
            onToggleField={handleToggleField}
            onToggleSubform={handleToggleSubform}
            fieldErrorMap={validationReport.fieldErrorMap}
          />
        ))}

        {filteredSubforms.length === 0 && (
          <div className="text-center py-10 bg-slate-900/40 border border-slate-800 rounded-xl">
            <p className="text-sm text-slate-400">No form fields matched "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs text-sky-400 hover:underline"
            >
              Clear search filter
            </button>
          </div>
        )}
      </div>

      {/* Sticky Bottom Floating Bulk Actions Bar */}
      {isBulkMode && selectedFieldIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-4xl w-[94%] bg-slate-900/95 border border-slate-700 shadow-2xl rounded-2xl p-3.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-150">
          {/* Selected Count */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-sky-300 bg-sky-950/90 border border-sky-800 px-2.5 py-1 rounded-md font-mono">
              {selectedFieldIds.size} {selectedFieldIds.size === 1 ? 'field' : 'fields'} selected
            </span>
          </div>

          {/* Action Button Groups */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Read-Only Status Group */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/60 p-0.5">
              <button
                onClick={() => applyBulkUpdate({ readOnly: true })}
                title="Mark selected fields as Read-Only in XFA template (access='readOnly')"
                className="px-2.5 py-1 text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1"
              >
                <Lock className="w-3 h-3" />
                <span>Read-Only</span>
              </button>
              <button
                onClick={() => applyBulkUpdate({ readOnly: false })}
                title="Make selected fields editable (access='open')"
                className="px-2.5 py-1 text-xs font-medium text-emerald-300 hover:text-emerald-200 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1"
              >
                <Unlock className="w-3 h-3" />
                <span>Editable</span>
              </button>
            </div>

            {/* Visibility Group */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/60 p-0.5">
              <button
                onClick={() => applyBulkUpdate({ visibility: 'visible' })}
                title="Set presence='visible' (normal visibility)"
                className="px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1"
              >
                <Eye className="w-3 h-3 text-sky-400" />
                <span>Visible</span>
              </button>
              <button
                onClick={() => applyBulkUpdate({ visibility: 'invisible' })}
                title="Set presence='invisible' (reserves layout space but invisible)"
                className="px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1"
              >
                <EyeOff className="w-3 h-3 text-slate-400" />
                <span>Invisible</span>
              </button>
              <button
                onClick={() => applyBulkUpdate({ visibility: 'hidden' })}
                title="Set presence='hidden' (removed from layout & rendering)"
                className="px-2 py-1 text-xs font-medium text-rose-300 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1"
              >
                <EyeOff className="w-3 h-3 text-rose-400" />
                <span>Hidden</span>
              </button>
            </div>

            {/* Required Status Group */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/60 p-0.5">
              <button
                onClick={() => applyBulkUpdate({ required: true })}
                title="Mark selected fields as mandatory (validate nullTest='error')"
                className="px-2 py-1 text-xs font-medium text-rose-300 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1"
              >
                <span>Required</span>
              </button>
              <button
                onClick={() => applyBulkUpdate({ required: false })}
                title="Mark selected fields as optional"
                className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
              >
                Optional
              </button>
            </div>

            {/* Values Group */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => applyBulkUpdate({ resetValues: true })}
                title="Reset all selected fields to their default template values"
                className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
              <button
                onClick={() => applyBulkUpdate({ clearValues: true })}
                title="Clear content of all selected fields"
                className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Eraser className="w-3 h-3" />
                <span>Clear</span>
              </button>
              <button
                onClick={() => setSetValueModalOpen(true)}
                title="Apply a common custom value to all selected fields"
                className="px-2.5 py-1 text-xs font-medium bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-600/40 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                <span>Set Value...</span>
              </button>
            </div>
          </div>

          {/* Dismiss selection button */}
          <button
            onClick={handleDeselectAll}
            aria-label="Clear bulk selection"
            title="Deselect all"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Set Common Value Dialog Modal */}
      {setValueModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-100">Set Common Value</h3>
              </div>
              <button
                onClick={() => setSetValueModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Apply this value across all <strong className="text-sky-300">{selectedFieldIds.size} selected fields</strong> simultaneously:
            </p>

            <div className="space-y-2">
              <input
                type="text"
                autoFocus
                value={batchValueInput}
                onChange={e => setBatchValueInput(e.target.value)}
                placeholder="Enter value (e.g. N/A, Verified, Compliant)..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleApplyBatchValue();
                  else if (e.key === 'Escape') setSetValueModalOpen(false);
                }}
              />

              {/* Quick suggestions */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                <span className="text-slate-500 text-[10px]">Quick:</span>
                {['N/A', 'Compliant', 'Approved', 'Pending Review', '1', '0'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBatchValueInput(val)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-300 font-mono"
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSetValueModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyBatchValue}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors shadow-xs"
              >
                Apply to {selectedFieldIds.size} Fields
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SubformSectionProps {
  subform: XFASubform;
  isCollapsed: boolean;
  onToggle: () => void;
  onFieldValueChange: (fieldId: string, newValue: string) => void;
  activeSignatureField: string | null;
  setActiveSignatureField: (fieldId: string | null) => void;
  isBulkMode: boolean;
  selectedFieldIds: Set<string>;
  onToggleField: (fieldId: string) => void;
  onToggleSubform: (subform: XFASubform) => void;
  fieldErrorMap: Map<string, ValidationError[]>;
}

const SubformSection: React.FC<SubformSectionProps> = ({
  subform,
  isCollapsed,
  onToggle,
  onFieldValueChange,
  activeSignatureField,
  setActiveSignatureField,
  isBulkMode,
  selectedFieldIds,
  onToggleField,
  onToggleSubform,
  fieldErrorMap,
}) => {
  // Compute subform selection state
  const subformFieldIds = useMemo(() => {
    const ids: string[] = [];
    const collect = (sf: XFASubform) => {
      sf.fields.forEach(f => ids.push(f.id));
      sf.subforms.forEach(collect);
    };
    collect(subform);
    return ids;
  }, [subform]);

  const selectedCountInSection = useMemo(() => {
    return subformFieldIds.filter(id => selectedFieldIds.has(id)).length;
  }, [subformFieldIds, selectedFieldIds]);

  const errorCountInSection = useMemo(() => {
    return subformFieldIds.filter(id => {
      const issues = fieldErrorMap.get(id);
      return issues && issues.some(i => i.severity === 'error');
    }).length;
  }, [subformFieldIds, fieldErrorMap]);

  const isAllSelected = subformFieldIds.length > 0 && selectedCountInSection === subformFieldIds.length;
  const isPartiallySelected = selectedCountInSection > 0 && selectedCountInSection < subformFieldIds.length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all">
      {/* Section Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 bg-slate-900/80 hover:bg-slate-800/50 border-b border-slate-800/80 select-none"
      >
        <div className="flex items-center gap-3">
          {/* Section Bulk Checkbox */}
          {isBulkMode && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onToggleSubform(subform);
              }}
              title={isAllSelected ? 'Deselect section fields' : 'Select all fields in this section'}
              className="text-sky-400 hover:text-sky-300 p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-sky-400"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-sky-400" />
              ) : isPartiallySelected ? (
                <MinusSquare className="w-4 h-4 text-sky-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500 hover:text-slate-300" />
              )}
            </button>
          )}

          <div onClick={onToggle} className="flex items-center gap-2.5 cursor-pointer">
            <button className="text-slate-400 hover:text-slate-200 transition-colors pointer-events-none">
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>{subform.title}</span>
                {errorCountInSection > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                    <AlertCircle className="w-2.5 h-2.5" />
                    <span>{errorCountInSection} {errorCountInSection === 1 ? 'error' : 'errors'}</span>
                  </span>
                )}
                {isBulkMode && selectedCountInSection > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800">
                    {selectedCountInSection}/{subformFieldIds.length} selected
                  </span>
                )}
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                subform: {subform.name}
              </span>
            </div>
          </div>
        </div>

        <div onClick={onToggle} className="flex items-center gap-2 text-xs text-slate-400 font-mono cursor-pointer">
          <span>{subform.fields.length} {subform.fields.length === 1 ? 'field' : 'fields'}</span>
        </div>
      </div>

      {/* Section Content */}
      {!isCollapsed && (
        <div className="p-5 space-y-5">
          {subform.fields.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subform.fields.map(field => (
                <FieldInputControl
                  key={field.id}
                  field={field}
                  onChange={val => onFieldValueChange(field.id, val)}
                  isSignatureActive={activeSignatureField === field.id}
                  onActivateSignature={() => setActiveSignatureField(field.id)}
                  onDeactivateSignature={() => setActiveSignatureField(null)}
                  isBulkMode={isBulkMode}
                  isSelected={selectedFieldIds.has(field.id)}
                  onToggleSelect={() => onToggleField(field.id)}
                  issues={fieldErrorMap.get(field.id)}
                />
              ))}
            </div>
          )}

          {/* Child Subforms */}
          {subform.subforms.map(childSf => (
            <div key={childSf.id} className="pt-2">
              <SubformSection
                subform={childSf}
                isCollapsed={false}
                onToggle={() => {}}
                onFieldValueChange={onFieldValueChange}
                activeSignatureField={activeSignatureField}
                setActiveSignatureField={setActiveSignatureField}
                isBulkMode={isBulkMode}
                selectedFieldIds={selectedFieldIds}
                onToggleField={onToggleField}
                onToggleSubform={onToggleSubform}
                fieldErrorMap={fieldErrorMap}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface FieldInputControlProps {
  field: XFAField;
  onChange: (value: string) => void;
  isSignatureActive: boolean;
  onActivateSignature: () => void;
  onDeactivateSignature: () => void;
  isBulkMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  issues?: ValidationError[];
}

const FieldInputControl: React.FC<FieldInputControlProps> = ({
  field,
  onChange,
  isSignatureActive,
  onActivateSignature,
  onDeactivateSignature,
  isBulkMode,
  isSelected,
  onToggleSelect,
  issues = [],
}) => {
  const isFullWidth = field.type === 'multiline' || field.type === 'signature';
  const hasError = issues.some(i => i.severity === 'error');
  const hasWarning = !hasError && issues.some(i => i.severity === 'warning');

  // Opacity when field is marked invisible or hidden in XFA
  const opacityClass =
    field.visibility === 'hidden'
      ? 'opacity-60 border-dashed border-rose-900/60'
      : field.visibility === 'invisible'
      ? 'opacity-75'
      : '';

  const validationRingClass = hasError
    ? 'border-rose-500/80 bg-rose-950/20 ring-1 ring-rose-500/40'
    : hasWarning
    ? 'border-amber-500/80 bg-amber-950/20 ring-1 ring-amber-500/30'
    : 'border-slate-800/80 bg-slate-950/40';

  const inputErrorClass = hasError
    ? 'border-rose-500/80 focus:border-rose-400 focus:ring-rose-500/40'
    : hasWarning
    ? 'border-amber-500/80 focus:border-amber-400 focus:ring-amber-500/40'
    : 'border-slate-800 focus:border-sky-500 focus:ring-sky-500';

  return (
    <div
      id={`field-${field.id}`}
      onClick={isBulkMode ? onToggleSelect : undefined}
      className={`p-3.5 rounded-xl border transition-all ${
        isBulkMode
          ? `cursor-pointer ${
              isSelected
                ? 'bg-sky-950/40 border-sky-400 ring-2 ring-sky-500/50 shadow-sm'
                : `${validationRingClass} hover:border-slate-700 hover:bg-slate-900/60`
            }`
          : validationRingClass
      } ${opacityClass} ${isFullWidth ? 'md:col-span-2' : ''}`}
    >
      {/* Label, Status Badges, and Bindings */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bulk Checkbox */}
          {isBulkMode && (
            <div className="text-sky-400 shrink-0">
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-sky-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500 hover:text-slate-300" />
              )}
            </div>
          )}

          <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5 flex-wrap">
            <span>{field.caption}</span>
            {field.required && (
              <span className="text-rose-400 text-xs font-bold" title="Required field (nullTest='error')">
                *
              </span>
            )}
            <FieldTooltipPopover field={field} variant="icon" />
          </label>
        </div>

        {/* Status badges & Error Tag */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {hasError && (
            <span
              title="Field violates XFA validation rule or business logic constraint"
              className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950/90 text-rose-300 border border-rose-800"
            >
              <AlertCircle className="w-2.5 h-2.5" />
              <span>Error</span>
            </span>
          )}

          {hasWarning && (
            <span
              title="Field advisory check or formatting warning"
              className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-800"
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>Warning</span>
            </span>
          )}

          {field.readOnly && (
            <span
              title="Read-Only: value cannot be modified in PDF viewer"
              className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80"
            >
              <Lock className="w-2.5 h-2.5" />
              <span>Read-Only</span>
            </span>
          )}

          {field.visibility === 'invisible' && (
            <span
              title="Invisible in XFA: takes up layout space but does not render content"
              className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700"
            >
              <EyeOff className="w-2.5 h-2.5" />
              <span>Invisible</span>
            </span>
          )}

          {field.visibility === 'hidden' && (
            <span
              title="Hidden in XFA: excluded from document layout and rendering"
              className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-800/80"
            >
              <EyeOff className="w-2.5 h-2.5" />
              <span>Hidden</span>
            </span>
          )}

          <span
            className="text-[10px] font-mono text-slate-400 truncate max-w-[120px] hidden sm:inline"
            title={field.dataRef || field.name}
          >
            {field.name}
          </span>
        </div>
      </div>

      {/* Control Type Rendering */}
      <div onClick={isBulkMode ? e => e.stopPropagation() : undefined}>
        {field.type === 'check' ? (
          <label className={`flex items-center gap-2.5 p-2 bg-slate-900/60 border rounded-lg transition-colors ${inputErrorClass} ${field.readOnly ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:border-slate-700'}`}>
            <input
              type="checkbox"
              disabled={field.readOnly}
              checked={field.value === '1' || field.value.toLowerCase() === 'true' || field.value.toLowerCase() === 'yes'}
              onChange={e => onChange(e.target.checked ? '1' : '0')}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
            />
            <span className="text-xs text-slate-300">
              {field.value === '1' || field.value.toLowerCase() === 'true' ? 'Enabled / Affirmed' : 'Disabled / No'}
            </span>
          </label>
        ) : field.type === 'choice' ? (
          <select
            value={field.value}
            disabled={field.readOnly}
            onChange={e => onChange(e.target.value)}
            className={`w-full bg-slate-900/80 border rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 ${inputErrorClass} ${field.readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <option value="">-- Select an option --</option>
            {field.options?.map((opt, i) => (
              <option key={i} value={opt} className="bg-slate-900 text-slate-200">
                {opt}
              </option>
            ))}
            {field.value && !field.options?.includes(field.value) && (
              <option value={field.value} className="bg-slate-900 text-slate-200">
                {field.value}
              </option>
            )}
          </select>
        ) : field.type === 'multiline' ? (
          <textarea
            rows={3}
            value={field.value}
            disabled={field.readOnly}
            onChange={e => onChange(e.target.value)}
            placeholder={field.readOnly ? '(Read-only field)' : 'Enter detailed notes or disclosures...'}
            className={`w-full bg-slate-900/80 border rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 ${inputErrorClass} ${field.readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
          />
        ) : field.type === 'date' ? (
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={field.value}
              disabled={field.readOnly}
              onChange={e => onChange(e.target.value)}
              className={`w-full bg-slate-900/80 border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 ${inputErrorClass} ${field.readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
            />
          </div>
        ) : field.type === 'numeric' ? (
          <div className="relative">
            <Hash className="w-3 h-3 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={field.value}
              disabled={field.readOnly}
              onChange={e => onChange(e.target.value)}
              placeholder="0.00"
              className={`w-full bg-slate-900/80 border rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 font-mono tabular-nums focus:outline-none focus:ring-1 ${inputErrorClass} ${field.readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
            />
          </div>
        ) : field.type === 'signature' ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <PenTool className="w-3.5 h-3.5 text-sky-400" />
                <span>Digital Electronic Signature Block</span>
              </div>
              {field.value && (
                <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>Signed</span>
                </span>
              )}
            </div>
            <input
              type="text"
              value={field.value}
              disabled={field.readOnly}
              onChange={e => onChange(e.target.value)}
              placeholder={field.readOnly ? '(Read-only signature)' : 'Type legal signatory name...'}
              className={`w-full bg-slate-950 border rounded-md px-3 py-1.5 text-xs font-serif text-sky-200 placeholder-slate-600 focus:outline-none ${inputErrorClass} ${field.readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
            />
          </div>
        ) : (
          <input
            type="text"
            value={field.value}
            disabled={field.readOnly}
            onChange={e => onChange(e.target.value)}
            placeholder={field.readOnly ? '(Read-only field)' : `Enter ${field.caption.toLowerCase()}...`}
            className={`w-full bg-slate-900/80 border rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 ${inputErrorClass} ${field.readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
          />
        )}
      </div>

      {/* Direct Inline Error Banners */}
      {issues.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {issues.map(issue => {
            const autoFixVal = quickFixFieldValue(field, issue);
            return (
              <div
                key={issue.id}
                className={`p-2 rounded-lg border text-xs flex items-start justify-between gap-2 animate-in fade-in duration-100 ${
                  issue.severity === 'error'
                    ? 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                    : issue.severity === 'warning'
                    ? 'bg-amber-950/50 border-amber-800/70 text-amber-200'
                    : 'bg-sky-950/50 border-sky-800/70 text-sky-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {issue.severity === 'error' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-slate-100">{issue.message}</span>
                      {issue.expectedPattern && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/50 text-slate-300 border border-slate-700">
                          Format: {issue.expectedPattern}
                        </span>
                      )}
                    </div>
                    {issue.ruleDescription && (
                      <p className="text-[10px] text-slate-400 font-mono">
                        Constraint: {issue.ruleDescription}
                      </p>
                    )}
                  </div>
                </div>

                {autoFixVal && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onChange(autoFixVal);
                    }}
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-950 text-sky-300 border border-sky-700 hover:bg-sky-900 text-[10px] font-medium transition-colors"
                    title={`Auto-format field value to "${autoFixVal}"`}
                  >
                    <Zap className="w-3 h-3 text-sky-400" />
                    <span>Fix: {autoFixVal}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
