import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  GripVertical,
  Trash2,
  RotateCw,
  Copy,
  ArrowLeftRight,
  RotateCcw,
  Plus,
  Check,
  Download,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  AlertTriangle,
  Undo2,
  CheckSquare,
  Square,
  LayoutGrid,
} from 'lucide-react';
import { XFAField } from '../types/pdf';
import {
  OrganizedPageItem,
  PageOrganizationResult,
  generatePageThumbnails,
  createFallbackThumbnailDataUrl,
  applyPageOrganizationToPdf,
} from '../utils/pageOrganizer';

interface PageOrganizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array | null;
  filename: string;
  fields: XFAField[];
  hasXfa: boolean;
  onApplyOrganization: (
    result: PageOrganizationResult,
    removeDeletedPageFields: boolean
  ) => Promise<void> | void;
  onShowToast?: (msg: string) => void;
}

export const PageOrganizerModal: React.FC<PageOrganizerModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  filename,
  fields,
  hasXfa,
  onApplyOrganization,
  onShowToast,
}) => {
  const [initialPages, setInitialPages] = useState<OrganizedPageItem[]>([]);
  const [pages, setPages] = useState<OrganizedPageItem[]>([]);
  const [deletedPages, setDeletedPages] = useState<OrganizedPageItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [removeDeletedPageFields, setRemoveDeletedPageFields] = useState(false);

  // Drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load page thumbnails when modal opens
  useEffect(() => {
    if (!isOpen || !pdfBytes) return;
    let active = true;

    const loadThumbnails = async () => {
      setIsLoadingThumbnails(true);
      try {
        const generated = await generatePageThumbnails(pdfBytes, fields);
        if (!active) return;
        setInitialPages(generated);
        setPages(generated);
        setDeletedPages([]);
        setSelectedIds(new Set());
      } catch (err) {
        console.error('Failed to generate page thumbnails:', err);
      } finally {
        if (active) setIsLoadingThumbnails(false);
      }
    };

    loadThumbnails();
    return () => {
      active = false;
    };
  }, [isOpen, pdfBytes, fields]);

  // Check if any changes have been staged compared to initialPages
  const hasChanges = React.useMemo(() => {
    if (pages.length !== initialPages.length) return true;
    for (let i = 0; i < pages.length; i++) {
      if (
        pages[i].id !== initialPages[i].id ||
        pages[i].rotation !== initialPages[i].rotation ||
        pages[i].originalPageNumber !== initialPages[i].originalPageNumber
      ) {
        return true;
      }
    }
    return false;
  }, [pages, initialPages]);

  // Move a page from fromIndex to toIndex
  const movePage = useCallback((fromIndex: number, toIndex: number) => {
    setPages(prev => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  // HTML5 Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    const fromIdx =
      draggedIndex !== null
        ? draggedIndex
        : parseInt(e.dataTransfer.getData('text/plain'), 10);

    if (!isNaN(fromIdx) && fromIdx !== dropIndex) {
      movePage(fromIdx, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Delete single page
  const handleDeletePage = (id: string) => {
    if (pages.length <= 1) {
      onShowToast?.('A PDF document must retain at least 1 page.');
      return;
    }
    const target = pages.find(p => p.id === id);
    if (!target) return;

    setPages(prev => prev.filter(p => p.id !== id));
    setDeletedPages(prev => [...prev, target]);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Restore a deleted page
  const handleRestoreDeletedPage = (id: string) => {
    const target = deletedPages.find(p => p.id === id);
    if (!target) return;
    setDeletedPages(prev => prev.filter(p => p.id !== id));
    setPages(prev => [...prev, target]);
  };

  // Rotate single page 90 deg CW
  const handleRotatePage = (id: string) => {
    setPages(prev =>
      prev.map(p =>
        p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p
      )
    );
  };

  // Duplicate single page right after its position
  const handleDuplicatePage = (index: number) => {
    setPages(prev => {
      const source = prev[index];
      if (!source) return prev;
      const clone: OrganizedPageItem = {
        ...source,
        id: `page-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next;
    });
  };

  // Insert blank addendum page at the end
  const handleInsertAddendumPage = () => {
    const refPage = pages[pages.length - 1] || { width: 612, height: 792 };
    const newPageNum = pages.length + 1;
    const newItem: OrganizedPageItem = {
      id: `page-blank-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      originalPageNumber: null,
      width: refPage.width,
      height: refPage.height,
      rotation: 0,
      thumbnailDataUrl: createFallbackThumbnailDataUrl(
        `NEW (${newPageNum})`,
        refPage.width,
        refPage.height,
        'Supplemental Addendum Page'
      ),
      fieldCount: 0,
      sampleFieldNames: [],
      isBlankInsert: true,
      customTitle: `Supplemental Addendum & Notes (Page ${newPageNum})`,
    };
    setPages(prev => [...prev, newItem]);
  };

  // Reverse entire page order
  const handleReverseOrder = () => {
    setPages(prev => [...prev].reverse());
  };

  // Reset all changes back to initial
  const handleResetAll = () => {
    setPages(initialPages);
    setDeletedPages([]);
    setSelectedIds(new Set());
  };

  // Toggle selection checkbox
  const toggleSelectPage = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Batch delete selected pages
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (selectedIds.size >= pages.length) {
      onShowToast?.('Cannot delete all pages — at least 1 page must remain in the PDF.');
      return;
    }
    const removed = pages.filter(p => selectedIds.has(p.id));
    setPages(prev => prev.filter(p => !selectedIds.has(p.id)));
    setDeletedPages(prev => [...prev, ...removed]);
    setSelectedIds(new Set());
  };

  // Batch rotate selected pages
  const handleRotateSelected = () => {
    if (selectedIds.size === 0) return;
    setPages(prev =>
      prev.map(p =>
        selectedIds.has(p.id) ? { ...p, rotation: (p.rotation + 90) % 360 } : p
      )
    );
  };

  // Apply organization to active workspace PDF
  const handleApplyToWorkspace = async () => {
    if (!pdfBytes || pages.length === 0) return;
    setIsApplying(true);
    try {
      const result = await applyPageOrganizationToPdf(pdfBytes, pages);
      await onApplyOrganization(result, removeDeletedPageFields);
      onClose();
    } catch (err: any) {
      console.error('Error applying page organization:', err);
      onShowToast?.(`Failed to organize pages: ${err.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  // Export directly as a downloaded PDF file
  const handleDownloadOrganizedPdf = async () => {
    if (!pdfBytes || pages.length === 0) return;
    setIsApplying(true);
    try {
      const result = await applyPageOrganizationToPdf(pdfBytes, pages);
      const blob = new Blob([result.pdfBytes as any], { type: 'application/pdf' });
      const cleanBase = filename.replace(/\.pdf$/i, '');
      const downloadName = `${cleanBase}_organized.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onShowToast?.(`Downloaded ${downloadName} (${result.newPageCount} pages)`);
    } catch (err: any) {
      console.error('Error exporting organized PDF:', err);
      onShowToast?.(`Export failed: ${err.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  // Count how many XFA fields were on deleted original pages
  const remainingOriginalPageNums = new Set(
    pages.map(p => p.originalPageNumber).filter((n): n is number => n !== null)
  );
  const deletedOriginalPagesWithFields = deletedPages.filter(
    dp =>
      dp.originalPageNumber !== null &&
      !remainingOriginalPageNums.has(dp.originalPageNumber) &&
      dp.fieldCount > 0
  );
  const affectedFieldsCount = deletedOriginalPagesWithFields.reduce(
    (sum, dp) => sum + dp.fieldCount,
    0
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Organize PDF Pages"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-4 sm:px-6 py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Organize PDF Pages
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 border border-slate-700 text-sky-300 rounded-md">
                  {pages.length} {pages.length === 1 ? 'Page' : 'Pages'}
                </span>
                {hasXfa && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-amber-950/70 border border-amber-600/40 text-amber-300 rounded-md">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    XFA Packet Safe
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Drag and drop thumbnails to reorder pages, or use quick actions to rotate, duplicate, or delete pages in <span className="text-slate-200 font-mono">{filename}</span>.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Close Page Organizer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleInsertAddendumPage}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-200 font-medium transition-colors cursor-pointer"
              title="Append a new blank addendum page to the document"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              <span>Add Page</span>
            </button>

            <button
              type="button"
              onClick={handleReverseOrder}
              disabled={pages.length < 2}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-200 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
              title="Reverse the order of all pages"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
              <span>Reverse Order</span>
            </button>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
                <span className="text-[11px] font-mono text-sky-300">
                  {selectedIds.size} selected:
                </span>
                <button
                  type="button"
                  onClick={handleRotateSelected}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3 h-3 text-sky-400" />
                  <span>Rotate</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size >= pages.length}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-950/70 hover:bg-red-900/70 disabled:opacity-40 border border-red-700/60 text-red-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title={
                    selectedIds.size >= pages.length
                      ? 'Cannot delete all pages in the PDF'
                      : 'Delete selected pages'
                  }
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                  <span>Delete ({selectedIds.size})</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {hasChanges && (
              <button
                type="button"
                onClick={handleResetAll}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-medium transition-colors cursor-pointer"
                title="Reset all page order and deletion changes"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Original ({initialPages.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Deleted Pages Recovery Bar (if user deleted any pages) */}
        {deletedPages.length > 0 && (
          <div className="px-4 sm:px-6 py-2 bg-red-950/30 border-b border-red-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-red-300 font-medium">
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>
                  {deletedPages.length} {deletedPages.length === 1 ? 'page' : 'pages'} staged for deletion:
                </span>
              </span>
              {deletedPages.map(dp => (
                <button
                  key={dp.id}
                  type="button"
                  onClick={() => handleRestoreDeletedPage(dp.id)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-200 text-[11px] font-mono transition-colors cursor-pointer"
                  title="Click to restore this deleted page"
                >
                  <Undo2 className="w-3 h-3 text-red-300" />
                  <span>
                    Restore {dp.originalPageNumber ? `Orig Page ${dp.originalPageNumber}` : 'Added Page'}
                  </span>
                </button>
              ))}
            </div>

            {hasXfa && affectedFieldsCount > 0 && (
              <label className="inline-flex items-center gap-2 text-[11px] text-amber-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={removeDeletedPageFields}
                  onChange={e => setRemoveDeletedPageFields(e.target.checked)}
                  className="rounded border-amber-500/60 bg-slate-900 text-amber-500 focus:ring-0"
                />
                <span>
                  Also remove {affectedFieldsCount} XFA form {affectedFieldsCount === 1 ? 'field' : 'fields'} on deleted {deletedOriginalPagesWithFields.length === 1 ? 'page' : 'pages'} (otherwise remap to Page 1)
                </span>
              </label>
            )}
          </div>
        )}

        {/* Main Drag-and-Drop Thumbnail Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/60">
          {isLoadingThumbnails ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-9 h-9 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono text-slate-400">
                Rendering high-resolution PDF page thumbnails...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {pages.map((page, index) => {
                const isDragged = draggedIndex === index;
                const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                const isSelected = selectedIds.has(page.id);
                const wasMoved =
                  page.originalPageNumber !== null && page.originalPageNumber !== index + 1;

                return (
                  <div
                    key={page.id}
                    draggable
                    onDragStart={e => handleDragStart(e, index)}
                    onDragOver={e => handleDragOver(e, index)}
                    onDrop={e => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`group relative flex flex-col rounded-xl border transition-all select-none ${
                      isDragged
                        ? 'opacity-45 scale-95 border-sky-400 bg-slate-900/90'
                        : isDragTarget
                        ? 'border-sky-400 ring-2 ring-sky-400/50 bg-sky-950/30 scale-[1.02]'
                        : isSelected
                        ? 'border-sky-500 bg-slate-900/90 shadow-lg shadow-sky-950/30'
                        : 'border-slate-800 hover:border-slate-600 bg-slate-900/70 hover:bg-slate-900'
                    }`}
                  >
                    {/* Card Header Bar: Checkbox + Drag Handle + Page Badge + Delete */}
                    <div className="px-3 py-2 border-b border-slate-800/90 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleSelectPage(page.id)}
                          className="text-slate-400 hover:text-sky-400 transition-colors cursor-pointer"
                          title={isSelected ? 'Deselect page' : 'Select page for batch action'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        <div
                          className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 p-0.5"
                          title="Drag to reorder page"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        <span className="text-xs font-bold text-white font-mono">
                          Page {index + 1}
                        </span>

                        {wasMoved && (
                          <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                            was #{page.originalPageNumber}
                          </span>
                        )}

                        {page.isBlankInsert && (
                          <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                            New
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeletePage(page.id)}
                        disabled={pages.length <= 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/60 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                        title={
                          pages.length <= 1
                            ? 'Cannot delete the only remaining page'
                            : `Delete Page ${index + 1}`
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Thumbnail Preview Area */}
                    <div
                      className="relative flex-1 flex items-center justify-center p-4 bg-slate-950/70 min-h-[210px] cursor-grab active:cursor-grabbing overflow-hidden"
                      title="Drag thumbnail to reorder this page"
                    >
                      <div className="relative shadow-xl rounded border border-slate-700/80 bg-white overflow-hidden transition-transform duration-200">
                        <img
                          src={page.thumbnailDataUrl}
                          alt={`Thumbnail for Page ${index + 1}`}
                          draggable={false}
                          style={{
                            transform: `rotate(${page.rotation}deg)`,
                          }}
                          className="max-h-[190px] w-auto object-contain block select-none pointer-events-none transition-transform duration-200"
                        />
                      </div>

                      {/* Rotation Indicator Pill */}
                      {page.rotation !== 0 && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-sky-950/90 border border-sky-500/50 text-[10px] font-mono text-sky-300">
                          {page.rotation}°
                        </span>
                      )}

                      {/* Drop Overlay Hint */}
                      {isDragTarget && (
                        <div className="absolute inset-0 bg-sky-500/15 border-2 border-dashed border-sky-400 rounded-none flex items-center justify-center">
                          <span className="px-2.5 py-1 rounded-md bg-slate-950/90 text-sky-300 text-xs font-semibold shadow-lg">
                            Drop here → Position {index + 1}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Metadata & XFA Field Count Strip */}
                    <div className="px-3 py-1.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>
                        {page.width} × {page.height} pt
                      </span>
                      {page.fieldCount > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 text-sky-300"
                          title={page.sampleFieldNames.join(', ')}
                        >
                          <Layers className="w-3 h-3 text-sky-400" />
                          <span>
                            {page.fieldCount} {page.fieldCount === 1 ? 'field' : 'fields'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-500">Static page</span>
                      )}
                    </div>

                    {/* Bottom Action Controls: Move Left / Rotate / Duplicate / Move Right */}
                    <div className="px-2 py-1.5 bg-slate-950/80 border-t border-slate-800/90 flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => movePage(index, index - 1)}
                        disabled={index === 0}
                        className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Move page earlier"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Left</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRotatePage(page.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Rotate page 90° clockwise"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicatePage(index)}
                          className="p-1.5 rounded text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Duplicate this page"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => movePage(index, index + 1)}
                        disabled={index === pages.length - 1}
                        className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Move page later"
                      >
                        <span>Right</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Summary & Commit Actions */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {hasChanges ? (
              <span className="inline-flex items-center gap-1.5 text-amber-300 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Unsaved page layout changes ({initialPages.length} → {pages.length}{' '}
                  {pages.length === 1 ? 'page' : 'pages'})
                </span>
              </span>
            ) : (
              <span>
                Drag any page card to reorder, or use card controls to rotate, duplicate, or delete.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDownloadOrganizedPdf}
              disabled={isApplying || pages.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              title="Download the reordered/edited PDF directly to your device"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={handleApplyToWorkspace}
              disabled={isApplying || pages.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              title="Apply page reordering and deletions to the loaded document in the workspace"
            >
              <Check className="w-4 h-4" />
              <span>{isApplying ? 'Applying...' : 'Apply to Document'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
