import React, { useMemo, useState } from 'react';
import {
  FileText,
  Save,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  Download,
  Wand2,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
} from 'lucide-react';
import { EditablePdfMetadata, PdfDocumentMetadata } from '../types/pdf';
import { parseMetadataKeywords, exportDataAsFile } from '../utils/xfaEngine';

interface MetadataEditorPanelProps {
  filename: string;
  metadata: PdfDocumentMetadata | null;
  originalMetadata: EditablePdfMetadata | null;
  lastSavedMetadata: EditablePdfMetadata | null;
  onUpdateMetadata: (updates: Partial<EditablePdfMetadata>) => void;
  onRevertMetadata: () => void;
  onStandardizeMetadata: () => void;
  onExportPdf: () => void;
  isExportingPdf: boolean;
  onShowToast?: (msg: string) => void;
  compact?: boolean;
}

const EDITABLE_KEYS: Array<{ key: keyof EditablePdfMetadata; label: string }> = [
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author' },
  { key: 'subject', label: 'Subject' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'creator', label: 'Creator' },
  { key: 'producer', label: 'Producer' },
];

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeValue(val?: string): string {
  return (val || '').trim();
}

export const MetadataEditorPanel: React.FC<MetadataEditorPanelProps> = ({
  filename,
  metadata,
  originalMetadata,
  lastSavedMetadata,
  onUpdateMetadata,
  onRevertMetadata,
  onStandardizeMetadata,
  onExportPdf,
  isExportingPdf,
  onShowToast,
  compact = false,
}) => {
  const [keywordDraft, setKeywordDraft] = useState('');
  const [copiedJson, setCopiedJson] = useState(false);

  const currentValues: EditablePdfMetadata = useMemo(
    () => ({
      title: metadata?.title || '',
      author: metadata?.author || '',
      subject: metadata?.subject || '',
      keywords: metadata?.keywords || '',
      creator: metadata?.creator || '',
      producer: metadata?.producer || '',
    }),
    [metadata]
  );

  const keywordList = useMemo(
    () => parseMetadataKeywords(currentValues.keywords),
    [currentValues.keywords]
  );

  // Compare against the last saved snapshot (or original loaded PDF metadata)
  const baselineSaved = lastSavedMetadata ?? originalMetadata;

  const unsavedChangedFields = useMemo(() => {
    if (!baselineSaved) return [] as Array<{ key: keyof EditablePdfMetadata; label: string }>;
    return EDITABLE_KEYS.filter(({ key }) => {
      if (key === 'keywords') {
        const a = parseMetadataKeywords(currentValues.keywords).join(', ');
        const b = parseMetadataKeywords(baselineSaved.keywords).join(', ');
        return a !== b;
      }
      return normalizeValue(currentValues[key]) !== normalizeValue(baselineSaved[key]);
    });
  }, [currentValues, baselineSaved]);

  const modifiedFromOriginalFields = useMemo(() => {
    if (!originalMetadata) return [] as Array<{ key: keyof EditablePdfMetadata; label: string }>;
    return EDITABLE_KEYS.filter(({ key }) => {
      if (key === 'keywords') {
        const a = parseMetadataKeywords(currentValues.keywords).join(', ');
        const b = parseMetadataKeywords(originalMetadata.keywords).join(', ');
        return a !== b;
      }
      return normalizeValue(currentValues[key]) !== normalizeValue(originalMetadata[key]);
    });
  }, [currentValues, originalMetadata]);

  const hasUnsavedChanges = unsavedChangedFields.length > 0;
  const hasChangesFromOriginal = modifiedFromOriginalFields.length > 0;

  const isFieldModified = (key: keyof EditablePdfMetadata): boolean =>
    unsavedChangedFields.some(item => item.key === key);

  const handleAddKeyword = (rawInput: string) => {
    const incoming = parseMetadataKeywords(rawInput);
    if (incoming.length === 0) return;
    const merged = parseMetadataKeywords([...keywordList, ...incoming].join(', '));
    onUpdateMetadata({ keywords: merged.join(', ') });
    setKeywordDraft('');
  };

  const handleRemoveKeyword = (tokenToRemove: string) => {
    const next = keywordList.filter(k => k.toLowerCase() !== tokenToRemove.toLowerCase());
    onUpdateMetadata({ keywords: next.join(', ') });
  };

  const handleKeywordDraftKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (keywordDraft.trim()) {
        handleAddKeyword(keywordDraft);
      }
    }
  };

  const handleClearEditableMetadata = () => {
    onUpdateMetadata({
      title: '',
      author: '',
      subject: '',
      keywords: '',
      creator: '',
      producer: '',
    });
    onShowToast?.('Cleared editable PDF metadata fields (save PDF to apply to file)');
  };

  const handleCopyJson = async () => {
    if (!metadata) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
      setCopiedJson(true);
      onShowToast?.('Copied PDF metadata JSON to clipboard');
      window.setTimeout(() => setCopiedJson(false), 1800);
    } catch {
      onShowToast?.('Unable to copy metadata JSON to clipboard');
    }
  };

  const handleDownloadJson = () => {
    if (!metadata) return;
    const baseName = filename.replace(/\.pdf$/i, '');
    exportDataAsFile(
      JSON.stringify(metadata, null, 2),
      `${baseName}_metadata.json`,
      'application/json'
    );
    onShowToast?.(`Exported ${baseName}_metadata.json`);
  };

  if (!metadata) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-2">
        <FileText className="w-8 h-8 text-slate-500 mx-auto" />
        <h2 className="text-base font-semibold text-slate-200">No PDF Document Loaded</h2>
        <p className="text-xs text-slate-400">
          Open or load a PDF document to inspect and edit its standard Info dictionary metadata.
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? 'space-y-5 text-xs text-slate-200'
          : 'max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6 text-slate-200'
      }
    >
      {/* Header & Primary Save Action */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1 min-w-0">
          <h2 className={compact ? 'text-sm font-semibold text-slate-100' : 'text-lg font-semibold text-slate-100'}>
            PDF Document Metadata
          </h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
            <span className="truncate max-w-[260px] sm:max-w-md font-mono text-slate-300" title={filename}>
              {filename}
            </span>
            <span aria-hidden="true">·</span>
            {hasUnsavedChanges ? (
              <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="tabular-nums">
                  {unsavedChangedFields.length}{' '}
                  {unsavedChangedFields.length === 1 ? 'property' : 'properties'} pending save
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Synced with PDF export</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onStandardizeMetadata}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Populate standard Title, Author, Subject, and Producer defaults"
          >
            <Wand2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Auto-Fill</span>
          </button>

          <button
            type="button"
            onClick={onRevertMetadata}
            disabled={!hasChangesFromOriginal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Revert all properties back to the originally loaded PDF metadata"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Revert</span>
          </button>

          <button
            type="button"
            onClick={onExportPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            title="Save PDF with updated metadata properties and form data (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isExportingPdf ? 'Saving PDF...' : 'Save PDF'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout: 2-Column on Desktop Studio, Stacked in Compact Drawer */}
      <div className={compact ? 'space-y-6' : 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'}>
        {/* Left / Primary Column: Editable Standard PDF Info Properties */}
        <section
          aria-label="Editable PDF Metadata Properties"
          className={
            compact
              ? 'space-y-4'
              : 'lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5'
          }
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Standard Document Properties</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Written directly to the PDF Info dictionary whenever you save or export this document.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearEditableMetadata}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Clear all editable metadata fields to strip identifying properties"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="pdf-meta-title" className="text-xs font-medium text-slate-200">
                  Document Title
                </label>
                <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                  {isFieldModified('title') && (
                    <span className="text-amber-300 font-sans font-medium">Modified</span>
                  )}
                  <span>{currentValues.title.length} chars</span>
                </div>
              </div>
              <input
                id="pdf-meta-title"
                type="text"
                value={currentValues.title}
                onChange={e => onUpdateMetadata({ title: e.target.value })}
                placeholder="e.g. Annual Financial Reporting Form (2026)"
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 transition-colors"
              />
            </div>

            {/* Author */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="pdf-meta-author" className="text-xs font-medium text-slate-200">
                  Author
                </label>
                <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                  {isFieldModified('author') && (
                    <span className="text-amber-300 font-sans font-medium">Modified</span>
                  )}
                  <span>{currentValues.author.length} chars</span>
                </div>
              </div>
              <input
                id="pdf-meta-author"
                type="text"
                value={currentValues.author}
                onChange={e => onUpdateMetadata({ author: e.target.value })}
                placeholder="e.g. Jane Doe, Finance Department"
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 transition-colors"
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="pdf-meta-subject" className="text-xs font-medium text-slate-200">
                  Subject
                </label>
                <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                  {isFieldModified('subject') && (
                    <span className="text-amber-300 font-sans font-medium">Modified</span>
                  )}
                  <span>{currentValues.subject.length} chars</span>
                </div>
              </div>
              <textarea
                id="pdf-meta-subject"
                rows={3}
                value={currentValues.subject}
                onChange={e => onUpdateMetadata({ subject: e.target.value })}
                placeholder="Concise summary of the document purpose, scope, or filing category"
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 transition-colors resize-y"
              />
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="pdf-meta-keywords" className="text-xs font-medium text-slate-200">
                  Keywords
                </label>
                <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                  {isFieldModified('keywords') && (
                    <span className="text-amber-300 font-sans font-medium">Modified</span>
                  )}
                  <span>
                    {keywordList.length} {keywordList.length === 1 ? 'keyword' : 'keywords'}
                  </span>
                </div>
              </div>

              {/* Direct comma-separated Keywords string */}
              <input
                id="pdf-meta-keywords"
                type="text"
                value={currentValues.keywords}
                onChange={e => onUpdateMetadata({ keywords: e.target.value })}
                placeholder="Comma-separated keywords (e.g. XFA, Compliance, Tax, 2026)"
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 transition-colors"
              />

              {/* Quick Keyword Adder */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={keywordDraft}
                  onChange={e => setKeywordDraft(e.target.value)}
                  onKeyDown={handleKeywordDraftKeyDown}
                  placeholder="Add a keyword and press Enter..."
                  aria-label="Add individual keyword"
                  className="flex-1 bg-slate-950/70 border border-slate-800 focus:border-sky-500 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddKeyword(keywordDraft)}
                  disabled={!keywordDraft.trim()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5 text-sky-400" />
                  <span>Add</span>
                </button>
              </div>

              {/* Interactive Keyword Removal Buttons */}
              {keywordList.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {keywordList.map(keyword => (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer group"
                      title={`Remove keyword "${keyword}"`}
                    >
                      <span>{keyword}</span>
                      <X className="w-3 h-3 text-slate-400 group-hover:text-rose-300" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Creator & Producer (2-column grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="pdf-meta-creator" className="text-xs font-medium text-slate-200">
                    Creator Application
                  </label>
                  {isFieldModified('creator') && (
                    <span className="text-[11px] text-amber-300 font-medium">Modified</span>
                  )}
                </div>
                <input
                  id="pdf-meta-creator"
                  type="text"
                  value={currentValues.creator}
                  onChange={e => onUpdateMetadata({ creator: e.target.value })}
                  placeholder="e.g. Adobe LiveCycle Designer"
                  className="w-full bg-slate-950/90 border border-slate-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="pdf-meta-producer" className="text-xs font-medium text-slate-200">
                    PDF Producer
                  </label>
                  {isFieldModified('producer') && (
                    <span className="text-[11px] text-amber-300 font-medium">Modified</span>
                  )}
                </div>
                <input
                  id="pdf-meta-producer"
                  type="text"
                  value={currentValues.producer}
                  onChange={e => onUpdateMetadata({ producer: e.target.value })}
                  placeholder="e.g. AcroXFA Dynamic PDF Engine"
                  className="w-full bg-slate-950/90 border border-slate-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Pending Changes Summary Footer */}
          {hasUnsavedChanges && (
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-300">
                <span className="text-amber-300 font-medium">Pending export:</span>{' '}
                <span>{unsavedChangedFields.map(f => f.label).join(', ')}</span>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">
                Press Ctrl+S or click Save PDF
              </span>
            </div>
          )}
        </section>

        {/* Right / Secondary Column: Read-Only Technical File Attributes & JSON Export */}
        <section
          aria-label="Document Technical Properties"
          className={
            compact
              ? 'border-t border-slate-800 pt-5 space-y-4'
              : 'lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4'
          }
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
            <h3 className="text-sm font-semibold text-slate-100">File &amp; Structure Summary</h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Copy metadata as JSON"
              >
                {copiedJson ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Download metadata as JSON file"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          <dl className="divide-y divide-slate-800/80 text-xs">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-400">Pages</dt>
              <dd className="font-mono tabular-nums text-slate-100">
                {metadata.pageCount} {metadata.pageCount === 1 ? 'page' : 'pages'}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-400">File Size</dt>
              <dd className="font-mono tabular-nums text-slate-100">
                {formatFileSize(metadata.fileSizeBytes)}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-400">XFA Architecture</dt>
              <dd className="font-mono text-sky-300">
                {metadata.hasXfa
                  ? `${metadata.xfaType === 'dynamic' ? 'Dynamic' : 'Static'} XFA`
                  : 'None (Standard PDF)'}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-400">AcroForm Dictionary</dt>
              <dd className="font-mono text-slate-200">
                {metadata.hasAcroForm ? 'Present' : 'None'}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-400">Encryption</dt>
              <dd className="inline-flex items-center gap-1.5 font-mono text-slate-200">
                {metadata.isEncrypted ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Encrypted</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Unencrypted</span>
                  </>
                )}
              </dd>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-3">
              <dt className="text-slate-400 shrink-0">Created</dt>
              <dd className="font-mono tabular-nums text-slate-200 text-right">
                {metadata.creationDate || 'Not recorded'}
              </dd>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-3">
              <dt className="text-slate-400 shrink-0">Modified</dt>
              <dd className="font-mono tabular-nums text-slate-200 text-right">
                {metadata.modificationDate || 'Not recorded'}
              </dd>
            </div>
          </dl>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-800/80">
            Saving the PDF updates the standard Info dictionary and refreshes the modification timestamp while preserving embedded XFA form datasets and resources.
          </p>
        </section>
      </div>
    </div>
  );
};
