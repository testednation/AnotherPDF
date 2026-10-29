import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Check,
  CheckCheck,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  Send,
  SlidersHorizontal,
  Layers,
  ArrowRight,
  TrendingUp,
  Building,
  HelpCircle,
  Copy,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { XFAField, XFASubform } from '../types/pdf';

export interface FormSuggestion {
  fieldId: string;
  fieldName: string;
  fieldCaption: string;
  currentValue: string;
  suggestedValue: string;
  confidence: 'High' | 'Medium' | 'Low';
  rationale: string;
  category: 'organization' | 'financial' | 'contact' | 'compliance' | 'date' | 'general';
}

export interface FormAnalysisData {
  detectedFormType: string;
  summary: string;
  completionRate: number;
}

export interface ConsistencyWarning {
  title: string;
  description: string;
}

interface SmartFormAssistantProps {
  fields: XFAField[];
  subforms: XFASubform[];
  filename?: string;
  onApplyFieldSuggestion: (fieldId: string, newValue: string) => void;
  onBulkApplySuggestions: (suggestions: { fieldId: string; value: string }[]) => void;
  onNavigateToField?: (fieldId: string) => void;
  onClose?: () => void;
}

const INDUSTRY_PROFILES = [
  { id: 'cbf_publisher', label: '📚 Canadian Book Publisher', desc: 'Standard cultural publishing profile with royalties, title production, and sales metrics' },
  { id: 'non_profit_arts', label: '🎭 Arts & Non-Profit Association', desc: 'Grant allocations, public funding, memberships, and community cultural operations' },
  { id: 'academic_press', label: '🔬 Academic & Research Press', desc: 'Monograph publishing, scholarly subventions, peer-reviewed catalogue line items' },
  { id: 'commercial_corp', label: '💼 Commercial Media Corporation', desc: 'Enterprise corporate filings, multi-provincial presence, commercial trade sales' },
  { id: 'quebec_bilingual', label: '🍁 Quebec Bilingual Organization', desc: 'Montréal jurisdiction, French/English dual-language reporting standards' },
];

const PRESET_QUICK_PROMPTS = [
  'Simulate a Toronto indie publisher with $240,000 revenue and 12 annual titles',
  'Fill all contact and legal entity fields matching Ontario business registry',
  'Standardize financial expenses with 10% royalty rate and $35k printing costs',
  'Audit current fields for date consistency and province-postal code alignment',
];

export const SmartFormAssistant: React.FC<SmartFormAssistantProps> = ({
  fields,
  subforms,
  filename = 'Document.pdf',
  onApplyFieldSuggestion,
  onBulkApplySuggestions,
  onNavigateToField,
  onClose,
}) => {
  // Assistant configuration
  const [activeMode, setActiveMode] = useState<'complete_missing' | 'industry_profile' | 'consistency_audit' | 'custom_prompt'>('complete_missing');
  const [selectedProfile, setSelectedProfile] = useState<string>(INDUSTRY_PROFILES[0].label);
  const [customPrompt, setCustomPrompt] = useState<string>('');

  // Generation state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Results
  const [analysis, setAnalysis] = useState<FormAnalysisData | null>(null);
  const [suggestions, setSuggestions] = useState<FormSuggestion[]>([]);
  const [warnings, setWarnings] = useState<ConsistencyWarning[]>([]);
  const [appliedFieldIds, setAppliedFieldIds] = useState<Set<string>>(new Set());
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());

  // Search & Filters in results
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [filterMissingOnly, setFilterMissingOnly] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Field stats
  const stats = useMemo(() => {
    const total = fields.length;
    const filled = fields.filter(f => f.value && f.value.trim().length > 0 && f.value !== '0').length;
    const missing = total - filled;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    return { total, filled, missing, pct };
  }, [fields]);

  const handleGenerateSuggestions = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setLoadingStep('Inspecting XFA form structure and field bindings...');

    try {
      await new Promise(r => setTimeout(r, 200));
      setLoadingStep('Querying Gemini (gemini-3.8-flash) for contextual inference...');

      const response = await fetch('/api/ai/suggest-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: fields.map(f => ({
            id: f.id,
            name: f.name,
            caption: f.caption,
            type: f.type,
            value: f.value,
            parentSubform: f.parentSubform,
            tooltip: f.tooltip || f.assist?.toolTip,
            options: f.options,
          })),
          formTitle: filename,
          mode: activeMode,
          industryProfile: activeMode === 'industry_profile' ? selectedProfile : undefined,
          customPrompt: activeMode === 'custom_prompt' ? customPrompt : undefined,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with HTTP ${response.status}`);
      }

      setLoadingStep('Formatting structured suggestions and consistency checks...');
      const data = await response.json();

      setAnalysis(data.formAnalysis || {
        detectedFormType: 'Detected Form Document',
        summary: 'Analyzed with Gemini 3.8 Flash model.',
        completionRate: stats.pct,
      });

      const returnedSuggestions: FormSuggestion[] = Array.isArray(data.suggestions) ? data.suggestions : [];
      setSuggestions(returnedSuggestions);
      setWarnings(Array.isArray(data.consistencyWarnings) ? data.consistencyWarnings : []);

      // Auto-select all suggestions for quick one-click apply
      setSelectedSuggestionIds(new Set(returnedSuggestions.map(s => s.fieldId)));
      // Reset applied tracker
      setAppliedFieldIds(new Set());
    } catch (err: any) {
      console.error('SmartFormAssistant error:', err);
      setErrorMessage(err.message || 'Failed to generate suggestions. Please check connection and try again.');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleApplySingle = (suggestion: FormSuggestion) => {
    onApplyFieldSuggestion(suggestion.fieldId, suggestion.suggestedValue);
    setAppliedFieldIds(prev => new Set(prev).add(suggestion.fieldId));
  };

  const handleApplySelected = () => {
    const toApply = suggestions
      .filter(s => selectedSuggestionIds.has(s.fieldId))
      .map(s => ({ fieldId: s.fieldId, value: s.suggestedValue }));

    if (toApply.length === 0) return;

    onBulkApplySuggestions(toApply);
    setAppliedFieldIds(prev => {
      const next = new Set(prev);
      toApply.forEach(item => next.add(item.fieldId));
      return next;
    });
  };

  const handleApplyAll = () => {
    const toApply = suggestions.map(s => ({ fieldId: s.fieldId, value: s.suggestedValue }));
    if (toApply.length === 0) return;

    onBulkApplySuggestions(toApply);
    setAppliedFieldIds(new Set(suggestions.map(s => s.fieldId)));
  };

  const toggleSelectSuggestion = (fieldId: string) => {
    setSelectedSuggestionIds(prev => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

  const handleCopyValue = (id: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered suggestions
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(s => {
      if (filterMissingOnly && s.currentValue && s.currentValue.trim() !== '') {
        return false;
      }
      if (categoryFilter !== 'all' && s.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCaption = s.fieldCaption.toLowerCase().includes(q);
        const matchesName = s.fieldName.toLowerCase().includes(q);
        const matchesVal = s.suggestedValue.toLowerCase().includes(q);
        const matchesRationale = s.rationale.toLowerCase().includes(q);
        return matchesCaption || matchesName || matchesVal || matchesRationale;
      }
      return true;
    });
  }, [suggestions, filterMissingOnly, categoryFilter, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-text overflow-hidden">
      {/* Top Banner / Header */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-sky-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-xs">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-slate-100">
                Smart Form Assistant
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                gemini-3.8-flash
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Context-aware autofill, cross-field inference &amp; industry pattern validation
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-xs px-2.5 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
        {/* Document Stats & Progress Pill */}
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Completion</span>
              <span className="font-semibold text-slate-200">{stats.pct}% ({stats.filled}/{stats.total})</span>
            </div>
            <div className="h-6 w-px bg-slate-700" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Unfilled Fields</span>
              <span className="font-semibold text-amber-400">{stats.missing} fields</span>
            </div>
            <div className="h-6 w-px bg-slate-700 hidden sm:block" />
            <div className="hidden sm:block">
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Context Document</span>
              <span className="font-semibold text-slate-200 truncate max-w-[180px] block" title={filename}>
                {filename}
              </span>
            </div>
          </div>

          <div className="w-36 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-700/50">
            <div
              className="bg-gradient-to-r from-sky-500 to-purple-500 h-full transition-all duration-300"
              style={{ width: `${stats.pct}%` }}
            />
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="space-y-3">
          <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block font-mono">
            Assistant Mode &amp; Strategy
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => setActiveMode('complete_missing')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeMode === 'complete_missing'
                  ? 'bg-purple-950/40 border-purple-500/60 text-purple-200 shadow-sm'
                  : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium text-xs mb-1">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <span>Fill Missing</span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                Infer empty fields from existing entries
              </p>
            </button>

            <button
              onClick={() => setActiveMode('industry_profile')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeMode === 'industry_profile'
                  ? 'bg-sky-950/40 border-sky-500/60 text-sky-200 shadow-sm'
                  : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium text-xs mb-1">
                <Building className="w-3.5 h-3.5 text-sky-400" />
                <span>Industry Profile</span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                Autofill per publisher or non-profit archetypes
              </p>
            </button>

            <button
              onClick={() => setActiveMode('consistency_audit')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeMode === 'consistency_audit'
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200 shadow-sm'
                  : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium text-xs mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Audit &amp; Balance</span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                Check math sums, dates &amp; postal formats
              </p>
            </button>

            <button
              onClick={() => setActiveMode('custom_prompt')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeMode === 'custom_prompt'
                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 shadow-sm'
                  : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium text-xs mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Custom Directive</span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                Guide AI with freeform natural instructions
              </p>
            </button>
          </div>
        </div>

        {/* Mode-Specific Subcontrols */}
        {activeMode === 'industry_profile' && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="text-[11px] font-medium text-slate-300 block">
              Choose Pre-Configured Industry Profile:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {INDUSTRY_PROFILES.map(prof => (
                <button
                  key={prof.id}
                  onClick={() => setSelectedProfile(prof.label)}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    selectedProfile === prof.label
                      ? 'bg-sky-950/60 border-sky-500 text-sky-100 font-medium'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs">{prof.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{prof.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeMode === 'custom_prompt' && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="text-[11px] font-medium text-slate-300 block">
              Custom Instruction for Gemini:
            </span>
            <div className="relative">
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="E.g., Fill out this form for a Toronto poetry publisher with 14 books per year, $210k in sales, and Canadian citizenship status..."
                className="w-full h-20 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-400 resize-none"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 py-0.5">Quick templates:</span>
              {PRESET_QUICK_PROMPTS.map((quick, idx) => (
                <button
                  key={idx}
                  onClick={() => setCustomPrompt(quick)}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  {quick.slice(0, 32)}...
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <div>
          <button
            onClick={handleGenerateSuggestions}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl font-medium text-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:from-purple-500 hover:via-indigo-500 hover:to-sky-500 text-white shadow-md shadow-purple-950/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />
                <span>{loadingStep || 'Analyzing form fields with Gemini...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span>
                  {suggestions.length > 0
                    ? 'Regenerate Smart Suggestions with Gemini'
                    : 'Analyze & Suggest Field Values with Gemini'}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Generation Notice</span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Results Section */}
        {analysis && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Context Summary Card */}
            <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-purple-500/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400">
                  AI Context Analysis
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {suggestions.length} Suggestions Generated
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-100">
                {analysis.detectedFormType}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {analysis.summary}
              </p>
            </div>

            {/* Consistency Warnings (if any) */}
            {warnings.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Consistency &amp; Plausibility Checks ({warnings.length})</span>
                </div>
                <div className="space-y-1.5">
                  {warnings.map((w, idx) => (
                    <div key={idx} className="text-xs bg-amber-950/40 rounded p-2 text-amber-200/90 border border-amber-900/50">
                      <span className="font-medium text-amber-100 block">{w.title}</span>
                      <span className="text-[11px] text-amber-300/80">{w.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter and Bulk Action Bar */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search suggested fields or rationale..."
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-400"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setFilterMissingOnly(!filterMissingOnly)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
                      filterMissingOnly
                        ? 'bg-purple-950 border-purple-500 text-purple-200'
                        : 'bg-slate-900 border-slate-750 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    <span>Unfilled Only</span>
                  </button>

                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700/80 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden"
                  >
                    <option value="all">All Categories</option>
                    <option value="organization">Organization</option>
                    <option value="financial">Financial</option>
                    <option value="contact">Contact</option>
                    <option value="date">Dates</option>
                    <option value="compliance">Compliance</option>
                  </select>
                </div>
              </div>

              {/* Bulk Apply Buttons */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedSuggestionIds.size === suggestions.length) {
                        setSelectedSuggestionIds(new Set());
                      } else {
                        setSelectedSuggestionIds(new Set(suggestions.map(s => s.fieldId)));
                      }
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {selectedSuggestionIds.size === suggestions.length ? 'Deselect All' : 'Select All'}
                    </span>
                  </button>
                  <span className="text-slate-600">•</span>
                  <span className="text-[11px] text-slate-400">
                    {selectedSuggestionIds.size} of {suggestions.length} selected
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleApplySelected}
                    disabled={selectedSuggestionIds.size === 0}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Selected ({selectedSuggestionIds.size})</span>
                  </button>

                  <button
                    onClick={handleApplyAll}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Apply All ({suggestions.length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Suggestions List */}
            <div className="space-y-3">
              {filteredSuggestions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs bg-slate-950/40 border border-slate-800/80 rounded-xl">
                  No suggestions matching your current filter criteria.
                </div>
              ) : (
                filteredSuggestions.map(suggestion => {
                  const isSelected = selectedSuggestionIds.has(suggestion.fieldId);
                  const isApplied = appliedFieldIds.has(suggestion.fieldId);

                  return (
                    <div
                      key={suggestion.fieldId}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isApplied
                          ? 'bg-emerald-950/20 border-emerald-800/50 text-slate-200'
                          : isSelected
                          ? 'bg-slate-900/90 border-slate-700/80 shadow-xs'
                          : 'bg-slate-950/50 border-slate-800/60 opacity-80'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectSuggestion(suggestion.fieldId)}
                          className="mt-1 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-0 cursor-pointer"
                        />

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Field Title & Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div>
                              <span className="text-xs font-semibold text-slate-100 block">
                                {suggestion.fieldCaption || suggestion.fieldName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block truncate">
                                {suggestion.fieldId}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                                  suggestion.confidence === 'High'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : suggestion.confidence === 'Medium'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-sky-950 text-sky-300 border border-sky-800'
                                }`}
                              >
                                {suggestion.confidence} Confidence
                              </span>

                              {isApplied && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-medium">
                                  <Check className="w-3 h-3" />
                                  <span>Applied</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Value Diff (Current -> Suggested) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2">
                              <span className="text-[10px] text-slate-500 block uppercase font-mono">Current Value</span>
                              <span className="font-mono text-slate-300 truncate block">
                                {suggestion.currentValue ? suggestion.currentValue : <em className="text-slate-600">(empty)</em>}
                              </span>
                            </div>

                            <div className="bg-purple-950/30 border border-purple-500/30 rounded-lg p-2 relative group">
                              <span className="text-[10px] text-purple-400 block uppercase font-mono flex items-center justify-between">
                                <span>Suggested Value</span>
                                <button
                                  onClick={() => handleCopyValue(suggestion.fieldId, suggestion.suggestedValue)}
                                  className="text-slate-400 hover:text-purple-300 p-0.5"
                                  title="Copy suggested value"
                                >
                                  {copiedId === suggestion.fieldId ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </span>
                              <span className="font-mono text-purple-200 font-semibold truncate block">
                                {suggestion.suggestedValue}
                              </span>
                            </div>
                          </div>

                          {/* Gemini Context Rationale */}
                          <div className="text-[11px] text-slate-400 bg-slate-950/40 rounded p-2 border border-slate-800/60 leading-relaxed flex items-start gap-1.5">
                            <Sparkles className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                            <span>{suggestion.rationale}</span>
                          </div>

                          {/* Action Footnotes */}
                          <div className="flex items-center justify-between pt-1">
                            {onNavigateToField && (
                              <button
                                onClick={() => onNavigateToField(suggestion.fieldId)}
                                className="text-[11px] text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1"
                              >
                                <span>View field in editor</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}

                            <button
                              onClick={() => handleApplySingle(suggestion)}
                              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                                isApplied
                                  ? 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 border border-emerald-800'
                                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-xs'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              <span>{isApplied ? 'Re-apply' : 'Apply'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
