import React, { useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  X,
  Search,
  Trash2,
  Check,
  Edit2,
  ExternalLink,
  FileText,
  Network,
  CheckSquare,
  Square,
  MinusSquare,
  Filter,
} from 'lucide-react';
import { XFASubform, XFAField } from '../types/pdf';
import {
  FieldTagDefinition,
  FieldTagStore,
  TagColorKey,
  TagMatchMode,
  TAG_COLOR_KEYS,
  TAG_COLOR_PALETTE,
  SUGGESTED_FIELD_TAGS,
  getFieldTagDefinitions,
  getTagUsageCounts,
  matchesFieldTagFilter,
} from '../utils/fieldTags';

interface FieldTagManagerPanelProps {
  subforms: XFASubform[];
  allFields: XFAField[];
  tagStore: FieldTagStore;
  activeFilterTagIds: string[];
  tagMatchMode: TagMatchMode;
  untaggedOnly: boolean;
  onToggleFilterTag: (tagId: string) => void;
  onSetTagMatchMode: (mode: TagMatchMode) => void;
  onToggleUntaggedOnly: () => void;
  onClearTagFilters: () => void;
  onCreateTag: (name: string, color: TagColorKey, description?: string) => FieldTagDefinition | null;
  onUpdateTag: (tagId: string, updates: { name?: string; color?: TagColorKey; description?: string }) => void;
  onDeleteTag: (tagId: string) => void;
  onToggleFieldTag: (fieldId: string, tagId: string) => void;
  onBulkAssignTag: (fieldIds: string[], tagId: string) => void;
  onBulkRemoveTag: (fieldIds: string[], tagId: string) => void;
  onInspectInGraph?: (fieldId: string) => void;
  onNavigateToField?: (fieldId: string) => void;
  onNavigateToFormEditor?: (fieldId: string) => void;
}

export const FieldTagManagerPanel: React.FC<FieldTagManagerPanelProps> = ({
  subforms,
  allFields,
  tagStore,
  activeFilterTagIds,
  tagMatchMode,
  untaggedOnly,
  onToggleFilterTag,
  onSetTagMatchMode,
  onToggleUntaggedOnly,
  onClearTagFilters,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onToggleFieldTag,
  onBulkAssignTag,
  onBulkRemoveTag,
  onInspectInGraph,
  onNavigateToField,
  onNavigateToFormEditor,
}) => {
  // Tag creation form state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<TagColorKey>('sky');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [tagFormError, setTagFormError] = useState<string | null>(null);

  // Inline tag editing state
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState<TagColorKey>('sky');

  // Field list filtering & multi-select state
  const [fieldSearch, setFieldSearch] = useState('');
  const [subformFilter, setSubformFilter] = useState<string>('all');
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());
  const [openPickerFieldId, setOpenPickerFieldId] = useState<string | null>(null);
  const [inlineQuickTagInput, setInlineQuickTagInput] = useState('');

  const validFieldIdSet = useMemo(() => new Set(allFields.map(f => f.id)), [allFields]);

  const tagUsageCounts = useMemo(
    () => getTagUsageCounts(tagStore, validFieldIdSet),
    [tagStore, validFieldIdSet]
  );

  const taggedFieldCount = useMemo(() => {
    let count = 0;
    allFields.forEach(f => {
      if ((tagStore.assignments[f.id]?.length || 0) > 0) count++;
    });
    return count;
  }, [allFields, tagStore]);

  const untaggedFieldCount = allFields.length - taggedFieldCount;

  const existingTagNamesLower = useMemo(
    () => new Set(tagStore.definitions.map(d => d.name.toLowerCase())),
    [tagStore.definitions]
  );

  const availableSuggestions = useMemo(
    () => SUGGESTED_FIELD_TAGS.filter(s => !existingTagNamesLower.has(s.name.toLowerCase())),
    [existingTagNamesLower]
  );

  // Build subform options
  const subformOptions = useMemo(() => {
    const names = new Set<string>();
    subforms.forEach(sf => {
      if (sf.title || sf.name) names.add(sf.title || sf.name);
    });
    allFields.forEach(f => {
      if (f.parentSubform) names.add(f.parentSubform);
    });
    return Array.from(names);
  }, [subforms, allFields]);

  // Filtered fields list
  const filteredFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    return allFields.filter(field => {
      if (
        !matchesFieldTagFilter(
          tagStore,
          field.id,
          activeFilterTagIds,
          tagMatchMode,
          untaggedOnly
        )
      ) {
        return false;
      }

      if (subformFilter !== 'all') {
        const sfMatch = (field.parentSubform || '').toLowerCase() === subformFilter.toLowerCase();
        if (!sfMatch) {
          // Also check if field belongs to a subform whose title matches
          const matchedSf = subforms.find(
            sf =>
              (sf.title || sf.name).toLowerCase() === subformFilter.toLowerCase() &&
              sf.fields.some(f => f.id === field.id)
          );
          if (!matchedSf) return false;
        }
      }

      if (!q) return true;
      const fieldTags = getFieldTagDefinitions(tagStore, field.id);
      return (
        field.name.toLowerCase().includes(q) ||
        (field.caption && field.caption.toLowerCase().includes(q)) ||
        (field.value && field.value.toLowerCase().includes(q)) ||
        (field.parentSubform && field.parentSubform.toLowerCase().includes(q)) ||
        fieldTags.some(t => t.name.toLowerCase().includes(q))
      );
    });
  }, [
    allFields,
    subforms,
    tagStore,
    activeFilterTagIds,
    tagMatchMode,
    untaggedOnly,
    subformFilter,
    fieldSearch,
  ]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setTagFormError('Enter a tag name.');
      return;
    }
    if (existingTagNamesLower.has(trimmed.toLowerCase())) {
      setTagFormError(`Tag "${trimmed}" already exists.`);
      return;
    }
    const created = onCreateTag(trimmed, newTagColor, newTagDescription.trim() || undefined);
    if (created) {
      setNewTagName('');
      setNewTagDescription('');
      setTagFormError(null);
    }
  };

  const startEditingTag = (tag: FieldTagDefinition) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  };

  const commitEditingTag = (tagId: string) => {
    const trimmed = editTagName.trim();
    if (!trimmed) return;
    onUpdateTag(tagId, { name: trimmed, color: editTagColor });
    setEditingTagId(null);
  };

  const toggleSelectField = (fieldId: string) => {
    setSelectedFieldIds(prev => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

  const allVisibleSelected =
    filteredFields.length > 0 && filteredFields.every(f => selectedFieldIds.has(f.id));
  const someVisibleSelected =
    filteredFields.some(f => selectedFieldIds.has(f.id)) && !allVisibleSelected;

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedFieldIds(prev => {
        const next = new Set(prev);
        filteredFields.forEach(f => next.delete(f.id));
        return next;
      });
    } else {
      setSelectedFieldIds(prev => {
        const next = new Set(prev);
        filteredFields.forEach(f => next.add(f.id));
        return next;
      });
    }
  };

  const handleQuickCreateAndAssign = (fieldId: string) => {
    const trimmed = inlineQuickTagInput.trim();
    if (!trimmed) return;
    const existing = tagStore.definitions.find(
      d => d.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      const assigned = tagStore.assignments[fieldId] || [];
      if (!assigned.includes(existing.id)) {
        onToggleFieldTag(fieldId, existing.id);
      }
    } else {
      const nextColor = TAG_COLOR_KEYS[tagStore.definitions.length % TAG_COLOR_KEYS.length];
      const created = onCreateTag(trimmed, nextColor);
      if (created) {
        onToggleFieldTag(fieldId, created.id);
      }
    }
    setInlineQuickTagInput('');
  };

  const selectedIdsArray = useMemo(() => Array.from(selectedFieldIds), [selectedFieldIds]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-950 text-slate-100 select-text">
      {/* LEFT COLUMN: TAG LIBRARY & CREATION */}
      <aside className="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/70 flex flex-col shrink-0 max-h-[42vh] lg:max-h-none overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div>
            <h2 className="text-xs font-semibold text-slate-100">Custom Field Tags</h2>
            <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
              {tagStore.definitions.length} {tagStore.definitions.length === 1 ? 'tag' : 'tags'} · {taggedFieldCount}/{allFields.length} fields tagged
            </p>
          </div>
          {(activeFilterTagIds.length > 0 || untaggedOnly) && (
            <button
              type="button"
              onClick={onClearTagFilters}
              className="px-2 py-1 text-[11px] font-medium text-sky-300 hover:text-sky-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Create New Tag Form */}
          <form onSubmit={handleCreateSubmit} className="space-y-2.5 pb-4 border-b border-slate-800/80">
            <label className="block text-xs font-medium text-slate-200">
              Create Custom Tag
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={e => {
                  setNewTagName(e.target.value);
                  if (tagFormError) setTagFormError(null);
                }}
                placeholder="e.g. Audit Priority, Q4 Revenue..."
                maxLength={32}
                className="flex-1 min-w-0 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            <input
              type="text"
              value={newTagDescription}
              onChange={e => setNewTagDescription(e.target.value)}
              placeholder="Optional description (e.g. Verified by legal team)"
              maxLength={80}
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 placeholder-slate-500 focus:outline-none transition-colors"
            />

            {/* Color Swatch Selector */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] text-slate-400">Color</span>
              <div className="flex items-center gap-1.5">
                {TAG_COLOR_KEYS.map(colorKey => {
                  const style = TAG_COLOR_PALETTE[colorKey];
                  const isSelected = newTagColor === colorKey;
                  return (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setNewTagColor(colorKey)}
                      title={style.label}
                      aria-label={`Select ${style.label} color`}
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-transform cursor-pointer ${
                        isSelected
                          ? 'border-white scale-110 ring-1 ring-white/40'
                          : 'border-slate-700 hover:scale-105'
                      }`}
                      style={{ backgroundColor: `${style.hex}28` }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: style.hex }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {tagFormError && (
              <p className="text-[11px] text-rose-400">{tagFormError}</p>
            )}
          </form>

          {/* Active Tags Library (Click to Filter) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-slate-300">Filter by Tag</h3>
              <button
                type="button"
                onClick={onToggleUntaggedOnly}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer tabular-nums ${
                  untaggedOnly
                    ? 'bg-slate-800 border-sky-500 text-sky-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Untagged ({untaggedFieldCount})
              </button>
            </div>

            {tagStore.definitions.length === 0 ? (
              <div className="py-5 px-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-center space-y-1.5">
                <Tag className="w-4 h-4 text-slate-600 mx-auto" />
                <p className="text-xs font-medium text-slate-300">No custom tags yet</p>
                <p className="text-[11px] text-slate-500">
                  Create a tag above or pick a quick preset below to start organizing fields.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {tagStore.definitions.map(tag => {
                  const style = TAG_COLOR_PALETTE[tag.color] || TAG_COLOR_PALETTE.sky;
                  const count = tagUsageCounts[tag.id] || 0;
                  const isActiveFilter = !untaggedOnly && activeFilterTagIds.includes(tag.id);
                  const isEditing = editingTagId === tag.id;

                  if (isEditing) {
                    return (
                      <div
                        key={tag.id}
                        className="p-2.5 rounded-lg bg-slate-950 border border-sky-700/80 space-y-2"
                      >
                        <input
                          type="text"
                          value={editTagName}
                          onChange={e => setEditTagName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitEditingTag(tag.id);
                            if (e.key === 'Escape') setEditingTagId(null);
                          }}
                          autoFocus
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            {TAG_COLOR_KEYS.map(ck => (
                              <button
                                key={ck}
                                type="button"
                                onClick={() => setEditTagColor(ck)}
                                className={`w-4 h-4 rounded-sm border cursor-pointer ${
                                  editTagColor === ck ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                                }`}
                                style={{ backgroundColor: TAG_COLOR_PALETTE[ck].hex }}
                                title={TAG_COLOR_PALETTE[ck].label}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingTagId(null)}
                              className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200 rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => commitEditingTag(tag.id)}
                              className="px-2 py-0.5 text-[11px] bg-sky-600 hover:bg-sky-500 text-white rounded cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={tag.id}
                      className={`group flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
                        isActiveFilter
                          ? style.activeBtnClass
                          : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700 text-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleFilterTag(tag.id)}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                        title={`Filter fields by "${tag.name}"`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: style.hex }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">{tag.name}</div>
                          {tag.description && (
                            <div className="text-[10px] text-slate-400 truncate">
                              {tag.description}
                            </div>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] font-mono tabular-nums text-slate-400 px-1.5">
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditingTag(tag)}
                          className="p-1 text-slate-500 hover:text-slate-200 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                          title="Rename or recolor tag"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTag(tag.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                          title="Delete tag"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Suggested Presets */}
          {availableSuggestions.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-800/80">
              <div className="text-[11px] font-medium text-slate-400">
                Quick-Add Presets
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableSuggestions.map(preset => {
                  const style = TAG_COLOR_PALETTE[preset.color];
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => onCreateTag(preset.name, preset.color, preset.description)}
                      className="px-2 py-1 rounded-md bg-slate-950 border border-slate-800 hover:border-slate-600 text-[11px] text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      title={preset.description}
                    >
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{ backgroundColor: style.hex }}
                      />
                      <span>{preset.name}</span>
                      <Plus className="w-3 h-3 text-slate-500" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT COLUMN: TAGGABLE & FILTERABLE FIELD LIST */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Field List Filter & Search Header */}
        <div className="px-4 py-3 bg-slate-900/40 border-b border-slate-800 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={fieldSearch}
                  onChange={e => setFieldSearch(e.target.value)}
                  placeholder="Search fields by name, value, subform, or tag..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                />
                {fieldSearch && (
                  <button
                    type="button"
                    onClick={() => setFieldSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <select
                value={subformFilter}
                onChange={e => setSubformFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500 max-w-[190px] cursor-pointer"
              >
                <option value="all">All Subforms ({subformOptions.length})</option>
                {subformOptions.map(sfName => (
                  <option key={sfName} value={sfName}>
                    {sfName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              {activeFilterTagIds.length > 1 && !untaggedOnly && (
                <div className="flex items-center gap-1 p-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => onSetTagMatchMode('any')}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      tagMatchMode === 'any'
                        ? 'bg-slate-800 text-sky-300 font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Match Any
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetTagMatchMode('all')}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      tagMatchMode === 'all'
                        ? 'bg-slate-800 text-sky-300 font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Match All
                  </button>
                </div>
              )}

              <span className="font-mono tabular-nums text-[11px] text-slate-400">
                Showing <strong className="text-slate-200">{filteredFields.length}</strong> of{' '}
                {allFields.length}
              </span>
            </div>
          </div>

          {/* Bulk Tagging Action Bar (visible when rows selected) */}
          {selectedFieldIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-sky-950/50 border border-sky-800/70 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sky-200 tabular-nums">
                  {selectedFieldIds.size} {selectedFieldIds.size === 1 ? 'field' : 'fields'} selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFieldIds(new Set())}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {tagStore.definitions.length === 0 ? (
                  <span className="text-[11px] text-slate-400">
                    Create a tag on the left to bulk-apply it.
                  </span>
                ) : (
                  <>
                    <span className="text-[11px] text-slate-400">Apply tag:</span>
                    {tagStore.definitions.map(tag => {
                      const style = TAG_COLOR_PALETTE[tag.color] || TAG_COLOR_PALETTE.sky;
                      const allHaveTag = selectedIdsArray.every(id =>
                        (tagStore.assignments[id] || []).includes(tag.id)
                      );
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            if (allHaveTag) {
                              onBulkRemoveTag(selectedIdsArray, tag.id);
                            } else {
                              onBulkAssignTag(selectedIdsArray, tag.id);
                            }
                          }}
                          className={`px-2 py-0.5 rounded border text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                            allHaveTag
                              ? style.activeBtnClass
                              : 'bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-500'
                          }`}
                          title={
                            allHaveTag
                              ? `Remove "${tag.name}" from all selected fields`
                              : `Apply "${tag.name}" to all selected fields`
                          }
                        >
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: style.hex }}
                          />
                          <span>{tag.name}</span>
                          {allHaveTag ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Plus className="w-3 h-3 opacity-70" />
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Table Header Row */}
        <div className="px-4 py-2 bg-slate-900/70 border-b border-slate-800 flex items-center gap-3 text-[11px] font-medium text-slate-400 shrink-0">
          <button
            type="button"
            onClick={toggleSelectAllVisible}
            className="text-slate-400 hover:text-slate-200 cursor-pointer shrink-0"
            title={allVisibleSelected ? 'Deselect visible fields' : 'Select all visible fields'}
          >
            {allVisibleSelected ? (
              <CheckSquare className="w-4 h-4 text-sky-400" />
            ) : someVisibleSelected ? (
              <MinusSquare className="w-4 h-4 text-sky-400" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
          <div className="flex-1 min-w-0">Field &amp; Subform</div>
          <div className="w-56 hidden md:block">Assigned Tags</div>
          <div className="w-28 text-right shrink-0">Navigate</div>
        </div>

        {/* Scrollable Field Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70">
          {filteredFields.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-2">
              <Filter className="w-6 h-6 text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-300">No fields match your active filters</p>
              <p className="text-xs text-slate-500">
                Try clearing a tag filter, changing match mode, or adjusting your search query.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFieldSearch('');
                  setSubformFilter('all');
                  onClearTagFilters();
                }}
                className="mt-2 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredFields.map(field => {
              const isSelected = selectedFieldIds.has(field.id);
              const assignedTags = getFieldTagDefinitions(tagStore, field.id);
              const assignedIds = new Set(assignedTags.map(t => t.id));
              const isPickerOpen = openPickerFieldId === field.id;

              return (
                <div
                  key={field.id}
                  className={`px-4 py-2.5 transition-colors ${
                    isSelected ? 'bg-sky-950/25' : 'hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-start md:items-center gap-3">
                    {/* Row Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleSelectField(field.id)}
                      className="mt-0.5 md:mt-0 text-slate-500 hover:text-slate-200 cursor-pointer shrink-0"
                      aria-label={`Select ${field.caption || field.name}`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    {/* Field Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-100 truncate">
                          {field.caption || field.name}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono shrink-0">
                          {field.type}
                        </span>
                        {field.bounds?.pageNumber && (
                          <span className="text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
                            · P.{field.bounds.pageNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 truncate">
                        <span className="font-mono text-slate-500 truncate">{field.name}</span>
                        {field.parentSubform && (
                          <>
                            <span aria-hidden="true" className="text-slate-700">·</span>
                            <span className="truncate">{field.parentSubform}</span>
                          </>
                        )}
                        {field.value && (
                          <>
                            <span aria-hidden="true" className="text-slate-700">·</span>
                            <span className="font-mono text-sky-400/90 truncate max-w-[160px]">
                              {field.value}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Mobile tag list */}
                      <div className="flex md:hidden flex-wrap items-center gap-1.5 mt-2">
                        {assignedTags.map(tag => {
                          const style = TAG_COLOR_PALETTE[tag.color] || TAG_COLOR_PALETTE.sky;
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => onToggleFieldTag(field.id, tag.id)}
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-medium flex items-center gap-1 cursor-pointer ${style.chipClass}`}
                              title={`Remove "${tag.name}"`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-xs"
                                style={{ backgroundColor: style.hex }}
                              />
                              <span>{tag.name}</span>
                              <X className="w-2.5 h-2.5 opacity-75" />
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            setOpenPickerFieldId(isPickerOpen ? null : field.id);
                            setInlineQuickTagInput('');
                          }}
                          className="px-1.5 py-0.5 rounded border border-slate-700 hover:border-sky-600 text-[10px] text-slate-300 hover:text-sky-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Tag</span>
                        </button>
                      </div>
                    </div>

                    {/* Desktop Assigned Tags Column */}
                    <div className="hidden md:flex w-56 flex-wrap items-center gap-1.5 shrink-0">
                      {assignedTags.map(tag => {
                        const style = TAG_COLOR_PALETTE[tag.color] || TAG_COLOR_PALETTE.sky;
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => onToggleFieldTag(field.id, tag.id)}
                            className={`px-1.5 py-0.5 rounded border text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer max-w-[140px] ${style.chipClass}`}
                            title={`Click to remove "${tag.name}"`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-xs shrink-0"
                              style={{ backgroundColor: style.hex }}
                            />
                            <span className="truncate">{tag.name}</span>
                            <X className="w-2.5 h-2.5 opacity-70 hover:opacity-100 shrink-0" />
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => {
                          setOpenPickerFieldId(isPickerOpen ? null : field.id);
                          setInlineQuickTagInput('');
                        }}
                        className={`px-1.5 py-0.5 rounded border text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                          isPickerOpen
                            ? 'bg-sky-950 border-sky-600 text-sky-200'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-600 text-slate-400 hover:text-slate-200'
                        }`}
                        title="Apply or create tags for this field"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{assignedTags.length === 0 ? 'Add tag' : ''}</span>
                      </button>
                    </div>

                    {/* Navigation Actions */}
                    <div className="w-28 flex items-center justify-end gap-1 shrink-0">
                      {onInspectInGraph && (
                        <button
                          type="button"
                          onClick={() => onInspectInGraph(field.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Inspect field in Dependency Graph"
                        >
                          <Network className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onNavigateToFormEditor && (
                        <button
                          type="button"
                          onClick={() => onNavigateToFormEditor(field.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit in Visual Form Editor"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onNavigateToField && (
                        <button
                          type="button"
                          onClick={() => onNavigateToField(field.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Locate on PDF Canvas"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Quick Tag Picker Drawer for this Row */}
                  {isPickerOpen && (
                    <div className="mt-2.5 ml-7 p-2.5 rounded-lg bg-slate-900 border border-slate-700/80 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-slate-300">
                          Toggle tags for {field.caption || field.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpenPickerFieldId(null)}
                          className="text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {tagStore.definitions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {tagStore.definitions.map(tag => {
                            const style = TAG_COLOR_PALETTE[tag.color] || TAG_COLOR_PALETTE.sky;
                            const isAssigned = assignedIds.has(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => onToggleFieldTag(field.id, tag.id)}
                                className={`px-2 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                                  isAssigned ? style.activeBtnClass : style.inactiveBtnClass
                                }`}
                              >
                                <span
                                  className="w-2 h-2 rounded-xs shrink-0"
                                  style={{ backgroundColor: style.hex }}
                                />
                                <span>{tag.name}</span>
                                {isAssigned && <Check className="w-3 h-3" />}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          value={inlineQuickTagInput}
                          onChange={e => setInlineQuickTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleQuickCreateAndAssign(field.id);
                            }
                          }}
                          placeholder="Type new tag name and press Enter..."
                          className="flex-1 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-md px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickCreateAndAssign(field.id)}
                          disabled={!inlineQuickTagInput.trim()}
                          className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Create &amp; Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
