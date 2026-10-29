import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info, Sparkles, Volume2, ShieldCheck, Check } from 'lucide-react';
import { XFAField } from '../types/pdf';
import { getFieldTooltipGuide, FieldTooltipGuide } from '../utils/xfaTooltipHelper';

interface FieldTooltipPopoverProps {
  field: XFAField;
  variant?: 'icon' | 'badge' | 'inline';
  className?: string;
}

export const FieldTooltipPopover: React.FC<FieldTooltipPopoverProps> = ({
  field,
  variant = 'icon',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<any>(null);

  const guide: FieldTooltipGuide = getFieldTooltipGuide(field);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsOpen(true), 150);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsOpen(false), 200);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Button */}
      {variant === 'badge' ? (
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
            guide.hasExplicitAssist
              ? 'bg-sky-950/80 text-sky-300 border border-sky-800/80 hover:bg-sky-900/80'
              : 'bg-slate-800/80 text-slate-400 border border-slate-700/80 hover:text-slate-200'
          }`}
          title={guide.guidance}
          aria-label={`Field Help: ${guide.title}`}
        >
          <HelpCircle className="w-3 h-3 text-sky-400" />
          <span>Help</span>
        </button>
      ) : variant === 'inline' ? (
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className="text-slate-400 hover:text-sky-300 transition-colors p-0.5 rounded"
          title={guide.guidance}
          aria-label={`Field Help: ${guide.title}`}
        >
          <Info className="w-3.5 h-3.5 text-sky-400/80" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className={`p-1 rounded transition-colors ${
            guide.hasExplicitAssist
              ? 'text-sky-400 hover:text-sky-300 hover:bg-sky-950/60'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
          }`}
          title={guide.guidance}
          aria-label={`Field Assistance: ${guide.title}`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Floating Tooltip Card */}
      {isOpen && (
        <div
          role="tooltip"
          className="absolute left-0 bottom-full mb-2 z-50 w-72 sm:w-80 p-3 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl text-slate-100 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 select-text pointer-events-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
              <h4 className="font-semibold text-xs text-slate-100 truncate">
                {guide.title}
              </h4>
            </div>

            {/* Source Badge */}
            {guide.hasExplicitAssist ? (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800 shrink-0 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-sky-400" />
                <span>XFA Assist</span>
              </span>
            ) : (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">
                Guide
              </span>
            )}
          </div>

          {/* Main Guidance Text */}
          <p className="text-xs text-slate-300 leading-relaxed">
            {guide.guidance}
          </p>

          {/* Accessibility Speech Prompt (<speak> tag) */}
          {guide.speakPrompt && (
            <div className="mt-2 p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center gap-1.5 text-[11px] text-slate-300">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-mono text-[10px] text-emerald-300 truncate">
                Speech: "{guide.speakPrompt}"
              </span>
            </div>
          )}

          {/* Format Hint / Validation constraints */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono text-slate-400">
            {guide.formatHint && (
              <span className="text-amber-300/90 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
                {guide.formatHint}
              </span>
            )}

            {guide.isRequired ? (
              <span className="text-rose-300 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-800/40 font-semibold">
                Mandatory
              </span>
            ) : (
              <span className="text-slate-400">
                Optional
              </span>
            )}

            <span className="text-slate-500 truncate" title={`Binding: ${guide.bindingPath}`}>
              ref: {guide.bindingPath}
            </span>
          </div>

          {/* Tooltip Arrow */}
          <div className="absolute left-3 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-700" />
        </div>
      )}
    </div>
  );
};
