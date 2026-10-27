import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { pdfjsLib } from '../utils/pdfWorker';
import { XFAField, XFAFieldAppearance } from '../types/pdf';
import { XfaFieldOverlay } from './XfaFieldOverlay';
import { FieldPropertiesInspector } from './FieldPropertiesInspector';

interface PdfCanvasViewerProps {
  pdfBytes: Uint8Array;
  hasXfa: boolean;
  fields: XFAField[];
  onFieldValueChange: (fieldId: string, newValue: string) => void;
  onUpdateFieldAppearance: (fieldId: string, appearance: XFAFieldAppearance, applyToAllOfType: boolean) => void;
  onResetFieldAppearance: (fieldId: string) => void;
  onSwitchToForm: () => void;
  onSwitchToResources: () => void;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  pdfBytes,
  hasXfa,
  fields,
  onFieldValueChange,
  onUpdateFieldAppearance,
  onResetFieldAppearance,
  onSwitchToForm,
  onSwitchToResources,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Field recognition & visual bounds settings
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showBadges, setShowBadges] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showInspector, setShowInspector] = useState(true);

  // Actual rendered CSS pixel dimensions of canvas
  const [renderedDims, setRenderedDims] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Fields on current page
  const pageFields = fields.filter(f => (f.bounds?.pageNumber || 1) === currentPage);
  const selectedField = fields.find(f => f.id === selectedFieldId) || null;

  // Load document with PDF.js
  useEffect(() => {
    let active = true;
    const loadPdf = async () => {
      try {
        setIsLoading(true);
        setRenderError(null);
        const task = pdfjsLib.getDocument({
          data: pdfBytes.slice(0),
          enableXfa: true,
        });
        const doc = await task.promise;
        if (!active) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
      } catch (err: any) {
        if (!active) return;
        console.error('PDF.js render init error:', err);
        setRenderError(`Could not render PDF canvas: ${err.message}`);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadPdf();
    return () => {
      active = false;
    };
  }, [pdfBytes]);

  // Render current page to canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let renderTask: any = null;
    let isCancelled = false;

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Support high-DPI displays
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = viewport.width * pixelRatio;
        canvas.height = viewport.height * pixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        setRenderedDims({
          width: viewport.width,
          height: viewport.height,
        });

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.warn('Page render error:', err);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale]);

  // Next / Previous Field navigation
  const handleNextField = () => {
    if (pageFields.length === 0) return;
    const currentIdx = pageFields.findIndex(f => f.id === selectedFieldId);
    const nextIdx = (currentIdx + 1) % pageFields.length;
    setSelectedFieldId(pageFields[nextIdx].id);
  };

  const handlePrevField = () => {
    if (pageFields.length === 0) return;
    const currentIdx = pageFields.findIndex(f => f.id === selectedFieldId);
    const prevIdx = (currentIdx - 1 + pageFields.length) % pageFields.length;
    setSelectedFieldId(pageFields[prevIdx].id);
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
              className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors flex items-center gap-1.5"
            >
              <FolderArchive className="w-3.5 h-3.5 text-sky-400" />
              <span>Extract Resources</span>
            </button>
            <button
              onClick={onSwitchToForm}
              className="px-3 py-1 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors"
            >
              Visual Form Tab
            </button>
          </div>
        </div>
      )}

      {/* Main Viewer Controls Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Page Navigator */}
        <div className="flex items-center gap-2">
          <button
            disabled={currentPage <= 1}
            onClick={() => {
              setCurrentPage(p => Math.max(1, p - 1));
              setSelectedFieldId(null);
            }}
            className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-40"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono text-slate-300 select-none">
            Page <strong className="text-slate-100">{currentPage}</strong> of <strong className="text-slate-100">{numPages}</strong>
          </span>

          <button
            disabled={currentPage >= numPages}
            onClick={() => {
              setCurrentPage(p => Math.min(numPages, p + 1));
              setSelectedFieldId(null);
            }}
            className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-40"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Center: XFA Form Field Recognition Toggles & Filters */}
        {hasXfa && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Highlight Boundaries Toggle */}
            <button
              onClick={() => setShowBoundaries(!showBoundaries)}
              className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                showBoundaries
                  ? 'bg-sky-950/70 border-sky-600/70 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle bounding box highlights around XFA form fields"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Boundaries</span>
              <span className="text-[10px] font-mono px-1 bg-slate-900 rounded">
                {pageFields.length}
              </span>
            </button>

            {/* Type Badges Toggle */}
            <button
              onClick={() => setShowBadges(!showBadges)}
              className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                showBadges
                  ? 'bg-sky-950/70 border-sky-600/70 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Show or hide field type labels on boundaries"
            >
              Type Badges
            </button>

            {/* Filter by Field Type */}
            <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800 rounded-md px-2 py-0.5">
              <Filter className="w-3 h-3 text-slate-500" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Field Types</option>
                <option value="text" className="bg-slate-900">Text Fields</option>
                <option value="check" className="bg-slate-900">Checkboxes</option>
                <option value="choice" className="bg-slate-900">Dropdowns</option>
                <option value="numeric" className="bg-slate-900">Numeric Fields</option>
                <option value="date" className="bg-slate-900">Date Fields</option>
                <option value="signature" className="bg-slate-900">Signatures</option>
              </select>
            </div>

            {/* Field Cycle Navigator */}
            {pageFields.length > 0 && (
              <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
                <button
                  onClick={handlePrevField}
                  className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
                  title="Select Previous Field"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNextField}
                  className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
                  title="Select Next Field"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Right: Zoom controls & Inspector Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
              className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono text-slate-400 tabular-nums px-1">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
              className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={() => setScale(1.2)}
              className="p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {hasXfa && (
            <button
              onClick={() => setShowInspector(!showInspector)}
              className={`p-1.5 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5 ${
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

      {/* Main Viewport: Canvas & Inspector Side-by-Side */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch min-h-[640px]">
        {/* PDF Canvas with XFA Interactive Boundary Overlay */}
        <div
          ref={containerRef}
          onClick={() => setSelectedFieldId(null)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-6 flex items-center justify-center overflow-auto shadow-inner relative"
        >
          {isLoading && (
            <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <span>Rendering PDF Canvas &amp; XFA Elements...</span>
            </div>
          )}

          {renderError && (
            <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{renderError}</span>
            </div>
          )}

          {/* Canvas & Overlay Stack */}
          <div
            className="relative shadow-2xl rounded-sm border border-slate-700/50 bg-white inline-block"
            onClick={e => e.stopPropagation()}
          >
            <canvas ref={canvasRef} className="block" />

            {/* Recognized XFA Form Field Boundary Overlay */}
            {hasXfa && (
              <XfaFieldOverlay
                fields={fields}
                currentPage={currentPage}
                canvasWidth={renderedDims.width}
                canvasHeight={renderedDims.height}
                scale={scale}
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

        {/* Right: Field Properties & Appearance Inspector */}
        {hasXfa && showInspector && (
          <div className="w-full lg:w-88 shrink-0 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
            <FieldPropertiesInspector
              selectedField={selectedField}
              allFieldsOnPage={pageFields}
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
