import React, { useState, useMemo } from 'react';
import { XFAField } from '../types/pdf';
import {
  HelpCircle,
  AlertCircle,
  Flame,
} from 'lucide-react';
import { validateField } from '../utils/validationEngine';
import { getFieldTooltipGuide } from '../utils/xfaTooltipHelper';
import { FieldHeatmapCell } from '../utils/fieldHeatmap';

interface XfaFieldOverlayProps {
  fields: XFAField[];
  currentPage: number;
  canvasWidth: number;
  canvasHeight: number;
  pdfPageWidth?: number;
  pdfPageHeight?: number;
  scale: number;
  selectedFieldId: string | null;
  onSelectField: (field: XFAField) => void;
  showBoundaries: boolean;
  showBadges: boolean;
  typeFilter: string;
  heatmapEnabled?: boolean;
  heatmapCells?: Map<string, FieldHeatmapCell>;
  heatmapOpacity?: number;
  heatmapShowLabels?: boolean;
}

export const XfaFieldOverlay: React.FC<XfaFieldOverlayProps> = ({
  fields,
  currentPage,
  canvasWidth,
  canvasHeight,
  pdfPageWidth = 612,
  pdfPageHeight = 792,
  scale,
  selectedFieldId,
  onSelectField,
  showBoundaries,
  showBadges,
  typeFilter,
  heatmapEnabled = false,
  heatmapCells,
  heatmapOpacity = 0.5,
  heatmapShowLabels = true,
}) => {
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);

  const allFieldsMap = useMemo(() => {
    const map = new Map<string, XFAField>();
    fields.forEach(f => map.set(f.id, f));
    return map;
  }, [fields]);

  if ((!showBoundaries && !heatmapEnabled) || canvasWidth <= 0 || canvasHeight <= 0) {
    return null;
  }

  // Filter fields on this page
  const pageFields = fields.filter(f => {
    const p = f.bounds?.pageNumber || 1;
    if (p !== currentPage) return false;
    if (typeFilter !== 'all' && f.type !== typeFilter) return false;
    return true;
  });

  const scaleX = canvasWidth / pdfPageWidth;
  const scaleY = canvasHeight / pdfPageHeight;

  const getTypeLabel = (type: XFAField['type']) => {
    switch (type) {
      case 'check': return 'Checkbox';
      case 'choice': return 'Dropdown';
      case 'numeric': return 'Numeric';
      case 'date': return 'Date';
      case 'signature': return 'Signature';
      case 'multiline': return 'Multi-line';
      default: return 'Text';
    }
  };

  const getTypeBadgeColor = (type: XFAField['type']) => {
    switch (type) {
      case 'check': return 'bg-emerald-500 text-slate-950 font-bold';
      case 'choice': return 'bg-purple-500 text-white font-semibold';
      case 'numeric':
      case 'date': return 'bg-amber-500 text-slate-950 font-bold';
      case 'signature': return 'bg-rose-500 text-white font-semibold';
      default: return 'bg-sky-500 text-slate-950 font-bold';
    }
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none overflow-hidden"
      style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
    >
      {pageFields.map(field => {
        if (!field.bounds) return null;

        const left = field.bounds.x * scaleX;
        const top = field.bounds.y * scaleY;
        const width = field.bounds.width * scaleX;
        const height = field.bounds.height * scaleY;

        const isSelected = selectedFieldId === field.id;
        const isHovered = hoveredFieldId === field.id;

        const appearance = field.appearance;
        const heatCell = heatmapEnabled ? heatmapCells?.get(field.id) : undefined;
        const fieldIssues = heatCell ? heatCell.issues : validateField(field, allFieldsMap);
        const hasError = fieldIssues.some(e => e.severity === 'error');
        const hasWarning = !hasError && fieldIssues.some(e => e.severity === 'warning');

        const defaultBorderColor = appearance?.borderColor || '#0284c7';
        const borderColor = heatCell
          ? heatCell.borderHex
          : hasError
          ? '#ef4444'
          : hasWarning
          ? '#f59e0b'
          : defaultBorderColor;

        const borderStyle = appearance?.borderStyle || 'solid';
        const baseBorderWidth = (appearance?.borderWidth || 1.5) * (scale / 1.2);
        const borderWidth = heatCell
          ? Math.max(1.5, baseBorderWidth * (heatCell.intensity >= 0.8 ? 1.35 : 1.05))
          : baseBorderWidth;

        const defaultBg = appearance?.backgroundColor || 'rgba(2, 132, 199, 0.08)';
        const heatFillAlpha = heatCell
          ? Math.min(0.85, Math.max(0.14, heatmapOpacity * (0.45 + heatCell.intensity * 0.65)))
          : 0;
        const backgroundColor = heatCell
          ? `rgba(${heatCell.fillRgb}, ${heatFillAlpha.toFixed(2)})`
          : hasError
          ? 'rgba(239, 68, 68, 0.12)'
          : hasWarning
          ? 'rgba(245, 158, 11, 0.12)'
          : defaultBg;

        const cornerRadius = (appearance?.cornerRadius || 4) * (scale / 1.2);

        const heatBoxShadow =
          heatCell && heatCell.intensity >= 0.85 && !isSelected
            ? `0 0 0 1px rgba(${heatCell.fillRgb}, 0.55), 0 0 12px rgba(${heatCell.fillRgb}, 0.35)`
            : undefined;

        return (
          <div
            key={field.id}
            id={`canvas-field-${field.id}`}
            onClick={e => {
              e.stopPropagation();
              onSelectField(field);
            }}
            onMouseEnter={() => setHoveredFieldId(field.id)}
            onMouseLeave={() => setHoveredFieldId(null)}
            className={`absolute pointer-events-auto cursor-pointer transition-all duration-150 group ${
              isSelected
                ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-900 shadow-lg z-30'
                : !heatCell && hasError
                ? 'ring-1 ring-rose-500 shadow-md z-20'
                : isHovered
                ? 'ring-1 ring-sky-300 shadow-md z-25'
                : 'z-10'
            }`}
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${Math.max(20, width)}px`,
              height: `${Math.max(16, height)}px`,
              borderColor: isSelected ? '#38bdf8' : borderColor,
              borderStyle: borderStyle === 'none' ? 'solid' : borderStyle,
              borderWidth: `${borderWidth}px`,
              backgroundColor:
                isSelected && !heatCell ? 'rgba(56, 189, 248, 0.2)' : backgroundColor,
              borderRadius: `${cornerRadius}px`,
              boxShadow: heatBoxShadow,
            }}
          >
            {/* Field Type Badge (shown when boundaries/badges enabled and heatmap labels don't collide) */}
            {showBadges && !heatCell && (
              <div
                className={`absolute -top-3 left-1.5 px-1.5 py-0.2 rounded text-[9px] font-mono tracking-tight leading-tight uppercase flex items-center gap-1 shadow-xs transition-opacity ${getTypeBadgeColor(
                  field.type
                )}`}
              >
                <span>{getTypeLabel(field.type)}</span>
              </div>
            )}

            {/* Heatmap Accessible Status / Metric Label */}
            {heatCell && heatmapShowLabels && (
              <div
                className={`absolute -top-3 right-1 px-1.5 py-0.2 rounded text-[9px] font-mono tabular-nums font-semibold leading-tight shadow-xs whitespace-nowrap border border-black/25 ${heatCell.indicatorTextClass}`}
                style={{ backgroundColor: heatCell.indicatorBgHex }}
                title={heatCell.statusLabel}
              >
                {heatCell.shortLabel}
              </div>
            )}

            {/* Validation Error Dot Indicator (standard mode when heatmap is off) */}
            {!heatCell && hasError && (
              <div
                className="absolute -top-2.5 -right-2 px-1 py-0.2 rounded-full text-[9px] font-mono font-bold bg-rose-600 text-white border border-rose-300 flex items-center justify-center shadow-xs"
                title="Field violates XFA validation rule"
              >
                !
              </div>
            )}

            {/* Field Value Preview Inside Box */}
            <div className="w-full h-full p-1 overflow-hidden flex items-center">
              <span
                className="text-[11px] truncate select-none"
                style={{
                  color: appearance?.textColor || '#0f172a',
                  fontFamily: appearance?.fontFamily || 'Helvetica',
                  fontWeight: appearance?.fontWeight || 'normal',
                }}
              >
                {field.value || (
                  <span className="opacity-45 italic text-[10px]">
                    {field.caption || field.name}
                  </span>
                )}
              </span>
            </div>

            {/* Hover Tooltip Card */}
            {isHovered && !isSelected && (() => {
              const guide = getFieldTooltipGuide(field);
              return (
                <div
                  className="absolute left-0 bottom-full mb-1.5 z-40 bg-slate-900/95 border border-slate-700/80 rounded-lg p-2.5 shadow-2xl text-slate-100 min-w-[235px] max-w-sm pointer-events-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                    <span className="font-semibold text-xs text-sky-300 truncate">
                      {field.caption}
                    </span>
                    <span className="text-[9px] font-mono px-1 py-0.2 bg-slate-800 text-slate-300 rounded uppercase">
                      {field.type}
                    </span>
                  </div>

                  {/* Heatmap Telemetry Block when Heatmap is Active */}
                  {heatCell && (
                    <div className="mt-1.5 p-2 rounded bg-slate-950/90 border border-slate-800 space-y-1 text-[10px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-orange-300 flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          <span>Heatmap Status</span>
                        </span>
                        <span
                          className="font-mono font-semibold"
                          style={{ color: heatCell.borderHex }}
                        >
                          {heatCell.statusLabel}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-800/80 font-mono tabular-nums text-[10px]">
                        <div>
                          <div className="text-slate-500">Status</div>
                          <div className={heatCell.isFilled ? 'text-emerald-300' : heatCell.isRequired ? 'text-rose-300' : 'text-slate-300'}>
                            {heatCell.isFilled ? 'Filled' : heatCell.isRequired ? 'Required' : 'Empty'}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Usage</div>
                          <div className="text-sky-300">
                            {heatCell.totalInteractions}× ({heatCell.editCount}e/{heatCell.selectionCount}c)
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Issues</div>
                          <div className={heatCell.errorCount > 0 ? 'text-rose-300' : heatCell.warningCount > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                            {heatCell.errorCount}E / {heatCell.warningCount}W
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Guidance from XFA Assist / Template */}
                  {guide.guidance && (
                    <div className="mt-1.5 p-1.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] text-slate-300 leading-snug">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[9px] font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                          <HelpCircle className="w-2.5 h-2.5" />
                          <span>{guide.hasExplicitAssist ? 'XFA Assist' : 'Guidance'}</span>
                        </span>
                        {guide.formatHint && (
                          <span className="text-[8px] font-mono px-1 rounded bg-sky-950 text-sky-300 border border-sky-800">
                            {guide.formatHint}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300">{guide.guidance}</p>
                    </div>
                  )}

                  <div className="mt-1.5 space-y-0.5 text-[10px] font-mono text-slate-400">
                    <div>Name: <span className="text-slate-200">{field.name}</span></div>
                    <div>Binding: <span className="text-slate-300 truncate">{field.dataRef || '-'}</span></div>
                    <div>Value: <span className="text-emerald-400 font-semibold">{field.value || '(empty)'}</span></div>
                  </div>

                  {/* Validation Errors in Tooltip */}
                  {fieldIssues.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-800 space-y-1">
                      {fieldIssues.map(issue => (
                        <div
                          key={issue.id}
                          className={`text-[10px] flex items-start gap-1 ${
                            issue.severity === 'error' ? 'text-rose-300' : 'text-amber-300'
                          }`}
                        >
                          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-1.5 text-[9px] text-sky-400/80">
                    Click to inspect properties &amp; edit appearance
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
};
