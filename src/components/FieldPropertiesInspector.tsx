import React, { useState, useEffect } from 'react';
import {
  XFAField,
  XFAFieldAppearance,
  ExtractedResourceManifest,
} from '../types/pdf';
import {
  Sliders,
  Type,
  Square,
  CheckSquare,
  ListFilter,
  PenTool,
  Hash,
  Calendar,
  Layers,
  Sparkles,
  RotateCcw,
  Eye,
  Check,
  ChevronRight,
  Code,
  MapPin,
  Palette,
  CheckCircle2,
  AlertCircle,
  Copy,
  HelpCircle,
  Volume2,
} from 'lucide-react';
import { getFieldTooltipGuide } from '../utils/xfaTooltipHelper';

interface FieldPropertiesInspectorProps {
  selectedField: XFAField | null;
  allFieldsOnPage: XFAField[];
  onSelectField: (field: XFAField) => void;
  onFieldValueChange: (fieldId: string, newValue: string) => void;
  onUpdateAppearance: (fieldId: string, appearance: XFAFieldAppearance, applyToAllOfType: boolean) => void;
  onResetAppearance: (fieldId: string) => void;
  onClose?: () => void;
}

export const FieldPropertiesInspector: React.FC<FieldPropertiesInspectorProps> = ({
  selectedField,
  allFieldsOnPage,
  onSelectField,
  onFieldValueChange,
  onUpdateAppearance,
  onResetAppearance,
  onClose,
}) => {
  const [appearance, setAppearance] = useState<XFAFieldAppearance | null>(null);
  const [copiedBinding, setCopiedBinding] = useState(false);
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);

  // Sync appearance whenever selectedField changes
  useEffect(() => {
    if (selectedField?.appearance) {
      setAppearance({ ...selectedField.appearance });
    }
  }, [selectedField]);

  const handleApplyCurrent = () => {
    if (!selectedField || !appearance) return;
    onUpdateAppearance(selectedField.id, appearance, false);
    setAppliedFeedback('Applied to selected field');
    setTimeout(() => setAppliedFeedback(null), 2500);
  };

  const handleApplyAllOfType = () => {
    if (!selectedField || !appearance) return;
    onUpdateAppearance(selectedField.id, appearance, true);
    setAppliedFeedback(`Applied to all ${selectedField.type} fields`);
    setTimeout(() => setAppliedFeedback(null), 2500);
  };

  const handleCopyBinding = () => {
    if (!selectedField?.dataRef) return;
    navigator.clipboard.writeText(selectedField.dataRef);
    setCopiedBinding(true);
    setTimeout(() => setCopiedBinding(false), 2000);
  };

  const getTypeIcon = (type: XFAField['type']) => {
    switch (type) {
      case 'check': return <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />;
      case 'choice': return <ListFilter className="w-3.5 h-3.5 text-purple-400" />;
      case 'numeric': return <Hash className="w-3.5 h-3.5 text-amber-400" />;
      case 'date': return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      case 'signature': return <PenTool className="w-3.5 h-3.5 text-rose-400" />;
      default: return <Type className="w-3.5 h-3.5 text-sky-400" />;
    }
  };

  const getTypeBadgeClass = (type: XFAField['type']) => {
    switch (type) {
      case 'check': return 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300';
      case 'choice': return 'bg-purple-950/70 border-purple-800/80 text-purple-300';
      case 'numeric':
      case 'date': return 'bg-amber-950/70 border-amber-800/80 text-amber-300';
      case 'signature': return 'bg-rose-950/70 border-rose-800/80 text-rose-300';
      default: return 'bg-sky-950/70 border-sky-800/80 text-sky-300';
    }
  };

  if (!selectedField) {
    return (
      <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full text-xs text-slate-300">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-slate-100">XFA Field Inspector</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {allFieldsOnPage.length} on page
          </span>
        </div>

        <div className="p-4 text-slate-400 text-center space-y-3">
          <Layers className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs">
            Click any highlighted field on the PDF canvas to inspect its properties, coordinates, XML bindings, or customize its appearance.
          </p>
        </div>

        {/* List of fields on page */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          <div className="px-2 py-1 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Fields on Current Page
          </div>
          {allFieldsOnPage.map(field => (
            <button
              key={field.id}
              onClick={() => onSelectField(field)}
              className="w-full text-left p-2 rounded-lg bg-slate-950/40 hover:bg-slate-800/60 border border-slate-800/60 transition-colors flex items-center justify-between gap-2 group"
            >
              <div className="flex items-center gap-2 min-w-0">
                {getTypeIcon(field.type)}
                <div className="min-w-0">
                  <div className="font-medium text-slate-200 truncate group-hover:text-sky-300">
                    {field.caption}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    {field.name}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-84 bg-slate-900 border-l border-slate-800 flex flex-col h-full text-xs text-slate-300 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2 min-w-0">
          {getTypeIcon(selectedField.type)}
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-100 truncate text-xs" title={selectedField.caption}>
              {selectedField.caption}
            </h3>
            <span className={`inline-block text-[10px] px-1.5 py-0.2 rounded-sm border font-mono uppercase ${getTypeBadgeClass(selectedField.type)}`}>
              {selectedField.type}
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1"
            title="Deselect Field"
          >
            ✕
          </button>
        )}
      </div>

      {appliedFeedback && (
        <div className="mx-4 mt-3 p-2.5 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{appliedFeedback}</span>
        </div>
      )}

      <div className="p-4 space-y-5">
        {/* SECTION 1: FIELD VALUE (LIVE EDITING) */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            Field Value
          </label>
          {selectedField.type === 'check' ? (
            <label className="flex items-center gap-2.5 p-2 bg-slate-950/60 border border-slate-800 rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={selectedField.value === '1' || selectedField.value.toLowerCase() === 'true'}
                onChange={e => onFieldValueChange(selectedField.id, e.target.checked ? '1' : '0')}
                className="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700"
              />
              <span className="text-xs text-slate-200">
                {selectedField.value === '1' || selectedField.value.toLowerCase() === 'true' ? 'Checked (1)' : 'Unchecked (0)'}
              </span>
            </label>
          ) : selectedField.type === 'choice' && selectedField.options ? (
            <select
              value={selectedField.value}
              onChange={e => onFieldValueChange(selectedField.id, e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="">-- Select option --</option>
              {selectedField.options.map((opt, i) => (
                <option key={i} value={opt} className="bg-slate-900 text-slate-200">
                  {opt}
                </option>
              ))}
            </select>
          ) : selectedField.type === 'multiline' ? (
            <textarea
              rows={3}
              value={selectedField.value}
              onChange={e => onFieldValueChange(selectedField.id, e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-md p-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            />
          ) : (
            <input
              type={selectedField.type === 'numeric' ? 'number' : selectedField.type === 'date' ? 'date' : 'text'}
              value={selectedField.value}
              onChange={e => onFieldValueChange(selectedField.id, e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            />
          )}
        </div>

        {/* SECTION 2: APPEARANCE CUSTOMIZER (NO FLATTENING REQUIRED) */}
        {appearance && (
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3 h-3 text-sky-400" />
                <span>Field Appearance</span>
              </span>
              <button
                onClick={() => onResetAppearance(selectedField.id)}
                className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                title="Reset appearance to type default"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Border Color & Style */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">Border Color &amp; Stroke</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={appearance.borderColor.startsWith('#') ? appearance.borderColor : '#0284c7'}
                  onChange={e => setAppearance({ ...appearance, borderColor: e.target.value })}
                  className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5"
                />
                <select
                  value={appearance.borderStyle}
                  onChange={e => setAppearance({ ...appearance, borderStyle: e.target.value as any })}
                  className="flex-1 bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="solid">Solid Stroke</option>
                  <option value="dashed">Dashed Stroke</option>
                  <option value="dotted">Dotted Stroke</option>
                  <option value="none">No Border</option>
                </select>
                <select
                  value={appearance.borderWidth}
                  onChange={e => setAppearance({ ...appearance, borderWidth: Number(e.target.value) })}
                  className="w-16 bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value={1}>1 pt</option>
                  <option value={1.5}>1.5 pt</option>
                  <option value={2}>2 pt</option>
                  <option value={3}>3 pt</option>
                </select>
              </div>
            </div>

            {/* Background Fill Color */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">Background Fill</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={appearance.backgroundColor.startsWith('#') ? appearance.backgroundColor : '#f0f9ff'}
                  onChange={e => setAppearance({ ...appearance, backgroundColor: e.target.value })}
                  className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer p-0.5"
                />
                <div className="flex items-center gap-1.5 flex-1">
                  <button
                    type="button"
                    onClick={() => setAppearance({ ...appearance, backgroundColor: 'transparent' })}
                    className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                      appearance.backgroundColor === 'transparent'
                        ? 'bg-sky-950 border-sky-600 text-sky-300'
                        : 'border-slate-800 hover:bg-slate-800 text-slate-400'
                    }`}
                  >
                    Clear (Transparent)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppearance({ ...appearance, backgroundColor: '#ffffff' })}
                    className="px-2 py-1 text-[11px] rounded border border-slate-800 hover:bg-slate-800 text-slate-300"
                  >
                    White
                  </button>
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">Font &amp; Size</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={appearance.fontFamily}
                  onChange={e => setAppearance({ ...appearance, fontFamily: e.target.value })}
                  className="bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times-Roman">Times-Roman</option>
                  <option value="Courier">Courier</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                </select>

                <div className="flex items-center gap-1">
                  <select
                    value={appearance.fontSize}
                    onChange={e => setAppearance({ ...appearance, fontSize: Number(e.target.value) })}
                    className="flex-1 bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                  >
                    <option value={8}>8 pt</option>
                    <option value={9}>9 pt</option>
                    <option value={10}>10 pt</option>
                    <option value={11}>11 pt</option>
                    <option value={12}>12 pt</option>
                    <option value={14}>14 pt</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setAppearance({ ...appearance, fontWeight: appearance.fontWeight === 'bold' ? 'normal' : 'bold' })}
                    className={`px-2 py-1 text-xs font-bold rounded border transition-colors ${
                      appearance.fontWeight === 'bold'
                        ? 'bg-sky-950 border-sky-500 text-sky-300'
                        : 'border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    B
                  </button>
                </div>
              </div>
            </div>

            {/* Corner Radius & Caption Placement */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Corners</label>
                <select
                  value={appearance.cornerRadius}
                  onChange={e => setAppearance({ ...appearance, cornerRadius: Number(e.target.value) })}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value={0}>Sharp (0px)</option>
                  <option value={3}>Slight (3px)</option>
                  <option value={6}>Rounded (6px)</option>
                  <option value={10}>Pill (10px)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Caption Position</label>
                <select
                  value={appearance.captionPlacement}
                  onChange={e => setAppearance({ ...appearance, captionPlacement: e.target.value as any })}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="top">Top</option>
                  <option value="left">Left</option>
                  <option value="none">Hidden</option>
                </select>
              </div>
            </div>

            {/* Appearance Action Buttons */}
            <div className="pt-2 flex flex-col gap-1.5">
              <button
                onClick={handleApplyCurrent}
                className="w-full py-1.5 px-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-md transition-colors text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Apply Appearance to Field</span>
              </button>

              <button
                onClick={handleApplyAllOfType}
                className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors text-xs"
              >
                Apply to All {selectedField.type.toUpperCase()} Fields
              </button>
            </div>
          </div>
        )}

        {/* SECTION 3: BOUNDS & COORDINATES */}
        {selectedField.bounds && (
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-sky-400" />
              <span>Boundary Coordinates</span>
            </span>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Page:</span>
                <span className="text-slate-200">Page {selectedField.bounds.pageNumber}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Offset (X, Y):</span>
                <span className="text-slate-200 tabular-nums">
                  {Math.round(selectedField.bounds.x)}pt, {Math.round(selectedField.bounds.y)}pt
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Dimensions (W × H):</span>
                <span className="text-slate-200 tabular-nums">
                  {Math.round(selectedField.bounds.width)}pt × {Math.round(selectedField.bounds.height)}pt
                </span>
              </div>
              {(selectedField.bounds.rawW || selectedField.bounds.rawH) && (
                <div className="flex justify-between text-slate-500 text-[10px] pt-1 border-t border-slate-800">
                  <span>Template Raw:</span>
                  <span>w="{selectedField.bounds.rawW || '-'}" h="{selectedField.bounds.rawH || '-'}"</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 4: XML BINDING & METADATA */}
        <div className="space-y-2 pt-3 border-t border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Code className="w-3 h-3 text-sky-400" />
            <span>XML Architecture Binding</span>
          </span>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 space-y-2 text-[11px]">
            <div className="space-y-1">
              <span className="text-slate-500 font-mono">dataRef / binding:</span>
              <div className="flex items-center justify-between gap-2 bg-slate-900 px-2 py-1 rounded font-mono text-slate-300 truncate">
                <span className="truncate">{selectedField.dataRef || selectedField.name}</span>
                <button
                  onClick={handleCopyBinding}
                  className="text-slate-400 hover:text-slate-100"
                  title="Copy XML binding path"
                >
                  {copiedBinding ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span>Required:</span>
              <span className={selectedField.required ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                {selectedField.required ? 'Yes (nullTest="error")' : 'No'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span>Access Mode:</span>
              <span className="text-slate-300 font-mono">
                {selectedField.readOnly ? 'readOnly' : 'open / interactive'}
              </span>
            </div>

            {selectedField.parentSubform && (
              <div className="flex items-center justify-between text-slate-400">
                <span>Subform Container:</span>
                <span className="text-slate-300 font-mono">{selectedField.parentSubform}</span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 5: XFA ASSIST & TOOLTIP GUIDANCE */}
        {(() => {
          const guide = getFieldTooltipGuide(selectedField);
          return (
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-3 h-3 text-sky-400" />
                  <span>XFA Assist &amp; Guidance</span>
                </span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                  guide.hasExplicitAssist
                    ? 'bg-sky-950 text-sky-300 border border-sky-800'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {guide.hasExplicitAssist ? '<assist> parsed' : 'Semantic Guide'}
                </span>
              </span>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 space-y-2 text-[11px]">
                {/* Tooltip text */}
                <div className="space-y-1">
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <span>Help Guidance / toolTip:</span>
                  </span>
                  <div className="bg-slate-900/90 border border-slate-800/60 rounded p-2 text-slate-200 text-xs leading-relaxed">
                    {guide.guidance}
                  </div>
                </div>

                {/* Speech prompt if present in <speak> */}
                {guide.speakPrompt && (
                  <div className="space-y-1 pt-1 border-t border-slate-800">
                    <span className="text-slate-400 font-medium flex items-center gap-1 text-[10px]">
                      <Volume2 className="w-3 h-3 text-sky-400" />
                      <span>Screen Reader &lt;speak&gt; Prompt:</span>
                    </span>
                    <div className="text-[11px] font-mono text-sky-300 bg-sky-950/40 border border-sky-900/40 rounded px-2 py-1">
                      "{guide.speakPrompt}"
                    </div>
                  </div>
                )}

                {/* Format requirement hint */}
                {guide.formatHint && (
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Format Rule:</span>
                    <span className="text-amber-300 font-mono text-[10px] px-1.5 py-0.2 rounded bg-amber-950/40 border border-amber-900/60">
                      {guide.formatHint}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 font-mono">
                  <span>Source XML Node:</span>
                  <span className="text-slate-400">{guide.source}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
