import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, History, Building2, FileText, X, CornerDownLeft } from 'lucide-react';
import { XFAField } from '../types/pdf';
import {
  SmartSuggestStore,
  SmartSuggestion,
  CATEGORY_LABELS,
  classifyFieldEntityCategory,
  getSmartSuggestionsForField,
  getInlineGhostSuffix,
} from '../utils/fieldSmartSuggest';

interface SmartSuggestInputProps {
  field: XFAField;
  allFields: XFAField[];
  store: SmartSuggestStore;
  value: string;
  onChange: (value: string) => void;
  onCommitValue?: (field: XFAField, value: string) => void;
  onDeleteHistoryEntry?: (entryId: string) => void;
  id?: string;
  inputType?: 'text' | 'date' | 'textarea';
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  leftPaddingClass?: string;
  onFocusExtra?: () => void;
  onBlurExtra?: () => void;
}

interface DropdownRect {
  top: number;
  left: number;
  width: number;
  openUpward: boolean;
}

export const SmartSuggestInput: React.FC<SmartSuggestInputProps> = ({
  field,
  allFields,
  store,
  value,
  onChange,
  onCommitValue,
  onDeleteHistoryEntry,
  id,
  inputType = 'text',
  rows = 3,
  disabled = false,
  placeholder,
  className = '',
  leftPaddingClass = '',
  onFocusExtra,
  onBlurExtra,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownRect, setDropdownRect] = useState<DropdownRect | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const smartEnabled = store.enabled && !disabled;

  const suggestions = useMemo(() => {
    if (!smartEnabled) return [];
    return getSmartSuggestionsForField(field, value, allFields, store, 7);
  }, [smartEnabled, field, value, allFields, store]);

  const category = useMemo(() => classifyFieldEntityCategory(field), [field]);

  const ghostSuffix = useMemo(() => {
    if (!smartEnabled || !isFocused || inputType !== 'text') return '';
    return getInlineGhostSuffix(value, suggestions);
  }, [smartEnabled, isFocused, inputType, value, suggestions]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [suggestions.length, value]);

  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = Math.min(280, Math.max(120, suggestions.length * 42 + 64));
    const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    const width = Math.max(rect.width, 260);
    const maxLeft = Math.max(8, window.innerWidth - width - 8);

    setDropdownRect({
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      left: Math.min(Math.max(8, rect.left), maxLeft),
      width: Math.min(width, window.innerWidth - 16),
      openUpward,
    });
  }, [suggestions.length]);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();

    const handleScrollOrResize = () => updateDropdownPosition();
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, updateDropdownPosition]);

  const applySuggestion = useCallback(
    (suggestion: SmartSuggestion) => {
      onChange(suggestion.value);
      onCommitValue?.(field, suggestion.value);
      setIsOpen(false);
      // Keep focus on input for smooth form flow
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },
    [field, onChange, onCommitValue]
  );

  const handleFocus = () => {
    setIsFocused(true);
    onFocusExtra?.();
    if (smartEnabled && suggestions.length > 0 && inputType !== 'date') {
      setIsOpen(true);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlurExtra?.();
    if (smartEnabled && value.trim().length >= 2) {
      onCommitValue?.(field, value);
    }
    // Slight delay so click inside portal popover registers before closing
    setTimeout(() => {
      if (
        document.activeElement &&
        popoverRef.current?.contains(document.activeElement)
      ) {
        return;
      }
      setIsOpen(false);
    }, 120);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (!smartEnabled) return;

    // Alt+ArrowDown explicitly opens suggestions
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) setIsOpen(true);
      return;
    }

    // Tab or Right-Arrow at end of single-line text accepts inline ghost completion
    if (
      inputType === 'text' &&
      ghostSuffix &&
      (e.key === 'Tab' ||
        (e.key === 'ArrowRight' &&
          inputRef.current &&
          inputRef.current.selectionStart === value.length &&
          inputRef.current.selectionEnd === value.length))
    ) {
      const completed = value + ghostSuffix;
      e.preventDefault();
      onChange(completed);
      onCommitValue?.(field, completed);
      setIsOpen(false);
      return;
    }

    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && inputType !== 'textarea') {
      const active = suggestions[highlightedIndex];
      if (active) {
        e.preventDefault();
        applySuggestion(active);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const renderSourceIcon = (source: SmartSuggestion['source']) => {
    switch (source) {
      case 'history':
        return <History className="w-3 h-3 text-sky-400 shrink-0" />;
      case 'document':
        return <FileText className="w-3 h-3 text-emerald-400 shrink-0" />;
      case 'profile':
        return <Building2 className="w-3 h-3 text-amber-400 shrink-0" />;
      default:
        return <Sparkles className="w-3 h-3 text-slate-400 shrink-0" />;
    }
  };

  const showTrigger = smartEnabled && suggestions.length > 0;
  const paddingRightClass = showTrigger
    ? inputType === 'date'
      ? 'pr-14'
      : ghostSuffix
      ? 'pr-16'
      : 'pr-8'
    : '';

  const mirrorFontClass = [
    className.includes('font-mono') ? 'font-mono tabular-nums' : '',
    className.includes('font-serif') ? 'font-serif' : '',
    className.includes('italic') ? 'italic' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Inline ghost autocomplete mirror for single-line text inputs */}
      {inputType === 'text' && ghostSuffix && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre text-xs border border-transparent ${mirrorFontClass} ${
            leftPaddingClass || 'px-3'
          } ${paddingRightClass} py-1.5`}
        >
          <span className="invisible">{value}</span>
          <span className="text-slate-500 truncate">{ghostSuffix}</span>
        </div>
      )}

      {inputType === 'textarea' ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          id={id}
          rows={rows}
          value={value}
          disabled={disabled}
          onChange={e => {
            onChange(e.target.value);
            if (smartEnabled && !isOpen) setIsOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${className} ${showTrigger ? 'pr-8' : ''}`}
          autoComplete="off"
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          id={id}
          type={inputType}
          value={value}
          disabled={disabled}
          onChange={e => {
            onChange(e.target.value);
            if (smartEnabled && inputType !== 'date' && !isOpen) setIsOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${className} ${paddingRightClass}`}
          autoComplete="off"
        />
      )}

      {/* Right-side Tab hint + Smart-Suggest trigger */}
      {showTrigger && (
        <div
          className={`absolute flex items-center gap-1 ${
            inputType === 'date' ? 'right-8 top-1/2 -translate-y-1/2' : inputType === 'textarea' ? 'right-1.5 top-1.5' : 'right-1.5 top-1/2 -translate-y-1/2'
          }`}
        >
          {ghostSuffix && inputType === 'text' && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={e => {
                e.preventDefault();
                const completed = value + ghostSuffix;
                onChange(completed);
                onCommitValue?.(field, completed);
                setIsOpen(false);
              }}
              className="px-1.5 py-0.5 text-[10px] font-mono text-sky-300 bg-sky-950/90 hover:bg-sky-900 border border-sky-700/70 rounded transition-colors cursor-pointer"
              title="Accept inline completion (Tab)"
            >
              Tab
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={e => {
              e.preventDefault();
              setIsOpen(prev => !prev);
            }}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isOpen
                ? 'text-sky-300 bg-sky-500/20'
                : 'text-slate-400 hover:text-sky-300 hover:bg-slate-800/80'
            }`}
            title={`Field Smart-Suggest (${suggestions.length} ${suggestions.length === 1 ? 'suggestion' : 'suggestions'} · Alt+↓)`}
            aria-label={`Show ${suggestions.length} smart suggestions for ${field.caption || field.name}`}
            aria-expanded={isOpen}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Portal-rendered Smart-Suggest Dropdown (never clipped by scroll containers or drawers) */}
      {isOpen &&
        smartEnabled &&
        suggestions.length > 0 &&
        dropdownRect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            aria-label={`Smart suggestions for ${field.caption || field.name}`}
            style={{
              position: 'fixed',
              left: `${dropdownRect.left}px`,
              width: `${dropdownRect.width}px`,
              ...(dropdownRect.openUpward
                ? { bottom: `${window.innerHeight - dropdownRect.top}px` }
                : { top: `${dropdownRect.top}px` }),
            }}
            className="z-[90] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden text-xs text-slate-100 animate-in fade-in duration-100"
          >
            {/* Header row */}
            <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-slate-300 flex items-center gap-1.5 truncate">
                <Sparkles className="w-3 h-3 text-sky-400 shrink-0" />
                <span>Smart-Suggest</span>
                <span className="text-slate-500" aria-hidden="true">·</span>
                <span className="text-slate-400 truncate">{CATEGORY_LABELS[category]}</span>
              </span>
              <span className="text-[10px] font-mono tabular-nums text-slate-500 shrink-0">
                {suggestions.length} {suggestions.length === 1 ? 'match' : 'matches'}
              </span>
            </div>

            {/* Suggestions list */}
            <div className="max-h-56 overflow-y-auto py-1">
              {suggestions.map((item, idx) => {
                const isActive = idx === highlightedIndex;
                return (
                  <div
                    key={item.id}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onMouseDown={e => {
                      e.preventDefault();
                      applySuggestion(item);
                    }}
                    className={`group px-3 py-2 flex items-start justify-between gap-2.5 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-sky-500/15 text-white'
                        : 'text-slate-200 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <span className="mt-0.5">{renderSourceIcon(item.source)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs leading-snug break-words">
                          {item.value}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                          <span
                            className={
                              item.source === 'history'
                                ? 'text-sky-400'
                                : item.source === 'document'
                                ? 'text-emerald-400'
                                : item.source === 'profile'
                                ? 'text-amber-300'
                                : 'text-slate-400'
                            }
                          >
                            {item.sourceLabel}
                          </span>
                          {item.detail && (
                            <>
                              <span className="text-slate-600" aria-hidden="true">·</span>
                              <span className="truncate">{item.detail}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.historyEntryId && onDeleteHistoryEntry && (
                        <button
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDeleteHistoryEntry(item.historyEntryId!);
                          }}
                          title="Remove from learned history"
                          aria-label={`Remove ${item.value} from saved patterns`}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {isActive && (
                        <CornerDownLeft className="w-3 h-3 text-sky-400 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quiet keyboard navigation footer */}
            <div className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>↑↓ navigate · Enter/Tab accept · Esc close</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
