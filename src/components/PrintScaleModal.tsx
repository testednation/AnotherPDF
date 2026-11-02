import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Printer,
  Download,
  ArrowRight,
  ArrowLeftRight,
  Maximize2,
  Sliders,
  Check,
  X,
  Sparkles,
  AlertTriangle,
  FileCheck,
  Ruler,
  Layers,
  RotateCw,
  Scissors,
  Eye,
} from 'lucide-react';
import { pdfjsLib } from '../utils/pdfWorker';
import { XFAField } from '../types/pdf';
import { PageAnnotations } from '../types/drawing';
import {
  PaperSizeId,
  PrintScaleOptions,
  PrintScalingMode,
  PageOrientation,
  MarginPreset,
  PageAlignment,
  PaperUnit,
} from '../types/printScale';
import {
  PAPER_SIZE_CATALOG,
  POPULAR_SCALE_PRESETS,
  detectPaperSizeFromPoints,
  computeScaleMetrics,
  generateScaledPrintPdf,
  triggerBrowserPrintPdf,
} from '../utils/printScaleEngine';

interface PrintScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array;
  filename: string;
  fields: XFAField[];
  pageAnnotations?: PageAnnotations;
  onShowToast?: (msg: string) => void;
}

export const PrintScaleModal: React.FC<PrintScaleModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  filename,
  fields,
  pageAnnotations = {},
  onShowToast,
}) => {
  // Detected source PDF page 1 dimensions (in PDF points, 72 pt = 1 in)
  const [detectedPageDims, setDetectedPageDims] = useState<{
    widthPt: number;
    heightPt: number;
    numPages: number;
  }>({
    widthPt: 612,
    heightPt: 792,
    numPages: 1,
  });

  const [displayUnit, setDisplayUnit] = useState<PaperUnit>('in');
  const [previewPageThumbnail, setPreviewPageThumbnail] = useState<string | null>(null);

  const [options, setOptions] = useState<PrintScaleOptions>({
    sourceSizeId: 'auto_detected',
    sourceCustomWidthPt: 612,
    sourceCustomHeightPt: 792,
    targetSizeId: 'a4',
    targetCustomWidthPt: 595.28,
    targetCustomHeightPt: 841.89,
    targetOrientation: 'auto',
    scalingMode: 'fit_printable',
    customScalePercent: 94,
    marginPreset: 'minimal',
    customMarginPt: 18,
    alignment: 'center',
    includeCropMarks: false,
    includeScaleFooter: true,
    outputMode: 'flattened',
    dpiScale: 2.0,
    includeFormValues: true,
    includeAnnotations: true,
    pageAnnotations,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    message: string;
    percent: number;
  } | null>(null);

  const [scaledResult, setScaledResult] = useState<{
    bytes: Uint8Array;
    downloadUrl: string;
    downloadName: string;
    sizeBytes: number;
    scalePercent: number;
  } | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load first page dimensions and render a thumbnail for the live visual sheet preview
  useEffect(() => {
    if (!isOpen || !pdfBytes) return;

    let cancelled = false;
    const inspectAndRenderThumb = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: pdfBytes.slice(0),
          enableXfa: true,
        });
        const doc = await loadingTask.promise;
        if (cancelled) return;

        const page1 = await doc.getPage(1);
        if (cancelled) return;

        const vp = page1.getViewport({ scale: 1.0 });
        setDetectedPageDims({
          widthPt: vp.width,
          heightPt: vp.height,
          numPages: doc.numPages,
        });

        // Auto-select smart default target size opposite of detected source
        const detected = detectPaperSizeFromPoints(vp.width, vp.height);
        setOptions(prev => ({
          ...prev,
          targetSizeId: detected.matchedSpec.id === 'a4' ? 'letter' : 'a4',
        }));

        // Render thumbnail for live sheet preview
        const thumbVp = page1.getViewport({ scale: 0.6 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(thumbVp.width);
        canvas.height = Math.round(thumbVp.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page1.render({
            canvasContext: ctx,
            viewport: thumbVp,
            canvas: canvas as any,
          }).promise;
          if (!cancelled && isMountedRef.current) {
            setPreviewPageThumbnail(canvas.toDataURL('image/png'));
          }
        }
      } catch (e) {
        console.warn('Preview inspection warning:', e);
      }
    };

    inspectAndRenderThumb();
    return () => {
      cancelled = true;
    };
  }, [isOpen, pdfBytes]);

  // Reset cached output whenever scaling options change
  useEffect(() => {
    setScaledResult(null);
  }, [
    options.sourceSizeId,
    options.targetSizeId,
    options.targetCustomWidthPt,
    options.targetCustomHeightPt,
    options.targetOrientation,
    options.scalingMode,
    options.customScalePercent,
    options.marginPreset,
    options.customMarginPt,
    options.alignment,
    options.includeCropMarks,
    options.includeScaleFooter,
    options.outputMode,
    options.dpiScale,
    options.includeFormValues,
    options.includeAnnotations,
  ]);

  const detectedSourceInfo = useMemo(() => {
    return detectPaperSizeFromPoints(
      detectedPageDims.widthPt,
      detectedPageDims.heightPt
    );
  }, [detectedPageDims]);

  const metrics = useMemo(() => {
    return computeScaleMetrics(
      detectedPageDims.widthPt,
      detectedPageDims.heightPt,
      {
        ...options,
        pageAnnotations,
      }
    );
  }, [detectedPageDims, options, pageAnnotations]);

  if (!isOpen) return null;

  const formatDim = (pt: number): string => {
    if (displayUnit === 'in') {
      return `${(pt / 72).toFixed(2)}"`;
    }
    if (displayUnit === 'mm') {
      return `${Math.round((pt / 72) * 25.4)} mm`;
    }
    return `${Math.round(pt)} pt`;
  };

  const formatPair = (wPt: number, hPt: number): string => {
    if (displayUnit === 'in') {
      return `${(wPt / 72).toFixed(2)} × ${(hPt / 72).toFixed(2)} in`;
    }
    if (displayUnit === 'mm') {
      return `${Math.round((wPt / 72) * 25.4)} × ${Math.round((hPt / 72) * 25.4)} mm`;
    }
    return `${Math.round(wPt)} × ${Math.round(hPt)} pt`;
  };

  const handleSwapSizes = () => {
    const currentEffectiveSource: PaperSizeId =
      options.sourceSizeId === 'auto_detected'
        ? detectedSourceInfo.matchedSpec.id
        : options.sourceSizeId;
    const currentTarget = options.targetSizeId;

    setOptions(prev => ({
      ...prev,
      sourceSizeId: currentTarget,
      targetSizeId: currentEffectiveSource,
    }));
  };

  const handleApplyPreset = (sourceId: PaperSizeId, targetId: PaperSizeId) => {
    setOptions(prev => ({
      ...prev,
      sourceSizeId: sourceId,
      targetSizeId: targetId,
      scalingMode: 'fit_printable',
    }));
  };

  const buildScaledPdf = async (): Promise<{
    bytes: Uint8Array;
    downloadUrl: string;
    downloadName: string;
    sizeBytes: number;
    scalePercent: number;
  } | null> => {
    setIsProcessing(true);
    setProgress({
      current: 0,
      total: detectedPageDims.numPages,
      message: 'Initializing print scaling engine...',
      percent: 5,
    });

    try {
      const res = await generateScaledPrintPdf(
        pdfBytes,
        fields,
        {
          ...options,
          pageAnnotations,
        },
        setProgress
      );

      const blob = new Blob([res.bytes as any], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const targetSpec = PAPER_SIZE_CATALOG[options.targetSizeId];
      const baseName = filename.replace(/\.pdf$/i, '');
      const scaleTag = `${Math.round(res.metrics.effectiveScalePercent)}pct`;
      const downloadName = `${baseName}_scaled_${targetSpec.id.toUpperCase()}_${scaleTag}.pdf`;

      const resultObj = {
        bytes: res.bytes,
        downloadUrl,
        downloadName,
        sizeBytes: res.bytes.byteLength,
        scalePercent: res.metrics.effectiveScalePercent,
      };
      setScaledResult(resultObj);
      return resultObj;
    } catch (err: any) {
      console.error('Print scaling error:', err);
      onShowToast?.(`Print scaling failed: ${err.message}`);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadScaledPdf = async () => {
    const ready = scaledResult || (await buildScaledPdf());
    if (!ready) return;

    const a = document.createElement('a');
    a.href = ready.downloadUrl;
    a.download = ready.downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const targetSpec = PAPER_SIZE_CATALOG[options.targetSizeId];
    onShowToast?.(
      `Exported scaled printout for ${targetSpec.name} (${ready.scalePercent}% scale)`
    );
  };

  const handlePrintNow = async () => {
    const ready = scaledResult || (await buildScaledPdf());
    if (!ready) return;

    const targetSpec = PAPER_SIZE_CATALOG[options.targetSizeId];
    onShowToast?.(
      `Opening system print dialog formatted for ${targetSpec.name} (${ready.scalePercent}% scale)...`
    );
    triggerBrowserPrintPdf(ready.bytes);
  };

  // Visual Preview Box Calculations (fits inside a 260x320 stage)
  const previewStageMaxW = 240;
  const previewStageMaxH = 300;
  const stageScale = Math.min(
    previewStageMaxW / metrics.targetSheetWidthPt,
    previewStageMaxH / metrics.targetSheetHeightPt
  );
  const sheetPxW = Math.round(metrics.targetSheetWidthPt * stageScale);
  const sheetPxH = Math.round(metrics.targetSheetHeightPt * stageScale);
  const marginPx = Math.round(metrics.marginPt * stageScale);
  const contentPxW = Math.round(metrics.renderedWidthPt * stageScale);
  const contentPxH = Math.round(metrics.renderedHeightPt * stageScale);
  const contentLeftPx = Math.round(metrics.offsetXPt * stageScale);
  // Convert bottom-left offsetYPt to top-left CSS top
  const contentTopPx = Math.round(
    (metrics.targetSheetHeightPt - metrics.offsetYPt - metrics.renderedHeightPt) *
      stageScale
  );

  const effectiveSourceSpec =
    options.sourceSizeId === 'auto_detected'
      ? detectedSourceInfo.matchedSpec
      : PAPER_SIZE_CATALOG[options.sourceSizeId];
  const targetSpec = PAPER_SIZE_CATALOG[options.targetSizeId];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Scale Printout Between Printer Paper Sizes
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                  {metrics.effectiveScalePercent}% Scale
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Rescale page geometry, margins, and interactive form fields from one physical printer tray standard to another without edge cutoff.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Unit Switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px] font-mono">
              {(['in', 'mm', 'pt'] as PaperUnit[]).map(u => (
                <button
                  key={u}
                  onClick={() => setDisplayUnit(u)}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer uppercase ${
                    displayUnit === u
                      ? 'bg-sky-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. Quick 1-Click Printer Size Conversion Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>Quick Printer Tray Conversion Presets</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Detected Document: {detectedSourceInfo.matchedSpec.name} ({formatPair(detectedPageDims.widthPt, detectedPageDims.heightPt)}) · {detectedPageDims.numPages} {detectedPageDims.numPages === 1 ? 'page' : 'pages'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {POPULAR_SCALE_PRESETS.map(preset => {
                const isSelected =
                  (options.sourceSizeId === preset.sourceId ||
                    (options.sourceSizeId === 'auto_detected' &&
                      detectedSourceInfo.matchedSpec.id === preset.sourceId)) &&
                  options.targetSizeId === preset.targetId;

                return (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset.sourceId, preset.targetId)}
                    title={preset.description}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-sky-950/70 border-sky-500 text-sky-200 shadow-sm'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-semibold leading-tight">
                      {preset.label}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-sky-400 bg-sky-950/90 px-1.5 py-0.5 rounded border border-sky-800/60">
                        {preset.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Main Two-Column Grid: Left = Controls, Right = Live Sheet Blueprint */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT 7 COLUMNS: Source/Target Selectors & Scaling Parameters */}
            <div className="lg:col-span-7 space-y-5">
              {/* Source -> Target Paper Size Cards */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
                  {/* Source Paper Size */}
                  <div className="sm:col-span-5 space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                      From Source Paper Size
                    </label>
                    <select
                      value={options.sourceSizeId}
                      onChange={e =>
                        setOptions({
                          ...options,
                          sourceSizeId: e.target.value as PaperSizeId | 'auto_detected',
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-medium focus:outline-none focus:border-sky-500"
                    >
                      <option value="auto_detected">
                        Auto-Detect ({detectedSourceInfo.matchedSpec.name} · {detectedSourceInfo.matchedSpec.shortLabel})
                      </option>
                      {Object.values(PAPER_SIZE_CATALOG).map(spec => (
                        <option key={spec.id} value={spec.id}>
                          {spec.name} ({spec.shortLabel})
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] font-mono text-slate-400">
                      Source: <strong className="text-slate-200">{formatPair(metrics.sourceWidthPt, metrics.sourceHeightPt)}</strong>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="sm:col-span-1 flex justify-center pt-3">
                    <button
                      onClick={handleSwapSizes}
                      title="Swap Source and Target Paper Sizes"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 transition-colors cursor-pointer"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Target Printer Paper Size */}
                  <div className="sm:col-span-5 space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-sky-400 block">
                      To Target Printer Size
                    </label>
                    <select
                      value={options.targetSizeId}
                      onChange={e =>
                        setOptions({
                          ...options,
                          targetSizeId: e.target.value as PaperSizeId,
                        })
                      }
                      className="w-full bg-slate-900 border border-sky-600/70 rounded-lg px-3 py-2 text-xs text-slate-100 font-semibold focus:outline-none focus:border-sky-400"
                    >
                      {Object.values(PAPER_SIZE_CATALOG).map(spec => (
                        <option key={spec.id} value={spec.id}>
                          {spec.name} ({spec.shortLabel})
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] font-mono text-sky-300">
                      Target: <strong>{formatPair(metrics.targetSheetWidthPt, metrics.targetSheetHeightPt)}</strong>
                    </div>
                  </div>
                </div>

                {/* Custom Target Dimensions if 'custom' selected */}
                {options.targetSizeId === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">
                        Custom Target Width (inches)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="2"
                        max="48"
                        value={+(options.targetCustomWidthPt / 72).toFixed(2)}
                        onChange={e =>
                          setOptions({
                            ...options,
                            targetCustomWidthPt: Math.max(144, Number(e.target.value) * 72),
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">
                        Custom Target Height (inches)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="2"
                        max="48"
                        value={+(options.targetCustomHeightPt / 72).toFixed(2)}
                        onChange={e =>
                          setOptions({
                            ...options,
                            targetCustomHeightPt: Math.max(144, Number(e.target.value) * 72),
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Scaling Method & Orientation Controls */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Scaling Mode */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Scaling Method</span>
                    </label>
                    <select
                      value={options.scalingMode}
                      onChange={e =>
                        setOptions({
                          ...options,
                          scalingMode: e.target.value as PrintScalingMode,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    >
                      <option value="fit_printable">
                        Fit to Printable Area (Recommended)
                      </option>
                      <option value="fit_full_page">
                        Fit to Full Paper Sheet (Borderless)
                      </option>
                      <option value="shrink_only">
                        Shrink Oversized Pages Only (Never Enlarge)
                      </option>
                      <option value="fill_page">
                        Fill Entire Printable Area (Expand to Cover)
                      </option>
                      <option value="stretch_exact">
                        Stretch X &amp; Y to Match Target Aspect Ratio
                      </option>
                      <option value="actual_size">
                        Actual Physical Size (100% 1:1 Scale)
                      </option>
                      <option value="custom_scale">
                        Custom Percentage Scale ({options.customScalePercent}%)
                      </option>
                    </select>
                  </div>

                  {/* Target Orientation */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                      <span>Target Sheet Orientation</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                      {(
                        [
                          { id: 'auto', label: 'Auto-Match' },
                          { id: 'portrait', label: 'Portrait' },
                          { id: 'landscape', label: 'Landscape' },
                        ] as { id: PageOrientation; label: string }[]
                      ).map(item => (
                        <button
                          key={item.id}
                          onClick={() =>
                            setOptions({ ...options, targetOrientation: item.id })
                          }
                          className={`py-1.5 px-2 rounded text-xs font-medium transition-colors cursor-pointer ${
                            options.targetOrientation === item.id
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Custom Scale Slider (shown when custom_scale is active or for quick fine-tuning) */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">
                      Scale Ratio Fine-Tuning
                    </span>
                    <span className="font-mono font-bold text-sky-400">
                      {metrics.effectiveScalePercent}% (X: {Math.round(metrics.scaleX * 100)}%, Y: {Math.round(metrics.scaleY * 100)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="25"
                      max="200"
                      step="1"
                      value={
                        options.scalingMode === 'custom_scale'
                          ? options.customScalePercent
                          : Math.round(metrics.effectiveScalePercent)
                      }
                      onChange={e =>
                        setOptions({
                          ...options,
                          scalingMode: 'custom_scale',
                          customScalePercent: Number(e.target.value),
                        })
                      }
                      className="flex-1 accent-sky-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="10"
                        max="300"
                        value={
                          options.scalingMode === 'custom_scale'
                            ? options.customScalePercent
                            : Math.round(metrics.effectiveScalePercent)
                        }
                        onChange={e =>
                          setOptions({
                            ...options,
                            scalingMode: 'custom_scale',
                            customScalePercent: Math.max(
                              10,
                              Math.min(300, Number(e.target.value) || 100)
                            ),
                          })
                        }
                        className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-right text-slate-100"
                      />
                      <span className="text-xs font-mono text-slate-400">%</span>
                    </div>
                  </div>
                </div>

                {/* Printer Hardware Margins & Alignment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-sky-400" />
                      <span>Printer Non-Printable Margin</span>
                    </label>
                    <select
                      value={options.marginPreset}
                      onChange={e =>
                        setOptions({
                          ...options,
                          marginPreset: e.target.value as MarginPreset,
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    >
                      <option value="none">Borderless / Zero Margin (0 in / 0 mm)</option>
                      <option value="minimal">Standard Laser/Inkjet Safe (0.25 in / 6.35 mm)</option>
                      <option value="standard">Office Document Margin (0.50 in / 12.7 mm)</option>
                      <option value="wide">Wide Archival Margin (0.75 in / 19.0 mm)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      <span>Page Placement &amp; Output Mode</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={options.alignment}
                        onChange={e =>
                          setOptions({
                            ...options,
                            alignment: e.target.value as PageAlignment,
                          })
                        }
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                      >
                        <option value="center">Center on Sheet</option>
                        <option value="top_center">Top-Center</option>
                        <option value="top_left">Top-Left Origin</option>
                      </select>

                      <select
                        value={options.outputMode}
                        onChange={e =>
                          setOptions({
                            ...options,
                            outputMode: e.target.value as 'flattened' | 'interactive',
                          })
                        }
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                      >
                        <option value="flattened">Flattened Print PDF</option>
                        <option value="interactive">Interactive AcroForm</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Checkboxes for Print Marks, Values & DPI */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={options.includeCropMarks}
                      onChange={e =>
                        setOptions({ ...options, includeCropMarks: e.target.checked })
                      }
                      className="rounded border-slate-700 bg-slate-900 text-sky-500"
                    />
                    <Scissors className="w-3.5 h-3.5 text-slate-400" />
                    <span>Corner Crop &amp; Trim Marks</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={options.includeScaleFooter}
                      onChange={e =>
                        setOptions({
                          ...options,
                          includeScaleFooter: e.target.checked,
                        })
                      }
                      className="rounded border-slate-700 bg-slate-900 text-sky-500"
                    />
                    <span>Print Scale Calibration Footer</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={options.dpiScale === 3.0}
                      onChange={e =>
                        setOptions({
                          ...options,
                          dpiScale: e.target.checked ? 3.0 : 2.0,
                        })
                      }
                      className="rounded border-slate-700 bg-slate-900 text-sky-500"
                    />
                    <span>300 DPI High-Res Print</span>
                  </label>
                </div>
              </div>
            </div>

            {/* RIGHT 5 COLUMNS: Live Proportional Sheet & Margin Blueprint */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span>Live Target Sheet Blueprint</span>
                </div>
                <span className="text-[11px] font-mono text-sky-400">
                  {targetSpec.name} ({formatPair(metrics.targetSheetWidthPt, metrics.targetSheetHeightPt)})
                </span>
              </div>

              {/* Visual Paper Stage */}
              <div className="flex-1 flex flex-col items-center justify-center py-3 bg-slate-900/60 rounded-lg border border-slate-800/80 relative min-h-[330px]">
                {/* Target Paper Sheet representation */}
                <div
                  className="bg-white shadow-2xl relative overflow-hidden transition-all duration-200 border border-slate-400"
                  style={{
                    width: `${sheetPxW}px`,
                    height: `${sheetPxH}px`,
                  }}
                >
                  {/* Printable Margin Safe Zone Guide */}
                  {marginPx > 0 && (
                    <div
                      className="absolute border border-dashed border-sky-500/60 pointer-events-none z-20"
                      style={{
                        left: `${marginPx}px`,
                        top: `${marginPx}px`,
                        right: `${marginPx}px`,
                        bottom: `${marginPx}px`,
                      }}
                    />
                  )}

                  {/* Scaled Source Page Footprint */}
                  <div
                    className="absolute bg-sky-50 border border-sky-600/80 shadow-xs overflow-hidden flex items-center justify-center transition-all duration-200"
                    style={{
                      left: `${contentLeftPx}px`,
                      top: `${contentTopPx}px`,
                      width: `${contentPxW}px`,
                      height: `${contentPxH}px`,
                    }}
                  >
                    {previewPageThumbnail ? (
                      <img
                        src={previewPageThumbnail}
                        alt="Scaled Page Preview"
                        className="w-full h-full object-fill select-none pointer-events-none"
                      />
                    ) : (
                      <div className="text-[10px] font-mono text-slate-500 text-center p-2">
                        {effectiveSourceSpec.name}
                      </div>
                    )}

                    {/* Scale factor overlay pill */}
                    <div className="absolute bottom-1.5 right-1.5 bg-slate-950/85 text-sky-300 border border-sky-500/40 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow">
                      {metrics.effectiveScalePercent}%
                    </div>
                  </div>
                </div>

                {/* Dimension Legend under sheet */}
                <div className="mt-3 flex items-center gap-3 text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 inline-block bg-white border border-slate-400 rounded-xs" />
                    <span>Sheet: {formatPair(metrics.targetSheetWidthPt, metrics.targetSheetHeightPt)}</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-sky-300">
                    <span className="w-2.5 h-2.5 inline-block border border-dashed border-sky-400 rounded-xs" />
                    <span>Image: {formatPair(metrics.renderedWidthPt, metrics.renderedHeightPt)}</span>
                  </span>
                </div>
              </div>

              {/* Telemetry Summary Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Source Paper Size:</span>
                  <span className="font-mono text-slate-200">
                    {effectiveSourceSpec.name} ({formatPair(metrics.sourceWidthPt, metrics.sourceHeightPt)})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target Printer Tray:</span>
                  <span className="font-mono text-sky-300 font-semibold">
                    {targetSpec.name} ({formatPair(metrics.targetSheetWidthPt, metrics.targetSheetHeightPt)})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Transformation Ratio:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {metrics.effectiveScalePercent}% ({options.scalingMode === 'stretch_exact' ? 'Non-uniform Stretch' : 'Proportional Aspect Preserved'})
                  </span>
                </div>
                {metrics.clipsContent && (
                  <div className="flex items-center gap-1.5 text-amber-300 bg-amber-950/60 border border-amber-800/70 rounded px-2 py-1 mt-1 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>
                      Current scale exceeds target sheet bounds; outer edges will be clipped. Choose "Fit to Printable Area" to prevent cutoff.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar when generating */}
          {isProcessing && progress && (
            <div className="bg-slate-950 border border-sky-800/60 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-sky-300">{progress.message}</span>
                <span className="font-mono text-sky-400">{progress.percent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Output PDF pages will be natively sized to{' '}
              <strong className="text-slate-200">
                {targetSpec.name} ({formatPair(metrics.targetSheetWidthPt, metrics.targetSheetHeightPt)})
              </strong>{' '}
              at <strong className="text-sky-400">{metrics.effectiveScalePercent}%</strong> scale.
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              onClick={handlePrintNow}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5 text-sky-400" />
              <span>Print Scaled Now</span>
            </button>

            <button
              onClick={handleDownloadScaledPdf}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 transition-colors shadow-md cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isProcessing
                  ? 'Scaling Printout...'
                  : `Download Scaled ${targetSpec.name} PDF`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
