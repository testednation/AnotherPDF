import React from 'react';
import {
  Flame,
  CheckCircle2,
  Activity,
  AlertTriangle,
  Crosshair,
  RotateCcw,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { HeatmapMetricMode, HeatmapSummary } from '../utils/fieldHeatmap';

interface FieldHeatmapControlBarProps {
  mode: HeatmapMetricMode;
  onModeChange: (mode: HeatmapMetricMode) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  showMetricLabels: boolean;
  onToggleMetricLabels: () => void;
  summary: HeatmapSummary;
  pageSummary: HeatmapSummary;
  currentPage: number;
  onJumpToNextProblem?: () => void;
  onJumpToNextMissingRequired?: () => void;
  onJumpToHotspot?: () => void;
  onResetUsageMetrics?: () => void;
  onClose: () => void;
}

export const FieldHeatmapControlBar: React.FC<FieldHeatmapControlBarProps> = ({
  mode,
  onModeChange,
  opacity,
  onOpacityChange,
  showMetricLabels,
  onToggleMetricLabels,
  summary,
  pageSummary,
  currentPage,
  onJumpToNextProblem,
  onJumpToNextMissingRequired,
  onJumpToHotspot,
  onResetUsageMetrics,
  onClose,
}) => {
  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl px-3.5 py-2.5 space-y-2.5 text-xs shadow-lg">
      {/* Top Row: Title, Mode Switcher, Opacity, Labels Toggle, Close */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-slate-100 font-semibold whitespace-nowrap shrink-0">
            <Flame className="w-4 h-4 text-orange-400 shrink-0" />
            <span>Field Interaction Heatmap</span>
          </div>

          {/* Mode Segmented Control */}
          <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => onModeChange('completion')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'completion'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Color fields by completion and required status"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completion</span>
            </button>
            <button
              type="button"
              onClick={() => onModeChange('usage')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'usage'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Color fields by edit and click interaction frequency"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Usage Frequency</span>
            </button>
            <button
              type="button"
              onClick={() => onModeChange('errors')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'errors'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Color fields by validation error and warning count"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Error Count</span>
              {summary.totalErrors > 0 && (
                <span className="font-mono tabular-nums text-[10px] opacity-90">
                  ({summary.totalErrors})
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right Controls: Opacity, Metric Labels, Dismiss */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded-md px-2 py-1">
            <span className="whitespace-nowrap">Intensity</span>
            <input
              type="range"
              min={25}
              max={85}
              step={5}
              value={Math.round(opacity * 100)}
              onChange={e => onOpacityChange(Number(e.target.value) / 100)}
              className="w-16 accent-orange-500 cursor-pointer"
              aria-label="Heatmap overlay intensity"
            />
            <span className="font-mono tabular-nums text-slate-200 w-7 text-right">
              {Math.round(opacity * 100)}%
            </span>
          </label>

          <button
            type="button"
            onClick={onToggleMetricLabels}
            className={`px-2 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showMetricLabels
                ? 'bg-slate-800 border-slate-600 text-slate-100'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Show or hide numeric status indicators on field overlays"
          >
            {showMetricLabels ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Labels</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            title="Turn off Field Interaction Heatmap"
            aria-label="Close heatmap overlay"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Row: Dynamic Mode Legend + Live Page & Form Telemetry + Quick Jump */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
        {/* Mode-Specific Color Legend with Live Counts */}
        {mode === 'completion' && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300 tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 shrink-0" />
              <span>Completed</span>
              <strong className="font-mono text-emerald-300">{summary.completedValid}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 shrink-0" />
              <span>Filled w/ Issues</span>
              <strong className="font-mono text-amber-300">{summary.filledWithIssues}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 shrink-0" />
              <span>Missing Required</span>
              <strong className="font-mono text-rose-300">{summary.emptyRequired}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-500 shrink-0" />
              <span>Optional Open</span>
              <strong className="font-mono text-slate-300">{summary.emptyOptional}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="text-slate-400">
              Page {currentPage}: <strong className="font-mono text-slate-200">{pageSummary.completionPercent}%</strong> filled ({summary.completionPercent}% overall)
            </span>
          </div>
        )}

        {mode === 'usage' && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300 tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-600 shrink-0" />
              <span>0× Untouched</span>
            </span>
            <span aria-hidden="true" className="text-slate-700">→</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 shrink-0" />
              <span>Low</span>
            </span>
            <span aria-hidden="true" className="text-slate-700">→</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 shrink-0" />
              <span>Active</span>
            </span>
            <span aria-hidden="true" className="text-slate-700">→</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-orange-600 shrink-0" />
              <span>Hotspot</span>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="text-slate-400">
              <strong className="font-mono text-slate-200">{summary.totalInteractions}</strong> total interactions across{' '}
              <strong className="font-mono text-slate-200">{summary.interactedFields}</strong>/{summary.totalFields} fields
            </span>
          </div>
        )}

        {mode === 'errors' && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300 tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 shrink-0" />
              <span>Clean</span>
              <strong className="font-mono text-emerald-300">{summary.cleanFields}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 shrink-0" />
              <span>Warnings</span>
              <strong className="font-mono text-amber-300">{summary.fieldsWithWarnings}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-orange-600 shrink-0" />
              <span>1 Error</span>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-600 shrink-0" />
              <span>2+ Errors</span>
              <strong className="font-mono text-rose-300">{summary.fieldsWithErrors}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="text-slate-400">
              Page {currentPage}: <strong className="font-mono text-rose-300">{pageSummary.totalErrors}</strong> err /{' '}
              <strong className="font-mono text-amber-300">{pageSummary.totalWarnings}</strong> warn
            </span>
          </div>
        )}

        {/* Contextual Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {mode === 'completion' && summary.emptyRequired > 0 && onJumpToNextMissingRequired && (
            <button
              type="button"
              onClick={onJumpToNextMissingRequired}
              className="px-2.5 py-1 rounded-md bg-rose-950/70 hover:bg-rose-900/80 border border-rose-700/70 text-rose-200 font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Crosshair className="w-3 h-3" />
              <span>Next Missing Required</span>
            </button>
          )}

          {mode === 'errors' && summary.problemFieldIds.length > 0 && onJumpToNextProblem && (
            <button
              type="button"
              onClick={onJumpToNextProblem}
              className="px-2.5 py-1 rounded-md bg-rose-950/70 hover:bg-rose-900/80 border border-rose-700/70 text-rose-200 font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Crosshair className="w-3 h-3" />
              <span>Jump to Issue ({summary.problemFieldIds.length})</span>
            </button>
          )}

          {mode === 'usage' && (
            <>
              {summary.hotspotFieldId && onJumpToHotspot && (
                <button
                  type="button"
                  onClick={onJumpToHotspot}
                  className="px-2.5 py-1 rounded-md bg-orange-950/70 hover:bg-orange-900/80 border border-orange-700/70 text-orange-200 font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Crosshair className="w-3 h-3" />
                  <span>Jump to Top Hotspot ({summary.maxInteractions}×)</span>
                </button>
              )}
              {summary.totalInteractions > 0 && onResetUsageMetrics && (
                <button
                  type="button"
                  onClick={onResetUsageMetrics}
                  className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                  title="Clear recorded usage frequency counters for this document"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
