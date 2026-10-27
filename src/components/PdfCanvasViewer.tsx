import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  AlertCircle,
  Sparkles,
  Sliders,
  Layers,
  CheckSquare,
  ListFilter,
  Type,
  FolderArchive,
  Download,
  Filter,
  Columns,
  Square,
  FileDiff,
  Upload,
  ArrowLeftRight,
  Link2,
  Link2Off,
  RefreshCw,
  X,
  FileCheck,
  FolderTree,
} from 'lucide-react';
import { pdfjsLib } from '../utils/pdfWorker';
import { XFAField, XFAFieldAppearance, XFASubform } from '../types/pdf';
import { XfaFieldOverlay } from './XfaFieldOverlay';
import { FieldPropertiesInspector } from './FieldPropertiesInspector';
import { QuickNavTree } from './QuickNavTree';
import { createSampleComparisonPdf } from '../utils/samplePdfs';
import { extractXfaPackets, parseXfaTemplate } from '../utils/xfaEngine';
import { PDFDocument } from 'pdf-lib';

export type CanvasViewMode = 'single' | 'two_pages' | 'compare_pdfs';

interface PdfCanvasViewerProps {
  pdfBytes: Uint8Array;
  filename?: string;
  hasXfa: boolean;
  fields: XFAField[];
  subforms?: XFASubform[];
  targetFieldId?: string | null;
  onFieldValueChange: (fieldId: string, newValue: string) => void;
  onUpdateFieldAppearance: (fieldId: string, appearance: XFAFieldAppearance, applyToAllOfType: boolean) => void;
  onResetFieldAppearance: (fieldId: string) => void;
  onSwitchToForm: () => void;
  onSwitchToResources: () => void;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  pdfBytes,
  filename = 'Primary_Document.pdf',
  hasXfa,
  fields,
  subforms = [],
  targetFieldId = null,
  onFieldValueChange,
  onUpdateFieldAppearance,
  onResetFieldAppearance,
  onSwitchToForm,
  onSwitchToResources,
}) => {
  // Mode selection: Single Page vs Two Pages of Same PDF vs Compare 2 PDFs
  const [viewMode, setViewMode] = useState<CanvasViewMode>('single');

  // Primary PDF Document State
  const [primaryPdfDoc, setPrimaryPdfDoc] = useState<any>(null);
  const [primaryPage, setPrimaryPage] = useState(1);
  const [primaryNumPages, setPrimaryNumPages] = useState(1);
  const [isPrimaryLoading, setIsPrimaryLoading] = useState(false);
  const [primaryRenderError, setPrimaryRenderError] = useState<string | null>(null);

  // Secondary Pane (Right Pane in Two Pages or Comparison mode)
  const [secondaryPage, setSecondaryPage] = useState(2);
  const [syncPageTurns, setSyncPageTurns] = useState(true);
  const [syncZoom, setSyncZoom] = useState(true);

  // Secondary PDF Document State (for Compare Two PDFs mode)
  const [secondaryPdfBytes, setSecondaryPdfBytes] = useState<Uint8Array | null>(null);
  const [secondaryFilename, setSecondaryFilename] = useState<string>('Revision_B_Enterprise.pdf');
  const [secondaryPdfDoc, setSecondaryPdfDoc] = useState<any>(null);
  const [secondaryNumPages, setSecondaryNumPages] = useState(1);
  const [secondaryFields, setSecondaryFields] = useState<XFAField[]>([]);
  const [secondaryHasXfa, setSecondaryHasXfa] = useState(false);
  const [isSecondaryLoading, setIsSecondaryLoading] = useState(false);
  const [secondaryRenderError, setSecondaryRenderError] = useState<string | null>(null);

  // Zoom scale
  const [primaryScale, setPrimaryScale] = useState(1.1);
  const [secondaryScale, setSecondaryScale] = useState(1.1);

  // Canvas Refs & Dimensions
  const primaryCanvasRef = useRef<HTMLCanvasElement>(null);
  const secondaryCanvasRef = useRef<HTMLCanvasElement>(null);

  const [primaryDims, setPrimaryDims] = useState<{ width: number; height: number; origW: number; origH: number }>({
    width: 0,
    height: 0,
    origW: 612,
    origH: 792,
  });

  const [secondaryDims, setSecondaryDims] = useState<{ width: number; height: number; origW: number; origH: number }>({
    width: 0,
    height: 0,
    origW: 612,
    origH: 792,
  });

  // Field Recognition, Quick Nav & Inspector
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showBadges, setShowBadges] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showInspector, setShowInspector] = useState(true);
  const [showQuickNav, setShowQuickNav] = useState(true);

  // Jump directly to an XFA form field from Quick Nav tree
  const handleJumpToField = useCallback((field: XFAField) => {
    const targetPage = field.bounds?.pageNumber || 1;
    setPrimaryPage(targetPage);
    setSelectedFieldId(field.id);
    if (!showBoundaries) {
      setShowBoundaries(true);
    }
    if (!showInspector) {
      setShowInspector(true);
    }
  }, [showBoundaries, showInspector]);

  // Synchronize target field from external jump (e.g. Header Global Search)
  useEffect(() => {
    if (targetFieldId) {
      const match = fields.find(f => f.id === targetFieldId) || secondaryFields.find(f => f.id === targetFieldId);
      if (match) {
        handleJumpToField(match);
      }
    }
  }, [targetFieldId, fields, secondaryFields, handleJumpToField]);

  const comparisonFileInputRef = useRef<HTMLInputElement>(null);

  // Active fields based on selected pane & page
  const primaryPageFields = fields.filter(f => (f.bounds?.pageNumber || 1) === primaryPage);
  const secondaryPageFields = (viewMode === 'compare_pdfs' ? secondaryFields : fields).filter(
    f => (f.bounds?.pageNumber || 1) === secondaryPage
  );

  const selectedField =
    fields.find(f => f.id === selectedFieldId) ||
    secondaryFields.find(f => f.id === selectedFieldId) ||
    null;

  // 1. Load Primary PDF via PDF.js
  useEffect(() => {
    let active = true;
    const loadPdf = async () => {
      try {
        setIsPrimaryLoading(true);
        setPrimaryRenderError(null);
        const task = pdfjsLib.getDocument({
          data: pdfBytes.slice(0),
          enableXfa: true,
        });
        const doc = await task.promise;
        if (!active) return;
        setPrimaryPdfDoc(doc);
        setPrimaryNumPages(doc.numPages);
        setPrimaryPage(1);
        if (doc.numPages > 1) {
          setSecondaryPage(2);
        } else {
          setSecondaryPage(1);
        }
      } catch (err: any) {
        if (!active) return;
        console.error('Primary PDF render init error:', err);
        setPrimaryRenderError(`Could not render primary PDF: ${err.message}`);
      } finally {
        if (active) setIsPrimaryLoading(false);
      }
    };

    loadPdf();
    return () => {
      active = false;
    };
  }, [pdfBytes]);

  // 2. Render Primary Canvas Page
  useEffect(() => {
    if (!primaryPdfDoc || !primaryCanvasRef.current) return;
    let renderTask: any = null;
    let isCancelled = false;

    const render = async () => {
      try {
        const page = await primaryPdfDoc.getPage(primaryPage);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: primaryScale });
        const unscaledViewport = page.getViewport({ scale: 1 });
        const canvas = primaryCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = viewport.width * pixelRatio;
        canvas.height = viewport.height * pixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        setPrimaryDims({
          width: viewport.width,
          height: viewport.height,
          origW: unscaledViewport.width,
          origH: unscaledViewport.height,
        });

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        renderTask = page.render({
          canvasContext: ctx,
          viewport: viewport,
        });
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.warn('Primary Page render error:', err);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (renderTask) renderTask.cancel();
    };
  }, [primaryPdfDoc, primaryPage, primaryScale]);

  // 3. Render Secondary Canvas (either 2nd page of same PDF or comparison PDF)
  useEffect(() => {
    if (viewMode === 'single') return;

    const docToRender = viewMode === 'compare_pdfs' ? secondaryPdfDoc : primaryPdfDoc;
    if (!docToRender || !secondaryCanvasRef.current) return;

    let renderTask: any = null;
    let isCancelled = false;

    const renderSecondary = async () => {
      try {
        const targetPageNum = Math.min(
          docToRender.numPages,
          Math.max(1, secondaryPage)
        );
        const page = await docToRender.getPage(targetPageNum);
        if (isCancelled) return;

        const scale = syncZoom ? primaryScale : secondaryScale;
        const viewport = page.getViewport({ scale });
        const unscaledViewport = page.getViewport({ scale: 1 });
        const canvas = secondaryCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = viewport.width * pixelRatio;
        canvas.height = viewport.height * pixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        setSecondaryDims({
          width: viewport.width,
          height: viewport.height,
          origW: unscaledViewport.width,
          origH: unscaledViewport.height,
        });

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        renderTask = page.render({
          canvasContext: ctx,
          viewport: viewport,
        });
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.warn('Secondary Page render error:', err);
        }
      }
    };

    renderSecondary();

    return () => {
      isCancelled = true;
      if (renderTask) renderTask.cancel();
    };
  }, [viewMode, secondaryPdfDoc, primaryPdfDoc, secondaryPage, primaryScale, secondaryScale, syncZoom]);

  // 4. Load Secondary Comparison PDF Bytes
  const loadSecondaryPdfBytes = useCallback(async (bytes: Uint8Array, name: string) => {
    setIsSecondaryLoading(true);
    setSecondaryRenderError(null);
    setSecondaryFilename(name);
    setSecondaryPdfBytes(bytes);

    try {
      // PDF.js instance for secondary rendering
      const task = pdfjsLib.getDocument({
        data: bytes.slice(0),
        enableXfa: true,
      });
      const doc = await task.promise;
      setSecondaryPdfDoc(doc);
      setSecondaryNumPages(doc.numPages);
      setSecondaryPage(1);

      // Extract XFA packets for secondary PDF if available
      try {
        const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const packets = await extractXfaPackets(pdfDoc, bytes);
        if (packets.templateXml || packets.datasetsXml) {
          const subforms = parseXfaTemplate(packets.templateXml, packets.datasetsXml);
          const compFields: XFAField[] = [];
          const collect = (list: typeof subforms) => {
            list.forEach(sf => {
              compFields.push(...sf.fields);
              if (sf.subforms.length > 0) collect(sf.subforms);
            });
          };
          collect(subforms);
          setSecondaryFields(compFields);
          setSecondaryHasXfa(true);
        } else {
          setSecondaryFields([]);
          setSecondaryHasXfa(false);
        }
      } catch {
        setSecondaryFields([]);
        setSecondaryHasXfa(false);
      }
    } catch (err: any) {
      console.error('Error loading secondary comparison PDF:', err);
      setSecondaryRenderError(`Failed to load comparison PDF: ${err.message}`);
    } finally {
      setIsSecondaryLoading(false);
    }
  }, []);

  // One-click load sample comparison PDF (Revision B with 2 pages and revised XFA fields)
  const handleLoadSampleComparison = async () => {
    try {
      const bytes = await createSampleComparisonPdf();
      await loadSecondaryPdfBytes(bytes, 'Enterprise_Registry_Form_842_RevB.pdf');
      setViewMode('compare_pdfs');
    } catch (err: any) {
      console.error('Failed to generate sample comparison PDF:', err);
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setPrimaryScale(s => Math.min(2.5, +(s + 0.15).toFixed(2)));
    if (syncZoom) {
      setSecondaryScale(s => Math.min(2.5, +(s + 0.15).toFixed(2)));
    }
  };

  const handleZoomOut = () => {
    setPrimaryScale(s => Math.max(0.5, +(s - 0.15).toFixed(2)));
    if (syncZoom) {
      setSecondaryScale(s => Math.max(0.5, +(s - 0.15).toFixed(2)));
    }
  };

  const handleResetZoom = () => {
    const defaultScale = viewMode === 'single' ? 1.2 : 0.95;
    setPrimaryScale(defaultScale);
    setSecondaryScale(defaultScale);
  };

  // Page navigation logic
  const handlePrimaryNext = () => {
    if (primaryPage < primaryNumPages) {
      const nextP = primaryPage + 1;
      setPrimaryPage(nextP);
      if (viewMode === 'two_pages' && syncPageTurns) {
        setSecondaryPage(p => Math.min(primaryNumPages, p + 1));
      } else if (viewMode === 'compare_pdfs' && syncPageTurns) {
        setSecondaryPage(p => Math.min(secondaryNumPages, p + 1));
      }
      setSelectedFieldId(null);
    }
  };

  const handlePrimaryPrev = () => {
    if (primaryPage > 1) {
      const prevP = primaryPage - 1;
      setPrimaryPage(prevP);
      if (viewMode === 'two_pages' && syncPageTurns) {
        setSecondaryPage(p => Math.max(1, p - 1));
      } else if (viewMode === 'compare_pdfs' && syncPageTurns) {
        setSecondaryPage(p => Math.max(1, p - 1));
      }
      setSelectedFieldId(null);
    }
  };

  // Secondary page prev/next
  const handleSecondaryNext = () => {
    const maxP = viewMode === 'compare_pdfs' ? secondaryNumPages : primaryNumPages;
    if (secondaryPage < maxP) {
      setSecondaryPage(p => Math.min(maxP, p + 1));
      setSelectedFieldId(null);
    }
  };

  const handleSecondaryPrev = () => {
    if (secondaryPage > 1) {
      setSecondaryPage(p => Math.max(1, p - 1));
      setSelectedFieldId(null);
    }
  };

  // Swap Left and Right pages/documents
  const handleSwapPanes = () => {
    if (viewMode === 'two_pages') {
      const temp = primaryPage;
      setPrimaryPage(secondaryPage);
      setSecondaryPage(temp);
    }
  };

  // Auto-switch zoom to fit side-by-side when activating split view
  const handleModeChange = (mode: CanvasViewMode) => {
    setViewMode(mode);
    if (mode !== 'single') {
      // Comfortable scale for dual pane
      setPrimaryScale(0.95);
      setSecondaryScale(0.95);
      if (mode === 'compare_pdfs' && !secondaryPdfBytes) {
        // Auto-load sample revision if not loaded yet
        handleLoadSampleComparison();
      }
    } else {
      setPrimaryScale(1.2);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-5 px-4 sm:px-6 space-y-4">
      {/* Top Banner Notice */}
      {hasXfa && (
        <div className="bg-sky-950/40 border border-sky-800/60 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="text-slate-300">
              <strong className="text-sky-300 font-semibold">Interactive XFA Recognition Active:</strong> Every recognized form field boundary is highlighted on the canvas below.
              Click any field to inspect its geometry, coordinates, XML bindings, or customize its appearance without flattening.
            </div>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={onSwitchToResources}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FolderArchive className="w-3.5 h-3.5 text-sky-400" />
              <span>Extract Resources</span>
            </button>
            <button
              onClick={onSwitchToForm}
              className="px-3 py-1 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors cursor-pointer"
            >
              Visual Form Tab
            </button>
          </div>
        </div>
      )}

      {/* Main Viewer Controls Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Left: View Mode Selector (Single vs Two Pages vs Compare) */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => handleModeChange('single')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'single'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Single page focused view"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Single Page</span>
          </button>

          <button
            onClick={() => handleModeChange('two_pages')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'two_pages'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="View two pages of this PDF side-by-side"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Two Pages (Spread)</span>
            {primaryNumPages > 1 && (
              <span className="text-[10px] px-1 bg-sky-950 text-sky-300 rounded font-mono">
                {primaryNumPages} pgs
              </span>
            )}
          </button>

          <button
            onClick={() => handleModeChange('compare_pdfs')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'compare_pdfs'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Compare two different PDFs side-by-side"
          >
            <FileDiff className="w-3.5 h-3.5" />
            <span>Compare 2 PDFs</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-purple-950/80 text-purple-300 border border-purple-800/80 rounded font-mono">
              Diff Mode
            </span>
          </button>
        </div>

        {/* Center: Recognition Toggles & Sync options */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Quick Nav Hierarchy Toggle */}
          {hasXfa && (
            <button
              onClick={() => setShowQuickNav(!showQuickNav)}
              className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                showQuickNav
                  ? 'bg-sky-950/70 border-sky-600/70 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Quick Navigation hierarchical field panel"
            >
              <FolderTree className="w-3.5 h-3.5 text-sky-400" />
              <span>Quick Nav</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-sky-300 rounded font-mono">
                {fields.length}
              </span>
            </button>
          )}

          {/* Synchronized Page Turning (when in side-by-side mode) */}
          {viewMode !== 'single' && (
            <button
              onClick={() => setSyncPageTurns(!syncPageTurns)}
              className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                syncPageTurns
                  ? 'bg-indigo-950/70 border-indigo-600/70 text-indigo-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Synchronize page navigation across both panes"
            >
              {syncPageTurns ? <Link2 className="w-3.5 h-3.5 text-indigo-400" /> : <Link2Off className="w-3.5 h-3.5 text-slate-500" />}
              <span>Sync Pages</span>
            </button>
          )}

          {/* Highlight Boundaries Toggle */}
          {hasXfa && (
            <button
              onClick={() => setShowBoundaries(!showBoundaries)}
              className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                showBoundaries
                  ? 'bg-sky-950/70 border-sky-600/70 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle bounding box highlights around XFA form fields"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Boundaries</span>
            </button>
          )}

          {/* Type Badges Toggle */}
          {hasXfa && (
            <button
              onClick={() => setShowBadges(!showBadges)}
              className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                showBadges
                  ? 'bg-sky-950/70 border-sky-600/70 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Show or hide field type labels on boundaries"
            >
              Type Badges
            </button>
          )}

          {/* Filter by Field Type */}
          {hasXfa && (
            <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800 rounded-md px-2 py-0.5">
              <Filter className="w-3 h-3 text-slate-500" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Fields</option>
                <option value="text" className="bg-slate-900">Text Fields</option>
                <option value="check" className="bg-slate-900">Checkboxes</option>
                <option value="choice" className="bg-slate-900">Dropdowns</option>
                <option value="numeric" className="bg-slate-900">Numeric</option>
                <option value="date" className="bg-slate-900">Dates</option>
                <option value="signature" className="bg-slate-900">Signatures</option>
              </select>
            </div>
          )}
        </div>

        {/* Right: Zoom Controls & Inspector Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono text-slate-400 tabular-nums px-1">
              {Math.round(primaryScale * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={handleResetZoom}
              className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {hasXfa && (
            <button
              onClick={() => setShowInspector(!showInspector)}
              className={`p-1.5 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                showInspector
                  ? 'bg-sky-950 border-sky-600 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Field Properties & Appearance Inspector"
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">Inspector</span>
            </button>
          )}
        </div>
      </div>

      {/* Comparison Difference Summary Bar (Visible only when comparing 2 PDFs) */}
      {viewMode === 'compare_pdfs' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400">
              <FileDiff className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-slate-100 flex items-center gap-2">
                <span>Side-by-Side Document Comparison</span>
                <span className="text-[10px] px-2 py-0.2 bg-purple-950 text-purple-300 border border-purple-800 rounded-full font-mono">
                  Live Diff
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-3">
                <span>
                  Left: <strong className="text-slate-200 font-medium">{filename}</strong> ({primaryNumPages} pgs, {fields.length} fields)
                </span>
                <span>vs</span>
                <span>
                  Right: <strong className="text-slate-200 font-medium">{secondaryFilename}</strong> ({secondaryNumPages} pgs, {secondaryFields.length} fields)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Comparison Actions */}
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <input
              type="file"
              ref={comparisonFileInputRef}
              accept=".pdf"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) {
                  const buffer = await file.arrayBuffer();
                  await loadSecondaryPdfBytes(new Uint8Array(buffer), file.name);
                }
                e.target.value = '';
              }}
            />

            <button
              onClick={() => comparisonFileInputRef.current?.click()}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Upload PDF to Compare</span>
            </button>

            <button
              onClick={handleLoadSampleComparison}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Load Revision B sample with updated fields and multi-page addendum"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Revision B Sample</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Dual-Viewport Area */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch min-h-[660px]">
        {/* Left Docked Quick Navigation Panel */}
        {hasXfa && showQuickNav && (
          <div className="w-full lg:w-72 shrink-0 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col h-[600px] lg:h-auto">
            <QuickNavTree
              subforms={subforms}
              fields={fields}
              selectedFieldId={selectedFieldId}
              currentPage={primaryPage}
              onSelectField={handleJumpToField}
              onClose={() => setShowQuickNav(false)}
            />
          </div>
        )}

        {/* Left Pane (Primary Document or Page A) */}
        <div className="flex-1 min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          {/* Left Pane Header & Page Controls */}
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate pr-2">
              <span className="font-semibold text-slate-200 truncate" title={filename}>
                {viewMode === 'two_pages' ? `Page ${primaryPage} (Left)` : filename}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded font-mono shrink-0">
                {hasXfa ? 'XFA' : 'Standard'}
              </span>
            </div>

            {/* Left Page Navigator */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                disabled={primaryPage <= 1}
                onClick={handlePrimaryPrev}
                className="p-1 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors disabled:opacity-40 cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono text-slate-400 px-1 select-none">
                <strong className="text-slate-200">{primaryPage}</strong> / {primaryNumPages}
              </span>

              <button
                disabled={primaryPage >= primaryNumPages}
                onClick={handlePrimaryNext}
                className="p-1 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors disabled:opacity-40 cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {viewMode === 'two_pages' && (
                <button
                  onClick={handleSwapPanes}
                  className="p-1 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded ml-1 transition-colors cursor-pointer"
                  title="Swap Left and Right Pages"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Left Canvas Scroll Area */}
          <div
            onClick={() => setSelectedFieldId(null)}
            className="flex-1 bg-slate-950 p-6 flex items-center justify-center overflow-auto shadow-inner relative min-h-[480px]"
          >
            {isPrimaryLoading && (
              <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                <span>Rendering Left Document Canvas...</span>
              </div>
            )}

            {primaryRenderError && (
              <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{primaryRenderError}</span>
              </div>
            )}

            {/* Canvas & Overlay Stack */}
            <div
              className="relative shadow-2xl rounded-sm border border-slate-700/50 bg-white inline-block"
              onClick={e => e.stopPropagation()}
            >
              <canvas ref={primaryCanvasRef} className="block" />

              {/* Recognized XFA Form Field Boundary Overlay */}
              {hasXfa && (
                <XfaFieldOverlay
                  fields={fields}
                  currentPage={primaryPage}
                  canvasWidth={primaryDims.width}
                  canvasHeight={primaryDims.height}
                  pdfPageWidth={primaryDims.origW}
                  pdfPageHeight={primaryDims.origH}
                  scale={primaryScale}
                  selectedFieldId={selectedFieldId}
                  onSelectField={f => {
                    setSelectedFieldId(f.id);
                    if (!showInspector) setShowInspector(true);
                  }}
                  showBoundaries={showBoundaries}
                  showBadges={showBadges}
                  typeFilter={typeFilter}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Pane (Visible in 'two_pages' and 'compare_pdfs' modes) */}
        {viewMode !== 'single' && (
          <div className="flex-1 min-w-0 bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
            {/* Right Pane Header & Page Controls */}
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate pr-2">
                <span className="font-semibold text-slate-200 truncate" title={viewMode === 'two_pages' ? `Page ${secondaryPage} (Right)` : secondaryFilename}>
                  {viewMode === 'two_pages' ? `Page ${secondaryPage} (Right)` : secondaryFilename}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 bg-purple-950/80 text-purple-300 border border-purple-800/80 rounded font-mono shrink-0">
                  {viewMode === 'two_pages' ? 'Page 2' : (secondaryHasXfa ? 'XFA Comp' : 'Standard')}
                </span>
              </div>

              {/* Right Page Navigator */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  disabled={secondaryPage <= 1}
                  onClick={handleSecondaryPrev}
                  className="p-1 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors disabled:opacity-40 cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs font-mono text-slate-400 px-1 select-none">
                  <strong className="text-slate-200">{secondaryPage}</strong> /{' '}
                  {viewMode === 'compare_pdfs' ? secondaryNumPages : primaryNumPages}
                </span>

                <button
                  disabled={
                    secondaryPage >= (viewMode === 'compare_pdfs' ? secondaryNumPages : primaryNumPages)
                  }
                  onClick={handleSecondaryNext}
                  className="p-1 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors disabled:opacity-40 cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right Canvas Scroll Area */}
            <div
              onClick={() => setSelectedFieldId(null)}
              className="flex-1 bg-slate-950 p-6 flex items-center justify-center overflow-auto shadow-inner relative min-h-[480px]"
            >
              {isSecondaryLoading && (
                <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  <span>Rendering Right Document Canvas...</span>
                </div>
              )}

              {secondaryRenderError && (
                <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{secondaryRenderError}</span>
                </div>
              )}

              {/* Canvas & Overlay Stack */}
              <div
                className="relative shadow-2xl rounded-sm border border-slate-700/50 bg-white inline-block"
                onClick={e => e.stopPropagation()}
              >
                <canvas ref={secondaryCanvasRef} className="block" />

                {/* Recognized XFA Form Field Boundary Overlay on Right Pane */}
                {(viewMode === 'two_pages' ? hasXfa : secondaryHasXfa) && (
                  <XfaFieldOverlay
                    fields={viewMode === 'two_pages' ? fields : secondaryFields}
                    currentPage={secondaryPage}
                    canvasWidth={secondaryDims.width}
                    canvasHeight={secondaryDims.height}
                    pdfPageWidth={secondaryDims.origW}
                    pdfPageHeight={secondaryDims.origH}
                    scale={syncZoom ? primaryScale : secondaryScale}
                    selectedFieldId={selectedFieldId}
                    onSelectField={f => {
                      setSelectedFieldId(f.id);
                      if (!showInspector) setShowInspector(true);
                    }}
                    showBoundaries={showBoundaries}
                    showBadges={showBadges}
                    typeFilter={typeFilter}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Right Docked Inspector */}
        {hasXfa && showInspector && (
          <div className="w-full lg:w-84 shrink-0 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
            <FieldPropertiesInspector
              selectedField={selectedField}
              allFieldsOnPage={primaryPageFields}
              onSelectField={f => setSelectedFieldId(f.id)}
              onFieldValueChange={onFieldValueChange}
              onUpdateAppearance={onUpdateFieldAppearance}
              onResetAppearance={onResetFieldAppearance}
              onClose={() => setSelectedFieldId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
