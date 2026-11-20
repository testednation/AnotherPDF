import React, { useState } from 'react';
import {
  Sparkles,
  Building2,
  History,
  Plus,
  Trash2,
  Check,
  X,
  Wand2,
} from 'lucide-react';
import { XFAField } from '../types/pdf';
import {
  SmartSuggestStore,
  BusinessEntityProfile,
  CATEGORY_LABELS,
  getAllBusinessProfiles,
  classifyFieldEntityCategory,
} from '../utils/fieldSmartSuggest';

interface SmartSuggestPanelProps {
  store: SmartSuggestStore;
  allFields: XFAField[];
  onClose: () => void;
  onToggleEnabled: () => void;
  onSelectActiveProfile: (profileId: string | null) => void;
  onApplyProfileToEmptyFields: (profile: BusinessEntityProfile) => void;
  onSaveCurrentFormAsProfile: (profileName: string) => void;
  onDeleteCustomProfile: (profileId: string) => void;
  onRemoveLearnedEntry: (entryId: string) => void;
  onClearAllLearned: () => void;
}

export const SmartSuggestPanel: React.FC<SmartSuggestPanelProps> = ({
  store,
  allFields,
  onClose,
  onToggleEnabled,
  onSelectActiveProfile,
  onApplyProfileToEmptyFields,
  onSaveCurrentFormAsProfile,
  onDeleteCustomProfile,
  onRemoveLearnedEntry,
  onClearAllLearned,
}) => {
  const [activeTab, setActiveTab] = useState<'entities' | 'history'>('entities');
  const [newProfileName, setNewProfileName] = useState('');
  const [historyFilter, setHistoryFilter] = useState('');

  const allProfiles = getAllBusinessProfiles(store);

  // Count how many empty fields in the current form match an entity profile
  const countFillableForProfile = (profile: BusinessEntityProfile): number => {
    return allFields.filter(f => {
      if (f.readOnly || f.type === 'check' || f.type === 'choice') return false;
      const isEmpty = !f.value || f.value.trim() === '' || f.value === '0';
      if (!isEmpty) return false;
      const cat = classifyFieldEntityCategory(f);
      return Boolean(profile.values[cat]);
    }).length;
  };

  const filteredEntries = store.entries.filter(entry => {
    if (!historyFilter.trim()) return true;
    const q = historyFilter.toLowerCase();
    return (
      entry.value.toLowerCase().includes(q) ||
      entry.fieldLabel.toLowerCase().includes(q) ||
      CATEGORY_LABELS[entry.category].toLowerCase().includes(q)
    );
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newProfileName.trim();
    if (!trimmed) return;
    onSaveCurrentFormAsProfile(trimmed);
    setNewProfileName('');
  };

  return (
    <div className="bg-slate-900 border border-sky-700/50 rounded-xl p-4 space-y-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            <h3 className="text-sm font-semibold text-slate-100">
              Field Smart-Suggest Memory &amp; Business Entities
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Provides instant autocomplete from your previously entered patterns, sibling form fields, and reusable business entity profiles.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleEnabled}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
              store.enabled
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/50 hover:bg-sky-500/25'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            {store.enabled ? 'Smart-Suggest: Active' : 'Smart-Suggest: Paused'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Smart-Suggest panel"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Segmented Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 rounded-lg bg-slate-950 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('entities')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'entities'
                ? 'bg-slate-800 text-sky-300 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Business Entities ({allProfiles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'bg-slate-800 text-sky-300 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="tabular-nums">Learned Patterns ({store.entries.length})</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400">
          Focus any text, numeric, or date input · Press <kbd className="px-1 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">Tab</kbd> to accept ghost completions
        </span>
      </div>

      {/* Tab 1: Business Entity Profiles */}
      {activeTab === 'entities' ? (
        <div className="space-y-4">
          {/* Save Current Form as Reusable Business Entity Profile */}
          <form
            onSubmit={handleSaveProfile}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-lg bg-slate-950/70 border border-slate-800"
          >
            <input
              type="text"
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              placeholder="Save current form's org, contact, address & tax ID as a reusable entity profile..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={!newProfileName.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Current Entity</span>
            </button>
          </form>

          {/* Entity Profile List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allProfiles.map(profile => {
              const isSelected = store.activeProfileId === profile.id;
              const fillableCount = countFillableForProfile(profile);
              const previewMeta = [
                profile.industry,
                profile.values.city && profile.values.province_state
                  ? `${profile.values.city}, ${profile.values.province_state}`
                  : profile.values.city || null,
                profile.values.business_number || null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  key={profile.id}
                  className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-sky-950/30 border-sky-600/70'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {profile.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {previewMeta}
                        </div>
                      </div>

                      {profile.isCustom && (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomProfile(profile.id)}
                          title="Delete saved custom profile"
                          className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono truncate pt-1">
                      {profile.values.person_name ? `${profile.values.person_name}` : ''}
                      {profile.values.person_name && profile.values.email ? ' · ' : ''}
                      {profile.values.email || ''}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() =>
                        onSelectActiveProfile(isSelected ? null : profile.id)
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      <span>{isSelected ? 'Prioritized' : 'Prioritize Suggestions'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onApplyProfileToEmptyFields(profile)}
                      disabled={fillableCount === 0}
                      title={
                        fillableCount > 0
                          ? `Fill ${fillableCount} empty matching fields using ${profile.name}`
                          : 'All matching entity fields already have values'
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span className="tabular-nums">
                        Fill Empty ({fillableCount})
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Tab 2: Learned Data Patterns */
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <input
              type="text"
              value={historyFilter}
              onChange={e => setHistoryFilter(e.target.value)}
              placeholder="Filter learned patterns by value, field, or category..."
              className="flex-1 max-w-md bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            {store.entries.length > 0 && (
              <button
                type="button"
                onClick={onClearAllLearned}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Learned History</span>
              </button>
            )}
          </div>

          {filteredEntries.length === 0 ? (
            <div className="py-8 px-4 text-center rounded-xl bg-slate-950/50 border border-slate-800 space-y-1.5">
              <p className="text-xs font-medium text-slate-300">
                {store.entries.length === 0
                  ? 'No learned field patterns stored yet'
                  : `No saved patterns match "${historyFilter}"`}
              </p>
              <p className="text-[11px] text-slate-400">
                {store.entries.length === 0
                  ? 'Type into any form field and move to the next field — Smart-Suggest automatically remembers your values locally for future forms.'
                  : 'Try a shorter keyword or clear the filter.'}
              </p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/80 border border-slate-800 rounded-xl bg-slate-950/50">
              {filteredEntries.map(entry => (
                <div
                  key={entry.id}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/70 transition-colors text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-100 truncate">
                      {entry.value}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate mt-0.5">
                      <span>{CATEGORY_LABELS[entry.category]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{entry.fieldLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-sky-400">
                        {entry.useCount}× used
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveLearnedEntry(entry.id)}
                    title="Remove learned pattern"
                    className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
