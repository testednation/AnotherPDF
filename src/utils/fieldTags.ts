export type TagColorKey =
  | 'sky'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'teal'
  | 'slate';

export interface FieldTagDefinition {
  id: string;
  name: string;
  color: TagColorKey;
  description?: string;
  createdAt: string;
}

export interface FieldTagStore {
  definitions: FieldTagDefinition[];
  /** Maps fieldId -> array of assigned tag IDs */
  assignments: Record<string, string[]>;
}

export type TagMatchMode = 'any' | 'all';

export interface TagColorStyle {
  key: TagColorKey;
  label: string;
  hex: string;
  dotClass: string;
  textClass: string;
  activeBtnClass: string;
  inactiveBtnClass: string;
  chipClass: string;
}

export const TAG_COLOR_PALETTE: Record<TagColorKey, TagColorStyle> = {
  sky: {
    key: 'sky',
    label: 'Sky',
    hex: '#38bdf8',
    dotClass: 'bg-sky-400',
    textClass: 'text-sky-300',
    activeBtnClass: 'bg-sky-950/90 border-sky-500/80 text-sky-200',
    inactiveBtnClass: 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-sky-700/70 hover:text-sky-200',
    chipClass: 'bg-sky-950/70 border-sky-800/80 text-sky-200',
  },
  emerald: {
    key: 'emerald',
    label: 'Emerald',
    hex: '#34d399',
    dotClass: 'bg-emerald-400',
    textClass: 'text-emerald-300',
    activeBtnClass: 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200',
    inactiveBtnClass: 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-emerald-700/70 hover:text-emerald-200',
    chipClass: 'bg-emerald-950/70 border-emerald-800/80 text-emerald-200',
  },
  amber: {
    key: 'amber',
    label: 'Amber',
    hex: '#fbbf24',
    dotClass: 'bg-amber-400',
    textClass: 'text-amber-300',
    activeBtnClass: 'bg-amber-950/90 border-amber-500/80 text-amber-200',
    inactiveBtnClass: 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-amber-700/70 hover:text-amber-200',
    chipClass: 'bg-amber-950/70 border-amber-800/80 text-amber-200',
  },
  rose: {
    key: 'rose',
    label: 'Rose',
    hex: '#fb7185',
    dotClass: 'bg-rose-400',
    textClass: 'text-rose-300',
    activeBtnClass: 'bg-rose-950/90 border-rose-500/80 text-rose-200',
    inactiveBtnClass: 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-rose-700/70 hover:text-rose-200',
    chipClass: 'bg-rose-950/70 border-rose-800/80 text-rose-200',
  },
  violet: {
    key: 'violet',
    label: 'Violet',
    hex: '#a78bfa',
    dotClass: 'bg-violet-400',
    textClass: 'text-violet-300',
    activeBtnClass: 'bg-violet-950/90 border-violet-500/80 text-violet-200',
    inactiveBtnClass: 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-violet-700/70 hover:text-violet-200',
    chipClass: 'bg-violet-950/70 border-violet-800/80 text-violet-200',
  },
  teal: {
    key: 'teal',
    label: 'Teal',
    hex: '#2dd4bf',
    dotClass: 'bg-teal-400',
    textClass: 'text-teal-300',
    activeBtnClass: 'bg-teal-950/90 border-teal-500/80 text-teal-200',
    inactiveBtnClass: 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-teal-700/70 hover:text-teal-200',
    chipClass: 'bg-teal-950/70 border-teal-800/80 text-teal-200',
  },
  slate: {
    key: 'slate',
    label: 'Slate',
    hex: '#94a3b8',
    dotClass: 'bg-slate-400',
    textClass: 'text-slate-300',
    activeBtnClass: 'bg-slate-800 border-slate-500 text-slate-100',
    inactiveBtnClass: 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200',
    chipClass: 'bg-slate-900 border-slate-700 text-slate-300',
  },
};

export const TAG_COLOR_KEYS: TagColorKey[] = [
  'sky',
  'emerald',
  'amber',
  'rose',
  'violet',
  'teal',
  'slate',
];

export interface SuggestedFieldTag {
  name: string;
  color: TagColorKey;
  description: string;
}

export const SUGGESTED_FIELD_TAGS: SuggestedFieldTag[] = [
  {
    name: 'Financial',
    color: 'emerald',
    description: 'Revenue, expenses, totals, and monetary reporting figures',
  },
  {
    name: 'PII / Sensitive',
    color: 'rose',
    description: 'Personal identifiers, tax IDs, contact details, or restricted data',
  },
  {
    name: 'Needs Review',
    color: 'amber',
    description: 'Fields flagged for manual verification before submission',
  },
  {
    name: 'Legal / Sign-off',
    color: 'violet',
    description: 'Attestations, signatures, officer titles, and filing dates',
  },
  {
    name: 'Required Filing',
    color: 'sky',
    description: 'Mandatory fields required for compliant submission',
  },
  {
    name: 'Tax / Compliance',
    color: 'teal',
    description: 'Regulatory codes, fiscal periods, and audit references',
  },
];

export const EMPTY_FIELD_TAG_STORE: FieldTagStore = {
  definitions: [],
  assignments: {},
};

const STORAGE_PREFIX = 'acroxfa_field_tags_v1::';

export function getTagStorageKey(docKey: string): string {
  const normalized = (docKey || 'default').trim().toLowerCase();
  return `${STORAGE_PREFIX}${normalized}`;
}

export function loadFieldTagStore(docKey: string): FieldTagStore {
  if (typeof window === 'undefined') return EMPTY_FIELD_TAG_STORE;
  try {
    const raw = window.localStorage.getItem(getTagStorageKey(docKey));
    if (!raw) return EMPTY_FIELD_TAG_STORE;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.definitions) || typeof parsed.assignments !== 'object') {
      return EMPTY_FIELD_TAG_STORE;
    }
    const validDefIds = new Set<string>();
    const definitions: FieldTagDefinition[] = parsed.definitions
      .filter((d: any) => d && typeof d.id === 'string' && typeof d.name === 'string' && d.name.trim())
      .map((d: any) => {
        const color: TagColorKey = TAG_COLOR_KEYS.includes(d.color) ? d.color : 'sky';
        validDefIds.add(d.id);
        return {
          id: d.id,
          name: d.name.trim(),
          color,
          description: typeof d.description === 'string' ? d.description.trim() : undefined,
          createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date().toISOString(),
        };
      });

    const assignments: Record<string, string[]> = {};
    Object.entries(parsed.assignments || {}).forEach(([fieldId, tagIds]) => {
      if (Array.isArray(tagIds)) {
        const cleaned = Array.from(
          new Set(tagIds.filter((id): id is string => typeof id === 'string' && validDefIds.has(id)))
        );
        if (cleaned.length > 0) {
          assignments[fieldId] = cleaned;
        }
      }
    });

    return { definitions, assignments };
  } catch {
    return EMPTY_FIELD_TAG_STORE;
  }
}

export function saveFieldTagStore(docKey: string, store: FieldTagStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getTagStorageKey(docKey), JSON.stringify(store));
  } catch {
    // Ignore storage quota issues cleanly
  }
}

export function createTagId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  const rand = Math.random().toString(36).slice(2, 7);
  return `tag_${slug || 'custom'}_${rand}`;
}

export function getFieldTagDefinitions(
  store: FieldTagStore | undefined,
  fieldId: string
): FieldTagDefinition[] {
  if (!store) return [];
  const ids = store.assignments[fieldId];
  if (!ids || ids.length === 0) return [];
  const defMap = new Map(store.definitions.map(d => [d.id, d]));
  return ids.map(id => defMap.get(id)).filter((d): d is FieldTagDefinition => Boolean(d));
}

export function getTagUsageCounts(
  store: FieldTagStore | undefined,
  validFieldIds?: Set<string>
): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!store) return counts;
  store.definitions.forEach(d => {
    counts[d.id] = 0;
  });
  Object.entries(store.assignments).forEach(([fieldId, tagIds]) => {
    if (validFieldIds && !validFieldIds.has(fieldId)) return;
    tagIds.forEach(tagId => {
      if (counts[tagId] !== undefined) {
        counts[tagId] += 1;
      }
    });
  });
  return counts;
}

export function matchesFieldTagFilter(
  store: FieldTagStore | undefined,
  fieldId: string,
  selectedTagIds: string[],
  matchMode: TagMatchMode = 'any',
  untaggedOnly = false
): boolean {
  const fieldTags = store?.assignments[fieldId] || [];
  if (untaggedOnly) {
    return fieldTags.length === 0;
  }
  if (selectedTagIds.length === 0) {
    return true;
  }
  if (fieldTags.length === 0) {
    return false;
  }
  if (matchMode === 'all') {
    return selectedTagIds.every(tagId => fieldTags.includes(tagId));
  }
  return selectedTagIds.some(tagId => fieldTags.includes(tagId));
}
