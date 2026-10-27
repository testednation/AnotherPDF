import React, { useState, useMemo, useEffect } from 'react';
import {
  Image as ImageIcon,
  Type,
  Paperclip,
  FileText,
  FolderArchive,
  Download,
  Copy,
  Check,
  Eye,
  Search,
  ExternalLink,
  Layers,
  FileCode,
  Info,
  CheckSquare,
  Square,
  Sparkles,
  X,
  Play,
  Share2,
} from 'lucide-react';
import {
  ExtractedResourceManifest,
  ExtractedImageResource,
  ExtractedFontResource,
  ExtractedAttachmentResource,
  ExtractedTextPage,
} from '../types/pdf';
import { downloadResource } from '../utils/resourceExtractor';
import JSZip from 'jszip';

interface ResourceExtractorViewProps {
  manifest: ExtractedResourceManifest;
  originalFilename: string;
  onDownloadAllZip: () => void;
  isExportingZip: boolean;
  onShowToast?: (msg: string) => void;
}

export const ResourceExtractorView: React.FC<ResourceExtractorViewProps> = ({
  manifest,
  originalFilename,
  onDownloadAllZip,
  isExportingZip,
  onShowToast,
}) => {
  const [activeCategory, setActiveCategory] = useState<'images' | 'fonts' | 'attachments' | 'xfa' | 'text' | 'metadata'>('images');
  const [searchFilter, setSearchFilter] = useState('');
  
  // Selection state for multi-resource extraction
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal inspection states
  const [previewImage, setPreviewImage] = useState<ExtractedImageResource | null>(null);
  const [inspectingFont, setInspectingFont] = useState<ExtractedFontResource | null>(null);
  const [fontTestText, setFontTestText] = useState('The quick brown fox jumps over the lazy dog 0123456789');
  const [inspectingPacket, setInspectingPacket] = useState<{ name: string; content: string } | null>(null);

  // Copied item tracker for instantaneous visual feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isExportingSelectedZip, setIsExportingSelectedZip] = useState(false);

  const notify = (msg: string) => {
    if (onShowToast) {
      onShowToast(msg);
    }
  };

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    notify(`Copied ${label} to clipboard`);
    setTimeout(() => {
      setCopiedKey(curr => (curr === key ? null : curr));
    }, 2000);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Helper for dynamic font preview injection
  const fontFaceStyle = useMemo(() => {
    if (!inspectingFont || !inspectingFont.fontData) return null;
    const blob = new Blob([inspectingFont.fontData as any], { type: 'font/ttf' });
    const fontUrl = URL.createObjectURL(blob);
    const fontName = `ExtractedFont_${inspectingFont.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return {
      fontName,
      fontUrl,
      css: `@font-face { font-family: '${fontName}'; src: url('${fontUrl}'); }`,
    };
  }, [inspectingFont]);

  // Clean up blob URL on modal close
  useEffect(() => {
    return () => {
      if (fontFaceStyle?.fontUrl) {
        URL.revokeObjectURL(fontFaceStyle.fontUrl);
      }
    };
  }, [fontFaceStyle]);

  // Download Individual Font
  const handleDownloadFont = (font: ExtractedFontResource) => {
    if (!font.fontData) return;
    const ext = font.fontExtension || 'ttf';
    const blob = new Blob([font.fontData as any], { type: 'font/ttf' });
    const safeName = `${font.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
    downloadResource(blob, safeName);
    notify(`Extracted individual font: ${safeName}`);
  };

  // Download Individual Attachment
  const handleDownloadAttachment = (att: ExtractedAttachmentResource) => {
    const blob = new Blob([att.data as any], { type: att.mimeType });
    downloadResource(blob, att.name);
    notify(`Extracted individual attachment: ${att.name}`);
  };

  // Download Individual XML Packet
  const handleDownloadPacket = (packetName: string, content: string) => {
    const mime = packetName.endsWith('.xdp') ? 'application/vnd.adobe.xdp+xml' : 'application/xml';
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    downloadResource(blob, packetName);
    notify(`Extracted individual XFA packet: ${packetName}`);
  };

  // Download Individual Page Text
  const handleDownloadPageText = (page: ExtractedTextPage) => {
    const blob = new Blob([page.text], { type: 'text/plain;charset=utf-8' });
    const safeDocName = originalFilename.replace(/\.pdf$/i, '');
    const filename = `${safeDocName}_page_${page.pageNumber}_text.txt`;
    downloadResource(blob, filename);
    notify(`Extracted text for Page ${page.pageNumber}`);
  };

  // Download Full Text
  const handleDownloadFullText = () => {
    const fullText = manifest.textPages
      .map(p => `=== Page ${p.pageNumber} (Words: ${p.wordCount}) ===\n\n${p.text}`)
      .join('\n\n');
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const safeDocName = originalFilename.replace(/\.pdf$/i, '');
    downloadResource(blob, `${safeDocName}_full_extracted_text.txt`);
    notify('Extracted full document text');
  };

  // Download Metadata as JSON
  const handleDownloadMetadataJson = () => {
    const safeDocName = originalFilename.replace(/\.pdf$/i, '');
    const jsonStr = JSON.stringify(manifest.metadata, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    downloadResource(blob, `${safeDocName}_metadata.json`);
    notify('Extracted PDF metadata as JSON');
  };

  // Checkbox toggle for multi-selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered lists based on searchFilter
  const q = searchFilter.toLowerCase().trim();

  const filteredImages = useMemo(() => {
    if (!q) return manifest.images;
    return manifest.images.filter(
      img =>
        img.name.toLowerCase().includes(q) ||
        img.format.toLowerCase().includes(q) ||
        `page ${img.page}`.includes(q)
    );
  }, [manifest.images, q]);

  const filteredFonts = useMemo(() => {
    if (!q) return manifest.fonts;
    return manifest.fonts.filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.baseFont.toLowerCase().includes(q) ||
        f.subtype.toLowerCase().includes(q)
    );
  }, [manifest.fonts, q]);

  const filteredAttachments = useMemo(() => {
    if (!q) return manifest.attachments;
    return manifest.attachments.filter(
      a => a.name.toLowerCase().includes(q) || a.mimeType.toLowerCase().includes(q)
    );
  }, [manifest.attachments, q]);

  const filteredTextPages = useMemo(() => {
    if (!q) return manifest.textPages;
    return manifest.textPages.filter(
      p => `page ${p.pageNumber}`.includes(q) || p.text.toLowerCase().includes(q)
    );
  }, [manifest.textPages, q]);

  // Select all visible in current category
  const handleSelectAllVisible = () => {
    const next = new Set(selectedIds);
    if (activeCategory === 'images') filteredImages.forEach(i => next.add(`img_${i.id}`));
    if (activeCategory === 'fonts') filteredFonts.forEach(f => next.add(`font_${f.id}`));
    if (activeCategory === 'attachments') filteredAttachments.forEach(a => next.add(`att_${a.id}`));
    if (activeCategory === 'text') filteredTextPages.forEach(p => next.add(`page_${p.pageNumber}`));
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Download Selected Resources as ZIP
  const handleDownloadSelectedZip = async () => {
    if (selectedIds.size === 0) return;
    setIsExportingSelectedZip(true);
    try {
      const zip = new JSZip();
      let count = 0;

      // Images
      manifest.images.forEach(img => {
        if (selectedIds.has(`img_${img.id}`)) {
          zip.file(`images/${img.name}`, img.blob);
          count++;
        }
      });

      // Fonts
      manifest.fonts.forEach(f => {
        if (selectedIds.has(`font_${f.id}`) && f.fontData) {
          const ext = f.fontExtension || 'ttf';
          zip.file(`fonts/${f.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`, f.fontData);
          count++;
        }
      });

      // Attachments
      manifest.attachments.forEach(att => {
        if (selectedIds.has(`att_${att.id}`)) {
          zip.file(`attachments/${att.name}`, att.data);
          count++;
        }
      });

      // Text Pages
      manifest.textPages.forEach(p => {
        if (selectedIds.has(`page_${p.pageNumber}`)) {
          zip.file(`text/page_${p.pageNumber}_text.txt`, p.text);
          count++;
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const safeDocName = originalFilename.replace(/\.pdf$/i, '');
      downloadResource(zipBlob, `${safeDocName}_selected_${count}_resources.zip`);
      notify(`Exported ${count} selected resources as custom ZIP`);
    } catch (e: any) {
      console.error(e);
      notify(`Failed to bundle selected resources: ${e.message}`);
    } finally {
      setIsExportingSelectedZip(false);
    }
  };

  // Download Selected Individually
  const handleDownloadSelectedIndividually = () => {
    if (selectedIds.size === 0) return;
    let count = 0;

    manifest.images.forEach(img => {
      if (selectedIds.has(`img_${img.id}`)) {
        downloadResource(img.blob, img.name);
        count++;
      }
    });

    manifest.fonts.forEach(f => {
      if (selectedIds.has(`font_${f.id}`) && f.fontData) {
        const ext = f.fontExtension || 'ttf';
        const blob = new Blob([f.fontData as any], { type: 'font/ttf' });
        downloadResource(blob, `${f.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`);
        count++;
      }
    });

    manifest.attachments.forEach(att => {
      if (selectedIds.has(`att_${att.id}`)) {
        const blob = new Blob([att.data as any], { type: att.mimeType });
        downloadResource(blob, att.name);
        count++;
      }
    });

    manifest.textPages.forEach(p => {
      if (selectedIds.has(`page_${p.pageNumber}`)) {
        const blob = new Blob([p.text], { type: 'text/plain;charset=utf-8' });
        downloadResource(blob, `page_${p.pageNumber}_text.txt`);
        count++;
      }
    });

    notify(`Downloaded ${count} individual resources sequentially`);
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Dynamic Font Style tag for font testing preview */}
      {fontFaceStyle && <style>{fontFaceStyle.css}</style>}

      {/* Header Banner & Global Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-100">
              PDF Resource Extraction Hub
            </h1>
            <span className="text-xs text-sky-400 font-mono bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-sm">
              Individual &amp; Batch Extractor
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Extract individual raster images, TrueType/OpenType fonts, file attachments, XFA XML packets, page text, and document metadata.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onDownloadAllZip}
            disabled={isExportingZip}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 active:bg-sky-500 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <FolderArchive className="w-4 h-4" />
            <span>{isExportingZip ? 'Packaging ZIP...' : 'Download All (.ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* Search, Filter & Multi-Select Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Search individual resources by name, format, or page..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Selection actions */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={handleSelectAllVisible}
            className="px-2.5 py-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-md transition-colors flex items-center gap-1.5"
          >
            <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>Select Visible</span>
          </button>

          {selectedIds.size > 0 && (
            <button
              onClick={handleClearSelection}
              className="px-2.5 py-1.5 text-slate-400 hover:text-rose-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-md transition-colors"
            >
              Clear ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Floating Batch Action Bar when items are selected */}
      {selectedIds.size > 0 && (
        <div className="bg-sky-950/90 border border-sky-800/80 text-sky-100 px-4 py-2.5 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span>
              <strong className="text-white font-mono">{selectedIds.size}</strong> individual {selectedIds.size === 1 ? 'resource' : 'resources'} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSelectedIndividually}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-sky-700/60 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Extract Each Individually</span>
            </button>

            <button
              onClick={handleDownloadSelectedZip}
              disabled={isExportingSelectedZip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>{isExportingSelectedZip ? 'Bundling...' : `Download Selected as ZIP (${selectedIds.size})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Category Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
        <button
          onClick={() => setActiveCategory('images')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors ${
            activeCategory === 'images'
              ? 'bg-slate-800 text-sky-400 shadow-xs font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Images</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-slate-950 text-slate-300 rounded font-mono tabular-nums">
            {manifest.images.length}
          </span>
        </button>

        <button
          onClick={() => setActiveCategory('fonts')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors ${
            activeCategory === 'fonts'
              ? 'bg-slate-800 text-sky-400 shadow-xs font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Fonts</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-slate-950 text-slate-300 rounded font-mono tabular-nums">
            {manifest.fonts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveCategory('attachments')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors ${
            activeCategory === 'attachments'
              ? 'bg-slate-800 text-sky-400 shadow-xs font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Paperclip className="w-3.5 h-3.5" />
          <span>Attachments</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-slate-950 text-slate-300 rounded font-mono tabular-nums">
            {manifest.attachments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveCategory('xfa')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors ${
            activeCategory === 'xfa'
              ? 'bg-slate-800 text-sky-400 shadow-xs font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>XFA Packets</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-slate-950 text-slate-300 rounded font-mono tabular-nums">
            {Boolean(manifest.xfaPackets.templateXml || manifest.xfaPackets.datasetsXml) ? '4' : '0'}
          </span>
        </button>

        <button
          onClick={() => setActiveCategory('text')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors ${
            activeCategory === 'text'
              ? 'bg-slate-800 text-sky-400 shadow-xs font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Page Text</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-slate-950 text-slate-300 rounded font-mono tabular-nums">
            {manifest.textPages.length} {manifest.textPages.length === 1 ? 'page' : 'pages'}
          </span>
        </button>

        <button
          onClick={() => setActiveCategory('metadata')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors ${
            activeCategory === 'metadata'
              ? 'bg-slate-800 text-sky-400 shadow-xs font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>Document Metadata</span>
        </button>
      </div>

      {/* CATEGORY 1: IMAGES */}
      {activeCategory === 'images' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>
              Showing {filteredImages.length} of {manifest.images.length} extracted raster {manifest.images.length === 1 ? 'image' : 'images'}
            </span>
          </div>

          {filteredImages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredImages.map(img => {
                const isSelected = selectedIds.has(`img_${img.id}`);
                return (
                  <div
                    key={img.id}
                    className={`bg-slate-900 border rounded-xl overflow-hidden flex flex-col transition-all ${
                      isSelected
                        ? 'border-sky-500/80 ring-1 ring-sky-500/30'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Image Preview Box */}
                    <div
                      className="relative h-44 bg-slate-950 flex items-center justify-center p-3 cursor-pointer group overflow-hidden"
                      onClick={() => setPreviewImage(img)}
                      style={{
                        backgroundImage: `radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                        backgroundSize: '12px 12px',
                      }}
                    >
                      {/* Checkbox badge on top-left */}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          toggleSelect(`img_${img.id}`);
                        }}
                        className="absolute top-2.5 left-2.5 z-10 p-1 rounded-md bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                        title={isSelected ? 'Deselect image' : 'Select image for batch export'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                      </button>

                      {/* Format Badge on top-right */}
                      <span className="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-slate-900/90 border border-slate-700 text-sky-300">
                        {img.format}
                      </span>

                      {img.dataUrl ? (
                        <img
                          src={img.dataUrl}
                          alt={img.name}
                          className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="text-slate-500 text-xs font-mono">Raw Stream ({formatBytes(img.sizeBytes)})</div>
                      )}

                      <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900/90 rounded-md border border-slate-700">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Full Details</span>
                        </span>
                      </div>
                    </div>

                    {/* Metadata and Direct Download Actions */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-xs font-semibold text-slate-200 truncate" title={img.name}>
                            {img.name}
                          </h3>
                          <span className="text-[10px] text-slate-500 font-mono">Page {img.page}</span>
                        </div>

                        {/* Dimensions & Specs */}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                          <span className="tabular-nums font-medium text-slate-300">{img.width}×{img.height}</span>
                          <span>·</span>
                          <span>{img.colorSpace}</span>
                          <span>·</span>
                          <span className="tabular-nums">{formatBytes(img.sizeBytes)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        {/* Primary: Extract Individual Image */}
                        <button
                          onClick={() => {
                            downloadResource(img.blob, img.name);
                            notify(`Extracted image: ${img.name}`);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-100 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-800/80 rounded-md transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 text-sky-400" />
                          <span>Extract {img.format.toUpperCase()}</span>
                        </button>

                        {/* Copy Data URL */}
                        {img.dataUrl && (
                          <button
                            onClick={() => copyToClipboard(img.dataUrl, `img_dataurl_${img.id}`, 'Data URL')}
                            className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
                            title="Copy Base64 Data URL to clipboard"
                          >
                            {copiedKey === `img_dataurl_${img.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-2">
              <ImageIcon className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm text-slate-300">
                {searchFilter ? 'No images match your search filter.' : 'No embedded raster images found in this document.'}
              </p>
              <p className="text-xs text-slate-500">
                Pure vector or text-only documents may not contain XObject images.
              </p>
            </div>
          )}
        </div>
      )}

      {/* CATEGORY 2: FONTS */}
      {activeCategory === 'fonts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>
              Showing {filteredFonts.length} of {manifest.fonts.length} detected fonts ({manifest.fonts.filter(f => f.isEmbedded).length} embedded)
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono">
                    <th className="py-3 px-4 w-10 text-center">
                      <Square className="w-3.5 h-3.5 mx-auto text-slate-600" />
                    </th>
                    <th className="py-3 px-4">Font Name &amp; Family</th>
                    <th className="py-3 px-4">Subtype</th>
                    <th className="py-3 px-4">Encoding</th>
                    <th className="py-3 px-4">Embedding Status</th>
                    <th className="py-3 px-4">File Size</th>
                    <th className="py-3 px-4 text-right">Individual Extraction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredFonts.map(font => {
                    const isSelected = selectedIds.has(`font_${font.id}`);
                    return (
                      <tr key={font.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-center">
                          {font.isEmbedded && font.fontData ? (
                            <button
                              type="button"
                              onClick={() => toggleSelect(`font_${font.id}`)}
                              className="text-slate-400 hover:text-white"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-sky-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600" />
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-700">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-200">{font.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono truncate max-w-[220px]" title={font.baseFont}>
                            {font.baseFont}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">{font.subtype}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{font.encoding || 'Standard'}</td>
                        <td className="py-3 px-4">
                          {font.isEmbedded ? (
                            <span className="text-emerald-400 font-mono text-[11px] inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>Embedded ({font.fontExtension?.toUpperCase()})</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px]">Standard / Non-embedded</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-400">
                          {formatBytes(font.sizeBytes)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2 justify-end">
                            {font.isEmbedded && font.fontData ? (
                              <>
                                <button
                                  onClick={() => setInspectingFont(font)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
                                  title="Test and preview font glyphs interactively"
                                >
                                  <Eye className="w-3 h-3 text-sky-400" />
                                  <span>Test Glyphs</span>
                                </button>
                                <button
                                  onClick={() => handleDownloadFont(font)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors shadow-xs"
                                  title={`Extract individual .${font.fontExtension} font file`}
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Extract .{font.fontExtension}</span>
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => copyToClipboard(font.name, `font_name_${font.id}`, 'Font Name')}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/60 rounded-md transition-colors"
                              >
                                {copiedKey === `font_name_${font.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>Copy Name</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredFonts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        {searchFilter ? 'No fonts match your search query.' : 'No font dictionaries discovered.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY 3: ATTACHMENTS */}
      {activeCategory === 'attachments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>
              Showing {filteredAttachments.length} of {manifest.attachments.length} document file attachments
            </span>
          </div>

          {filteredAttachments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAttachments.map(att => {
                const isSelected = selectedIds.has(`att_${att.id}`);
                return (
                  <div
                    key={att.id}
                    className={`bg-slate-900 border rounded-xl p-4 flex items-center justify-between gap-4 transition-all ${
                      isSelected
                        ? 'border-sky-500/80 ring-1 ring-sky-500/30'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelect(`att_${att.id}`)}
                        className="text-slate-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </button>

                      <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 shrink-0">
                        <Paperclip className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-slate-200 truncate" title={att.name}>
                          {att.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                          <span>{att.mimeType}</span>
                          <span>·</span>
                          <span className="tabular-nums">{formatBytes(att.sizeBytes)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleDownloadAttachment(att)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Extract File</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-2">
              <Paperclip className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm text-slate-300">
                {searchFilter ? 'No attachments match your search query.' : 'No embedded file attachments found in this document.'}
              </p>
              <p className="text-xs text-slate-500">
                Embedded files from /EmbeddedFiles and file attachment annotations are extracted here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* CATEGORY 4: XFA PACKETS */}
      {activeCategory === 'xfa' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400 font-mono">
            Directly extract individual Adobe XFA architecture packets as standalone XML/XDP files
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {manifest.xfaPackets.templateXml && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-slate-200">template.xml</h3>
                      <span className="text-[10px] bg-sky-950/80 text-sky-300 border border-sky-800 px-1.5 py-0.2 rounded font-mono">
                        XFA Layout
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      Subform trees, coordinate bounds, widgets &amp; appearance rules · {formatBytes(manifest.xfaPackets.templateXml.length)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                  <button
                    onClick={() => setInspectingPacket({ name: 'template.xml', content: manifest.xfaPackets.templateXml! })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                    <span>View XML</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(manifest.xfaPackets.templateXml!, 'xfa_template', 'template.xml')}
                    className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors"
                    title="Copy XML content"
                  >
                    {copiedKey === 'xfa_template' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDownloadPacket('template.xml', manifest.xfaPackets.templateXml!)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Extract .xml</span>
                  </button>
                </div>
              </div>
            )}

            {manifest.xfaPackets.datasetsXml && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-slate-200">datasets.xml</h3>
                      <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded font-mono">
                        Data Payload
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      Values payload (&lt;xfa:data&gt;) binding to form inputs · {formatBytes(manifest.xfaPackets.datasetsXml.length)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                  <button
                    onClick={() => setInspectingPacket({ name: 'datasets.xml', content: manifest.xfaPackets.datasetsXml! })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>View XML</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(manifest.xfaPackets.datasetsXml!, 'xfa_datasets', 'datasets.xml')}
                    className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors"
                    title="Copy XML content"
                  >
                    {copiedKey === 'xfa_datasets' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDownloadPacket('datasets.xml', manifest.xfaPackets.datasetsXml!)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Extract .xml</span>
                  </button>
                </div>
              </div>
            )}

            {manifest.xfaPackets.configXml && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-slate-200">config.xml</h3>
                      <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.2 rounded font-mono">
                        Engine Config
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      Adobe LiveCycle runtime behavior &amp; PDF generation settings · {formatBytes(manifest.xfaPackets.configXml.length)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                  <button
                    onClick={() => setInspectingPacket({ name: 'config.xml', content: manifest.xfaPackets.configXml! })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                    <span>View XML</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(manifest.xfaPackets.configXml!, 'xfa_config', 'config.xml')}
                    className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors"
                    title="Copy XML content"
                  >
                    {copiedKey === 'xfa_config' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDownloadPacket('config.xml', manifest.xfaPackets.configXml!)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Extract .xml</span>
                  </button>
                </div>
              </div>
            )}

            {manifest.xfaPackets.fullXdpXml && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-slate-200">package.xdp</h3>
                      <span className="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800 px-1.5 py-0.2 rounded font-mono">
                        Unified Architecture
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      Monolithic XML Data Package enclosing template, datasets &amp; config · {formatBytes(manifest.xfaPackets.fullXdpXml.length)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                  <button
                    onClick={() => setInspectingPacket({ name: 'package.xdp', content: manifest.xfaPackets.fullXdpXml! })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-purple-400" />
                    <span>View XDP</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(manifest.xfaPackets.fullXdpXml!, 'xfa_xdp', 'package.xdp')}
                    className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors"
                    title="Copy XDP content"
                  >
                    {copiedKey === 'xfa_xdp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDownloadPacket('package.xdp', manifest.xfaPackets.fullXdpXml!)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Extract .xdp</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CATEGORY 5: PAGE TEXT */}
      {activeCategory === 'text' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
              <span className="font-semibold text-slate-200 tabular-nums">{manifest.totalWords.toLocaleString()}</span> words
              <span>·</span>
              <span className="font-semibold text-slate-200 tabular-nums">{manifest.totalCharacters.toLocaleString()}</span> characters
              <span>·</span>
              <span className="font-semibold text-slate-200 tabular-nums">{manifest.textPages.length}</span> pages
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const fullText = manifest.textPages.map(p => p.text).join('\n\n');
                  copyToClipboard(fullText, 'full_text', 'Full text');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
              >
                {copiedKey === 'full_text' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'full_text' ? 'Copied' : 'Copy All Text'}</span>
              </button>
              <button
                onClick={handleDownloadFullText}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Extract All Pages (.txt)</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredTextPages.map(page => {
              const isSelected = selectedIds.has(`page_${page.pageNumber}`);
              return (
                <div
                  key={page.pageNumber}
                  className={`bg-slate-900 border rounded-xl overflow-hidden transition-all ${
                    isSelected
                      ? 'border-sky-500/80 ring-1 ring-sky-500/30'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSelect(`page_${page.pageNumber}`)}
                        className="text-slate-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </button>
                      <span className="font-semibold text-slate-200">Page {page.pageNumber}</span>
                      <span>·</span>
                      <span className="tabular-nums">{page.wordCount} words</span>
                      <span>·</span>
                      <span className="tabular-nums">{page.lineCount} lines</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(page.text, `page_text_${page.pageNumber}`, `Page ${page.pageNumber} text`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
                        title="Copy text of this page"
                      >
                        {copiedKey === `page_text_${page.pageNumber}` ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>Copy</span>
                      </button>

                      <button
                        onClick={() => handleDownloadPageText(page)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-100 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-800/80 rounded-md transition-colors"
                        title={`Extract text of Page ${page.pageNumber} to file`}
                      >
                        <Download className="w-3 h-3 text-sky-400" />
                        <span>Extract Page .txt</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap max-h-56 overflow-y-auto selection:bg-sky-500/30">
                    {page.text || <span className="text-slate-600 italic">No text stream found on this page.</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CATEGORY 6: DOCUMENT METADATA */}
      {activeCategory === 'metadata' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">
              Extract PDF catalog dictionaries, producer info, and creation stamps
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const jsonStr = JSON.stringify(manifest.metadata, null, 2);
                  copyToClipboard(jsonStr, 'metadata_json', 'Metadata JSON');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
              >
                {copiedKey === 'metadata_json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy JSON</span>
              </button>

              <button
                onClick={handleDownloadMetadataJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Extract Metadata (.json)</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-950/60 border-b border-slate-800">
              <h3 className="text-xs font-semibold text-slate-200">Catalog Dictionaries &amp; Technical Attributes</h3>
            </div>
            <div className="divide-y divide-slate-800/80 text-xs">
              <div className="grid grid-cols-3 p-4">
                <span className="text-slate-400 font-mono">Document Title</span>
                <span className="col-span-2 text-slate-200 font-medium">{manifest.metadata.title || 'Untitled'}</span>
              </div>
              <div className="grid grid-cols-3 p-4">
                <span className="text-slate-400 font-mono">Author</span>
                <span className="col-span-2 text-slate-200">{manifest.metadata.author || 'Not specified'}</span>
              </div>
              <div className="grid grid-cols-3 p-4">
                <span className="text-slate-400 font-mono">Subject</span>
                <span className="col-span-2 text-slate-200">{manifest.metadata.subject || 'Not specified'}</span>
              </div>
              <div className="grid grid-cols-3 p-4">
                <span className="text-slate-400 font-mono">Producer / Engine</span>
                <span className="col-span-2 text-slate-200 font-mono">{manifest.metadata.producer || 'Not specified'}</span>
              </div>
              <div className="grid grid-cols-3 p-4">
                <span className="text-slate-400 font-mono">Creation Date</span>
                <span className="col-span-2 text-slate-200 font-mono">{manifest.metadata.creationDate || 'Not specified'}</span>
              </div>
              <div className="grid grid-cols-3 p-4">
                <span className="text-slate-400 font-mono">XFA Architecture</span>
                <span className="col-span-2 text-sky-400 font-mono">
                  {manifest.metadata.hasXfa ? `${manifest.metadata.xfaType?.toUpperCase()} XFA` : 'None (Standard PDF)'}
                </span>
              </div>
              <div className="grid grid-cols-3 p-4">
                <span className="text-slate-400 font-mono">Standard AcroForm</span>
                <span className="col-span-2 text-slate-200 font-mono">{manifest.metadata.hasAcroForm ? 'Present' : 'None'}</span>
              </div>
              <div className="grid grid-cols-3 p-4">
                <span className="text-slate-400 font-mono">Total File Size</span>
                <span className="col-span-2 text-slate-200 font-mono tabular-nums">{formatBytes(manifest.metadata.fileSizeBytes)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Full-Inspection Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{previewImage.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Page {previewImage.page} · {previewImage.width}×{previewImage.height} · {previewImage.colorSpace} · {formatBytes(previewImage.sizeBytes)}
                </p>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[55vh] flex items-center justify-center bg-slate-950 rounded-xl p-4 overflow-hidden border border-slate-800">
              <img
                src={previewImage.dataUrl}
                alt={previewImage.name}
                className="max-h-[48vh] max-w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="text-[11px] text-slate-500 font-mono">
                Format: <span className="text-slate-300 uppercase">{previewImage.format}</span> · Filter: {previewImage.filter || 'None'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(previewImage.dataUrl, 'modal_dataurl', 'Data URL')}
                  className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {copiedKey === 'modal_dataurl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy Data URL</span>
                </button>
                <button
                  onClick={() => {
                    downloadResource(previewImage.blob, previewImage.name);
                    notify(`Extracted image: ${previewImage.name}`);
                  }}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Image</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Font Live Glyph Inspection & Test Modal */}
      {inspectingFont && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setInspectingFont(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{inspectingFont.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Type: {inspectingFont.subtype} · Base: {inspectingFont.baseFont} · {formatBytes(inspectingFont.sizeBytes)}
                </p>
              </div>
              <button
                onClick={() => setInspectingFont(null)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Interactive Font Rendering Box */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Interactive Glyph Test Box:</label>
              <textarea
                value={fontTestText}
                onChange={e => setFontTestText(e.target.value)}
                rows={4}
                style={{
                  fontFamily: fontFaceStyle ? `'${fontFaceStyle.fontName}', sans-serif` : 'sans-serif',
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-100 text-lg leading-relaxed focus:outline-none focus:border-sky-500 transition-colors resize-none"
                placeholder="Type here to test this font's glyphs..."
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Rendered directly via in-memory @font-face</span>
                <button
                  type="button"
                  onClick={() => setFontTestText('ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 !@#$%^&*()')}
                  className="text-sky-400 hover:underline"
                >
                  Load character set
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setInspectingFont(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => handleDownloadFont(inspectingFont)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Extract .{inspectingFont.fontExtension || 'ttf'} Font File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* XML Packet Inspection Modal */}
      {inspectingPacket && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setInspectingPacket(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{inspectingPacket.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Payload size: {formatBytes(inspectingPacket.content.length)}
                </p>
              </div>
              <button
                onClick={() => setInspectingPacket(null)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-auto font-mono text-xs text-slate-300 whitespace-pre leading-relaxed select-text">
              {inspectingPacket.content}
            </div>

            <div className="flex items-center justify-between shrink-0 pt-2 border-t border-slate-800">
              <button
                onClick={() => copyToClipboard(inspectingPacket.content, 'modal_packet_copy', inspectingPacket.name)}
                className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {copiedKey === 'modal_packet_copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Packet XML</span>
              </button>

              <button
                onClick={() => handleDownloadPacket(inspectingPacket.name, inspectingPacket.content)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Extract Packet File</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
