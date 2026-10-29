import React from 'react';
import {
  PenTool,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Check,
  Sparkles,
  Edit3,
  Feather,
  Palette,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  DrawingTool,
  DrawingSettings,
  DRAWING_COLOR_PALETTE,
  STROKE_WIDTH_PRESETS,
} from '../types/drawing';

interface DrawingToolbarProps {
  isDrawingMode: boolean;
  onToggleDrawingMode: () => void;
  settings: DrawingSettings;
  onUpdateSettings: (updates: Partial<DrawingSettings>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearPageStrokes: () => void;
  pageStrokeCount: number;
  totalStrokeCount: number;
  currentPage: number;
  onExportDrawingPng?: () => void;
  onExportFlattenedPage?: () => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  isDrawingMode,
  onToggleDrawingMode,
  settings,
  onUpdateSettings,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearPageStrokes,
  pageStrokeCount,
  totalStrokeCount,
  currentPage,
  onExportDrawingPng,
  onExportFlattenedPage,
}) => {
  // Preset buttons: Quick Signature, Audit Mark, Text Highlight
  const handleQuickSignaturePreset = () => {
    if (!isDrawingMode) onToggleDrawingMode();
    onUpdateSettings({
      tool: 'pen',
      color: '#1d4ed8', // Royal Signature Blue
      width: 2,
      opacity: 1.0,
    });
  };

  const handleQuickAuditPreset = () => {
    if (!isDrawingMode) onToggleDrawingMode();
    onUpdateSettings({
      tool: 'pen',
      color: '#dc2626', // Audit Red
      width: 2.5,
      opacity: 1.0,
    });
  };

  const handleQuickHighlighterPreset = () => {
    if (!isDrawingMode) onToggleDrawingMode();
    onUpdateSettings({
      tool: 'highlighter',
      color: '#facc15', // Neon Yellow
      width: 16,
      opacity: 0.35,
    });
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-2.5 transition-all">
      {/* Group 1: Primary Draw Toggle & Tool Selector */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onToggleDrawingMode}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
            isDrawingMode
              ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sky-500/20'
              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
          }`}
          title="Toggle Freehand Drawing / Annotation Mode"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>{isDrawingMode ? 'Drawing Active' : 'Draw / Sign'}</span>
          {totalStrokeCount > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isDrawingMode ? 'bg-sky-950 text-sky-200' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {pageStrokeCount}
            </span>
          )}
        </button>

        {/* Tools (Pen / Highlighter / Eraser) */}
        {isDrawingMode && (
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() =>
                onUpdateSettings({
                  tool: 'pen',
                  opacity: 1.0,
                  width: settings.width > 8 ? 2.5 : settings.width,
                })
              }
              className={`p-1.5 rounded-md text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                settings.tool === 'pen'
                  ? 'bg-sky-600 text-white font-medium shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Ballpoint Pen / Signature Ink"
            >
              <Feather className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pen</span>
            </button>

            <button
              onClick={() =>
                onUpdateSettings({
                  tool: 'highlighter',
                  opacity: 0.35,
                  width: settings.width < 10 ? 16 : settings.width,
                  color: settings.color.startsWith('#1') || settings.color.startsWith('#0') ? '#facc15' : settings.color,
                })
              }
              className={`p-1.5 rounded-md text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                settings.tool === 'highlighter'
                  ? 'bg-yellow-500 text-slate-950 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Translucent Marker Highlighter"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Highlight</span>
            </button>

            <button
              onClick={() => onUpdateSettings({ tool: 'eraser' })}
              className={`p-1.5 rounded-md text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                settings.tool === 'eraser'
                  ? 'bg-rose-600 text-white font-medium shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Stroke Eraser: Click or drag over lines to erase"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Eraser</span>
            </button>
          </div>
        )}
      </div>

      {/* Group 2: Color Palette Swatches (When in Pen or Highlighter mode) */}
      {isDrawingMode && settings.tool !== 'eraser' && (
        <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800/80 rounded-lg px-2 py-1 shrink-0">
          <span className="text-[10px] text-slate-400 font-mono hidden md:inline">Color:</span>
          <div className="flex items-center gap-1">
            {DRAWING_COLOR_PALETTE.filter(c =>
              settings.tool === 'highlighter' ? c.type === 'highlighter' : c.type === 'pen'
            ).map(color => (
              <button
                key={color.hex}
                onClick={() => onUpdateSettings({ color: color.hex })}
                className={`w-5 h-5 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                  settings.color.toLowerCase() === color.hex.toLowerCase()
                    ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 scale-110 shadow-xs'
                    : 'hover:scale-105 opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: color.hex }}
                title={`${color.name} (${color.hex})`}
              >
                {settings.color.toLowerCase() === color.hex.toLowerCase() && (
                  <Check
                    className={`w-3 h-3 ${
                      color.hex === '#facc15' || color.hex === '#38bdf8' || color.hex === '#4ade80'
                        ? 'text-slate-950'
                        : 'text-white'
                    }`}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Stroke Width Selector */}
          <div className="flex items-center gap-1">
            {STROKE_WIDTH_PRESETS.map(preset => (
              <button
                key={preset.value}
                onClick={() => onUpdateSettings({ width: preset.value })}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                  settings.width === preset.value
                    ? 'bg-slate-700 text-sky-300 font-bold border border-slate-600'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={preset.label}
              >
                {preset.value}pt
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Group 3: One-Click Presets for Form Signatures & Notes */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleQuickSignaturePreset}
          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
            isDrawingMode && settings.tool === 'pen' && settings.color === '#1d4ed8'
              ? 'bg-blue-950/80 border-blue-600 text-blue-200'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
          title="Sign Document: Selects fine blue ballpoint ink"
        >
          <Edit3 className="w-3.5 h-3.5 text-blue-400" />
          <span>Sign Form</span>
        </button>

        <button
          onClick={handleQuickHighlighterPreset}
          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
            isDrawingMode && settings.tool === 'highlighter'
              ? 'bg-yellow-950/60 border-yellow-500/80 text-yellow-200'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
          title="Highlight Text: Selects neon yellow translucent marker"
        >
          <Highlighter className="w-3.5 h-3.5 text-yellow-400" />
          <span className="hidden sm:inline">Highlight</span>
        </button>

        <button
          onClick={handleQuickAuditPreset}
          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
            isDrawingMode && settings.tool === 'pen' && settings.color === '#dc2626'
              ? 'bg-red-950/60 border-red-600 text-red-200'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
          title="Red Pen: For corrections, audits, and checklists"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          <span className="hidden sm:inline">Red Pen</span>
        </button>
      </div>

      {/* Group 4: Undo, Redo, Clear Page, Export */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Undo Stroke (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5 text-sky-400" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Redo Stroke (Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5 text-sky-400" />
        </button>

        {pageStrokeCount > 0 && (
          <button
            onClick={onClearPageStrokes}
            className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 rounded-md transition-colors cursor-pointer"
            title={`Clear ${pageStrokeCount} strokes on Page ${currentPage}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Export Drawing Layer PNG Button */}
        {pageStrokeCount > 0 && onExportDrawingPng && (
          <button
            onClick={onExportDrawingPng}
            className="px-2 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
            title="Download transparent PNG of page annotations & signatures"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Export Ink</span>
          </button>
        )}
      </div>
    </div>
  );
};
