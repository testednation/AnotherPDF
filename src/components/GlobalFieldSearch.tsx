import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  SlidersHorizontal,
  FolderTree,
  FileSpreadsheet,
} from 'lucide-react';
import { XFAField } from '../types/pdf';

export interface GlobalFieldSearchProps {
  fields: XFAField[];
  onSelectField: (field: XFAField) => void;
  className?: string;
}

export const GlobalFieldSearch: React.FC<GlobalFieldSearchProps> = ({
  fields = [],
  onSelectField,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Global keyboard shortcut to focus search: Cmd+K / Ctrl+K or '/'
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if already focusing another input/textarea
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
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

  // Filter fields based on query & type filter
  const queryLower = query.toLowerCase().trim();

  const matchingFields = useMemo(() => {
    let result = fields;

    // Filter by type if not 'all'
    if (selectedTypeFilter !== 'all') {
      result = result.filter(f => f.type === selectedTypeFilter);
    }

    if (!queryLower) {
      return result;
    }

    return result.filter(f => {
      const nameMatch = f.name.toLowerCase().includes(queryLower);
      const captionMatch = f.caption ? f.caption.toLowerCase().includes(queryLower) : false;
      const subformMatch = f.parentSubform ? f.parentSubform.toLowerCase().includes(queryLower) : false;
      const dataRefMatch = f.dataRef ? f.dataRef.toLowerCase().includes(queryLower) : false;
      const valueMatch = f.value ? f.value.toLowerCase().includes(queryLower) : false;
      const typeMatch = f.type ? f.type.toLowerCase().includes(queryLower) : false;

      return nameMatch || captionMatch || subformMatch || dataRefMatch || valueMatch || typeMatch;
    });
  }, [fields, queryLower, selectedTypeFilter]);

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
      setSelectedIndex(prev => (matchingFields.length > 0 ? (prev - 1 + matchingFields.length) % matchingFields.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matchingFields.length > 0 && matchingFields[selectedIndex]) {
        handleSelect(matchingFields[selectedIndex]);
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
    const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-sky-500/30 text-sky-200 font-semibold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
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
          <Search className="w-3.5 h-3.5" />
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
          placeholder={fields.length > 0 ? `Search ${fields.length} fields...` : 'Search form fields...'}
          className="w-full pl-8 pr-16 py-1.5 bg-slate-950/80 hover:bg-slate-900 focus:bg-slate-900 text-xs text-slate-100 placeholder-slate-400 border border-slate-700/80 hover:border-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40 rounded-lg transition-all"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {query ? (
            <button
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded shadow-xs">
              <span className="text-[10px]">⌘</span>K
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown Results Palette */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-80 sm:w-96 md:w-[480px] lg:w-[540px] max-w-[92vw] bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header Bar inside dropdown */}
          <div className="px-3 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-300">
                {queryLower ? (
                  <>
                    Found <span className="text-sky-400 font-semibold">{matchingFields.length}</span> matching fields
                  </>
                ) : (
                  <>
                    All Form Fields <span className="text-slate-400 font-mono">({fields.length})</span>
                  </>
                )}
              </span>
            </div>

            {/* Quick Type Filter Pills */}
            {availableTypes.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('all')}
                  className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                    selectedTypeFilter === 'all'
                      ? 'bg-sky-500/20 text-sky-300 font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  All
                </button>
                {availableTypes.slice(0, 4).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTypeFilter(t)}
                    className={`px-1.5 py-0.5 text-[10px] rounded capitalize transition-colors ${
                      selectedTypeFilter === t
                        ? 'bg-sky-500/20 text-sky-300 font-medium'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
                <p className="text-xs text-slate-300 font-medium">No fields found matching &ldquo;{query}&rdquo;</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Try searching by caption, technical identifier, subform path, or current value.
                </p>
              </li>
            ) : (
              matchingFields.map((field, idx) => {
                const isSelected = idx === selectedIndex;
                const pageNumber = field.bounds?.pageNumber || 1;
                const caption = field.caption || field.name;
                const showTechName = field.caption && field.caption !== field.name;

                return (
                  <li
                    key={field.id}
                    data-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(field)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-3 py-2 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-sky-600/20 text-slate-100 border border-sky-500/30'
                        : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                    }`}
                  >
                    {/* Left: Icon & Names */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-6 h-6 rounded-md bg-slate-800/80 border border-slate-700/60 flex items-center justify-center shrink-0">
                        {getFieldIcon(field.type)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xs font-medium text-slate-100 truncate">
                            {renderHighlightedText(caption, query)}
                          </span>

                          {showTechName && (
                            <span className="text-[10px] text-slate-400 font-mono truncate hidden sm:inline">
                              {renderHighlightedText(field.name, query)}
                            </span>
                          )}

                          {field.required && (
                            <span className="text-[9px] text-rose-400 font-semibold shrink-0">*req</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          {field.parentSubform && (
                            <span className="truncate max-w-[140px] sm:max-w-[200px] flex items-center gap-1 text-slate-400">
                              <FolderTree className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">{field.parentSubform}</span>
                            </span>
                          )}

                          <span className="px-1.5 py-0.2 bg-slate-800 rounded font-mono text-[9px] text-slate-300 uppercase">
                            {field.type}
                          </span>

                          {field.value && field.value.trim().length > 0 && (
                            <span className="text-slate-400 truncate italic max-w-[120px] hidden md:inline">
                              =&nbsp;&ldquo;{field.value}&rdquo;
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Page badge & Jump action */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700/80 text-sky-300 rounded font-mono">
                        Page {pageNumber}
                      </span>

                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-sky-400 font-medium">
                          <span>Jump</span>
                          <CornerDownLeft className="w-3 h-3" />
                        </span>
                      ) : (
                        <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer Shortcuts Info */}
          <div className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-slate-300">↑↓</kbd> to navigate
              </span>
              <span>
                <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-slate-300">↵</kbd> to jump
              </span>
              <span>
                <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-slate-300">ESC</kbd> to close
              </span>
            </div>
            <span className="font-mono text-slate-400 hidden sm:inline">AcroXFA Search</span>
          </div>
        </div>
      )}
    </div>
  );
};
