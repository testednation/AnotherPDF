import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  Type,
  AlignLeft,
  CheckSquare,
  ListFilter,
  Hash,
  Calendar,
  PenTool,
  HelpCircle,
  ArrowRight,
  CornerDownLeft,
  FolderTree,
  Edit3,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { XFAField } from '../types/pdf';

export interface GlobalFieldSearchProps {
  fields: XFAField[];
  onSelectField: (field: XFAField) => void;
  onEditFieldInForm?: (field: XFAField) => void;
  className?: string;
  placeholder?: string;
}

type StatusFilter = 'all' | 'filled' | 'empty' | 'required';

export const GlobalFieldSearch: React.FC<GlobalFieldSearchProps> = ({
  fields = [],
  onSelectField,
  onEditFieldInForm,
  className = '',
  placeholder,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Global keyboard shortcut to focus search: Cmd+K / Ctrl+K or '/'
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const queryLower = query.toLowerCase().trim();

  // Filter fields based on query, status filter, and type filter
  const matchingFields = useMemo(() => {
    let result = fields;

    // 1. Filter by status
    if (statusFilter === 'filled') {
      result = result.filter(f => Boolean(f.value && f.value.trim().length > 0 && f.value !== '0'));
    } else if (statusFilter === 'empty') {
      result = result.filter(f => !f.value || f.value.trim().length === 0 || f.value === '0');
    } else if (statusFilter === 'required') {
      result = result.filter(f => Boolean(f.required));
    }

    // 2. Filter by type if not 'all'
    if (selectedTypeFilter !== 'all') {
      result = result.filter(f => f.type === selectedTypeFilter);
    }

    if (!queryLower) {
      return result;
    }

    // 3. Keyword search across all field properties & metadata
    return result.filter(f => {
      const nameMatch = f.name.toLowerCase().includes(queryLower);
      const captionMatch = f.caption ? f.caption.toLowerCase().includes(queryLower) : false;
      const subformMatch = f.parentSubform ? f.parentSubform.toLowerCase().includes(queryLower) : false;
      const dataRefMatch = f.dataRef ? f.dataRef.toLowerCase().includes(queryLower) : false;
      const valueMatch = f.value ? f.value.toLowerCase().includes(queryLower) : false;
      const typeMatch = f.type ? f.type.toLowerCase().includes(queryLower) : false;
      const tooltipMatch = f.tooltip ? f.tooltip.toLowerCase().includes(queryLower) : false;
      const assistMatch =
        (f.assist?.toolTip && f.assist.toolTip.toLowerCase().includes(queryLower)) ||
        (f.assist?.speak && f.assist.speak.toLowerCase().includes(queryLower)) ||
        false;
      const optionsMatch = f.options
        ? f.options.some(opt => opt.toLowerCase().includes(queryLower))
        : false;
      const validationMatch =
        f.validation?.message && f.validation.message.toLowerCase().includes(queryLower);

      return (
        nameMatch ||
        captionMatch ||
        subformMatch ||
        dataRefMatch ||
        valueMatch ||
        typeMatch ||
        tooltipMatch ||
        assistMatch ||
        optionsMatch ||
        validationMatch
      );
    });
  }, [fields, queryLower, selectedTypeFilter, statusFilter]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [matchingFields]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeItem = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  // Handle keyboard navigation inside search input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (matchingFields.length > 0 ? (prev + 1) % matchingFields.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev =>
        matchingFields.length > 0 ? (prev - 1 + matchingFields.length) % matchingFields.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matchingFields.length > 0 && matchingFields[selectedIndex]) {
        if (e.shiftKey && onEditFieldInForm) {
          handleEditInForm(matchingFields[selectedIndex]);
        } else {
          handleSelect(matchingFields[selectedIndex]);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (field: XFAField) => {
    onSelectField(field);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleEditInForm = (field: XFAField, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onEditFieldInForm) {
      onEditFieldInForm(field);
    } else {
      onSelectField(field);
    }
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    setSelectedIndex(0);
    inputRef.current?.focus();
  };

  // Helper for field icons
  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type className="w-3.5 h-3.5 text-sky-400" />;
      case 'multiline':
        return <AlignLeft className="w-3.5 h-3.5 text-indigo-400" />;
      case 'numeric':
        return <Hash className="w-3.5 h-3.5 text-blue-400" />;
      case 'choice':
        return <ListFilter className="w-3.5 h-3.5 text-purple-400" />;
      case 'check':
        return <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />;
      case 'date':
        return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      case 'signature':
        return <PenTool className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Text highlighter helper
  const renderHighlightedText = (text: string, highlight: string) => {
    if (!highlight || !text) return text;
    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-sky-500/35 text-sky-100 font-semibold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  // Identify secondary matched reason when query matched tooltip/options/dataRef
  const getSecondaryMatchReason = (field: XFAField, q: string): { label: string; text: string } | null => {
    if (!q) return null;
    if (field.tooltip && field.tooltip.toLowerCase().includes(q)) {
      return { label: 'Tooltip', text: field.tooltip };
    }
    if (field.assist?.toolTip && field.assist.toolTip.toLowerCase().includes(q)) {
      return { label: 'Guidance', text: field.assist.toolTip };
    }
    if (field.options) {
      const matchedOpt = field.options.find(o => o.toLowerCase().includes(q));
      if (matchedOpt) {
        return { label: 'Option', text: matchedOpt };
      }
    }
    if (field.dataRef && field.dataRef.toLowerCase().includes(q)) {
      return { label: 'Binding', text: field.dataRef };
    }
    return null;
  };

  // Unique types present in document
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    fields.forEach(f => {
      if (f.type) set.add(f.type);
    });
    return Array.from(set);
  }, [fields]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute left-2.5 text-slate-400 pointer-events-none flex items-center">
          <Search className="w-3.5 h-3.5 text-sky-400" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            placeholder ||
            (fields.length > 0
              ? `Search ${fields.length} fields by keyword, value, ID...`
              : 'Search form fields...')
          }
          aria-label="Global field search"
          className="w-full pl-8 pr-16 py-1.5 bg-slate-950/90 hover:bg-slate-900 focus:bg-slate-900 text-xs text-slate-100 placeholder-slate-400 border border-slate-700/80 hover:border-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40 rounded-lg transition-all"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {query ? (
            <>
              <span className="text-[10px] font-mono text-sky-400 px-1">
                {matchingFields.length}
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded shadow-xs">
              <span className="text-[10px]">⌘</span>K
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown Results Palette */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-[92vw] sm:w-[440px] md:w-[520px] lg:w-[580px] max-w-[94vw] bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header Bar inside dropdown: Result Count + Status & Type Filters */}
          <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-300">
                {queryLower ? (
                  <>
                    Found <span className="text-sky-400 font-bold font-mono">{matchingFields.length}</span>{' '}
                    matching {matchingFields.length === 1 ? 'field' : 'fields'}
                  </>
                ) : (
                  <>
                    Instant Field Finder{' '}
                    <span className="text-slate-400 font-mono">({matchingFields.length}/{fields.length})</span>
                  </>
                )}
              </span>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1">
                {(['all', 'filled', 'empty', 'required'] as StatusFilter[]).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-1.5 py-0.5 text-[10px] rounded capitalize transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-sky-500/25 text-sky-200 border border-sky-500/40 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Type Filter Pills */}
            {availableTypes.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                <span className="text-[10px] text-slate-500 font-mono mr-1">Type:</span>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('all')}
                  className={`px-1.5 py-0.5 text-[10px] rounded transition-colors cursor-pointer ${
                    selectedTypeFilter === 'all'
                      ? 'bg-slate-800 text-sky-300 border border-slate-700 font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  All Types
                </button>
                {availableTypes.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTypeFilter(t)}
                    className={`px-1.5 py-0.5 text-[10px] rounded capitalize transition-colors cursor-pointer ${
                      selectedTypeFilter === t
                        ? 'bg-slate-800 text-sky-300 border border-slate-700 font-medium'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results List */}
          <ul
            ref={listRef}
            className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 p-1 focus:outline-none"
            role="listbox"
          >
            {matchingFields.length === 0 ? (
              <li className="px-4 py-8 text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  No fields found matching &ldquo;{query}&rdquo;
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Try searching by field label, technical ID, current value, subform section, or tooltip text.
                </p>
              </li>
            ) : (
              matchingFields.map((field, idx) => {
                const isSelected = idx === selectedIndex;
                const pageNumber = field.bounds?.pageNumber || 1;
                const caption = field.caption || field.name;
                const showTechName = field.caption && field.caption !== field.name;
                const isFilled = Boolean(
                  field.value && field.value.trim().length > 0 && field.value !== '0'
                );
                const secondaryMatch = getSecondaryMatchReason(field, queryLower);

                return (
                  <li
                    key={field.id}
                    data-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(field)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-3 py-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-sky-600/20 text-slate-100 border border-sky-500/40'
                        : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'
                    }`}
                  >
                    {/* Left: Icon & Matched Details */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/70 flex items-center justify-center shrink-0 mt-0.5">
                        {getFieldIcon(field.type)}
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xs font-semibold text-slate-100 truncate">
                            {renderHighlightedText(caption, query)}
                          </span>

                          {showTechName && (
                            <span className="text-[10px] text-slate-400 font-mono truncate hidden sm:inline">
                              ({renderHighlightedText(field.name, query)})
                            </span>
                          )}

                          {field.required && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-rose-950/80 border border-rose-800/60 text-rose-300 font-mono shrink-0">
                              Required
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                          {field.parentSubform && (
                            <span className="truncate max-w-[140px] sm:max-w-[180px] flex items-center gap-1 text-slate-400">
                              <FolderTree className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {renderHighlightedText(field.parentSubform, query)}
                              </span>
                            </span>
                          )}

                          <span className="px-1.5 py-0.2 bg-slate-800 rounded font-mono text-[9px] text-slate-300 uppercase">
                            {field.type}
                          </span>

                          {isFilled ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300 font-mono truncate max-w-[180px]">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                              <span className="truncate">
                                {renderHighlightedText(field.value, query)}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-500 italic">
                              <Circle className="w-2 h-2 shrink-0" />
                              <span>Empty</span>
                            </span>
                          )}
                        </div>

                        {secondaryMatch && (
                          <div className="text-[10px] text-sky-300/90 truncate pt-0.5">
                            <span className="font-mono text-[9px] uppercase px-1 py-0.2 rounded bg-sky-950 border border-sky-800 mr-1.5">
                              {secondaryMatch.label}
                            </span>
                            <span>{renderHighlightedText(secondaryMatch.text, query)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Page badge & Navigation actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700/80 text-sky-300 rounded font-mono">
                        Page {pageNumber}
                      </span>

                      {onEditFieldInForm && (
                        <button
                          type="button"
                          onClick={e => handleEditInForm(field, e)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white border border-slate-700 hover:border-sky-500 text-[10px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Jump directly to edit this field in the Form Editor (Shift+Enter)"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span className="hidden sm:inline">Form</span>
                        </button>
                      )}

                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-sky-400 font-semibold pl-1">
                          <span className="hidden md:inline">Locate</span>
                          <CornerDownLeft className="w-3 h-3" />
                        </span>
                      ) : (
                        <ArrowRight className="w-3 h-3 text-slate-600" />
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer Shortcuts Info */}
          <div className="px-3 py-1.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-3 flex-wrap">
              <span>
                <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-slate-300">↑↓</kbd>{' '}
                navigate
              </span>
              <span>
                <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-slate-300">↵</kbd>{' '}
                locate on PDF
              </span>
              {onEditFieldInForm && (
                <span className="hidden sm:inline">
                  <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-slate-300">⇧↵</kbd>{' '}
                  edit in form
                </span>
              )}
              <span>
                <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-slate-300">ESC</kbd>{' '}
                close
              </span>
            </div>
            <span className="font-mono text-slate-400 hidden sm:inline">Global Field Search</span>
          </div>
        </div>
      )}
    </div>
  );
};
