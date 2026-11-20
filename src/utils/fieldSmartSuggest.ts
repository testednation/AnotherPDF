import { XFAField } from '../types/pdf';
import { detectFieldDataType } from './validationEngine';

export type SmartEntityCategory =
  | 'organization'
  | 'person_name'
  | 'job_title'
  | 'email'
  | 'phone'
  | 'street_address'
  | 'city'
  | 'province_state'
  | 'postal_code'
  | 'country'
  | 'business_number'
  | 'fiscal_year'
  | 'date'
  | 'currency_amount'
  | 'project_title'
  | 'website'
  | 'bank_account'
  | 'notes_disclosure'
  | 'generic';

export type SuggestionSource = 'history' | 'document' | 'profile' | 'entity';

export interface SmartSuggestion {
  id: string;
  value: string;
  source: SuggestionSource;
  sourceLabel: string;
  detail?: string;
  category: SmartEntityCategory;
  score: number;
  historyEntryId?: string;
}

export interface LearnedPatternEntry {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  category: SmartEntityCategory;
  value: string;
  useCount: number;
  lastUsedAt: number;
}

export interface BusinessEntityProfile {
  id: string;
  name: string;
  industry: string;
  isCustom?: boolean;
  values: Partial<Record<SmartEntityCategory, string>>;
}

export interface SmartSuggestStore {
  entries: LearnedPatternEntry[];
  customProfiles: BusinessEntityProfile[];
  activeProfileId: string | null;
  enabled: boolean;
}

const STORAGE_KEY = 'acroxfa_field_smart_suggest_v1';
const MAX_LEARNED_ENTRIES = 160;

export const CATEGORY_LABELS: Record<SmartEntityCategory, string> = {
  organization: 'Organization',
  person_name: 'Contact / Signatory',
  job_title: 'Title / Role',
  email: 'Email Address',
  phone: 'Phone / Fax',
  street_address: 'Street Address',
  city: 'City',
  province_state: 'Province / State',
  postal_code: 'Postal / ZIP Code',
  country: 'Country',
  business_number: 'Business / Tax ID',
  fiscal_year: 'Fiscal Period',
  date: 'Date',
  currency_amount: 'Amount / Value',
  project_title: 'Project / Program',
  website: 'Website',
  bank_account: 'Banking / Account',
  notes_disclosure: 'Disclosure / Notes',
  generic: 'General Field',
};

export const BUILTIN_BUSINESS_PROFILES: BusinessEntityProfile[] = [
  {
    id: 'profile_northstar_publishing',
    name: 'Northstar Literary Press Inc.',
    industry: 'Publishing & Media',
    values: {
      organization: 'Northstar Literary Press Inc.',
      person_name: 'Claire Beaumont',
      job_title: 'Chief Financial Officer',
      email: 'finance@northstarpress.ca',
      phone: '(416) 555-0194',
      street_address: '240 Spadina Avenue, Suite 510',
      city: 'Toronto',
      province_state: 'Ontario',
      postal_code: 'M5T 2C2',
      country: 'Canada',
      business_number: '842910482 RC 0001',
      fiscal_year: '2025-2026',
      website: 'https://www.northstarpress.ca',
      project_title: 'Canadian Literary Translation & Print Expansion 2026',
    },
  },
  {
    id: 'profile_meridian_civic',
    name: 'Meridian Civic Research Foundation',
    industry: 'Non-Profit & Grants',
    values: {
      organization: 'Meridian Civic Research Foundation',
      person_name: 'Dr. Henri Tremblay',
      job_title: 'Executive Director',
      email: 'grants@meridiancivic.org',
      phone: '(613) 555-0148',
      street_address: '150 Elgin Street, Floor 8',
      city: 'Ottawa',
      province_state: 'Ontario',
      postal_code: 'K2P 1L4',
      country: 'Canada',
      business_number: '719402815 RR 0001',
      fiscal_year: '2026-2027',
      website: 'https://www.meridiancivic.org',
      project_title: 'National Community Archive Digitization Initiative',
    },
  },
  {
    id: 'profile_cascade_systems',
    name: 'Cascade Precision Systems Ltd.',
    industry: 'Enterprise Technology',
    values: {
      organization: 'Cascade Precision Systems Ltd.',
      person_name: 'Maya Patel',
      job_title: 'VP of Finance & Compliance',
      email: 'compliance@cascadesystems.com',
      phone: '(604) 555-0172',
      street_address: '1055 West Georgia Street, Suite 1400',
      city: 'Vancouver',
      province_state: 'British Columbia',
      postal_code: 'V6E 3P3',
      country: 'Canada',
      business_number: '883104927 RC 0001',
      fiscal_year: 'FY 2026',
      website: 'https://www.cascadesystems.com',
      project_title: 'Enterprise Regulatory Reporting Automation',
    },
  },
  {
    id: 'profile_atelier_nord',
    name: 'Éditions Atelier Nord Ltée',
    industry: 'Cultural & Bilingual Press',
    values: {
      organization: 'Éditions Atelier Nord Ltée',
      person_name: 'Marc-Antoine Lavoie',
      job_title: 'Directeur général',
      email: 'direction@ateliernord.qc.ca',
      phone: '(514) 555-0183',
      street_address: '4200 Boulevard Saint-Laurent, Bureau 302',
      city: 'Montréal',
      province_state: 'Québec',
      postal_code: 'H2W 2R2',
      country: 'Canada',
      business_number: '815294036 RC 0001',
      fiscal_year: '2025-2026',
      website: 'https://www.ateliernord.qc.ca',
      project_title: 'Collection Patrimoine & Distribution Numérique',
    },
  },
];

const COMMON_ENTITY_SUGGESTIONS: Record<SmartEntityCategory, Array<{ value: string; detail: string }>> = {
  organization: [
    { value: 'Northstar Literary Press Inc.', detail: 'Publishing corporation' },
    { value: 'Meridian Civic Research Foundation', detail: 'Registered non-profit' },
    { value: 'Cascade Precision Systems Ltd.', detail: 'Technology enterprise' },
    { value: 'Éditions Atelier Nord Ltée', detail: 'Bilingual publisher' },
    { value: 'Harbourview Cultural Cooperative', detail: 'Cooperative entity' },
    { value: 'Summit Advisory Partners LLP', detail: 'Limited liability partnership' },
  ],
  person_name: [
    { value: 'Claire Beaumont', detail: 'Authorized officer' },
    { value: 'Dr. Henri Tremblay', detail: 'Executive director' },
    { value: 'Maya Patel', detail: 'Finance officer' },
    { value: 'Marc-Antoine Lavoie', detail: 'Managing director' },
    { value: 'David Chen', detail: 'Senior controller' },
  ],
  job_title: [
    { value: 'Chief Financial Officer', detail: 'Executive finance' },
    { value: 'Executive Director', detail: 'Non-profit leadership' },
    { value: 'Managing Director', detail: 'Corporate officer' },
    { value: 'VP of Finance & Operations', detail: 'Finance operations' },
    { value: 'Director of Publishing', detail: 'Editorial leadership' },
    { value: 'Authorized Signing Officer', detail: 'Compliance signatory' },
    { value: 'Controller', detail: 'Accounting officer' },
  ],
  email: [
    { value: 'finance@northstarpress.ca', detail: 'Corporate finance' },
    { value: 'grants@meridiancivic.org', detail: 'Grants & reporting' },
    { value: 'compliance@cascadesystems.com', detail: 'Regulatory desk' },
    { value: 'accounting@company.ca', detail: 'Accounts department' },
  ],
  phone: [
    { value: '(416) 555-0194', detail: 'Toronto office' },
    { value: '(613) 555-0148', detail: 'Ottawa office' },
    { value: '(514) 555-0183', detail: 'Montréal office' },
    { value: '(604) 555-0172', detail: 'Vancouver office' },
    { value: '1-800-555-0199', detail: 'Toll-free line' },
  ],
  street_address: [
    { value: '240 Spadina Avenue, Suite 510', detail: 'Toronto commercial' },
    { value: '150 Elgin Street, Floor 8', detail: 'Ottawa downtown' },
    { value: '4200 Boulevard Saint-Laurent, Bureau 302', detail: 'Montréal commercial' },
    { value: '1055 West Georgia Street, Suite 1400', detail: 'Vancouver tower' },
  ],
  city: [
    { value: 'Toronto', detail: 'Ontario' },
    { value: 'Ottawa', detail: 'Ontario' },
    { value: 'Montréal', detail: 'Québec' },
    { value: 'Vancouver', detail: 'British Columbia' },
    { value: 'Calgary', detail: 'Alberta' },
    { value: 'Halifax', detail: 'Nova Scotia' },
    { value: 'Winnipeg', detail: 'Manitoba' },
    { value: 'Québec City', detail: 'Québec' },
  ],
  province_state: [
    { value: 'Ontario', detail: 'ON' },
    { value: 'Québec', detail: 'QC' },
    { value: 'British Columbia', detail: 'BC' },
    { value: 'Alberta', detail: 'AB' },
    { value: 'Nova Scotia', detail: 'NS' },
    { value: 'Manitoba', detail: 'MB' },
    { value: 'Saskatchewan', detail: 'SK' },
    { value: 'New Brunswick', detail: 'NB' },
  ],
  postal_code: [
    { value: 'M5T 2C2', detail: 'Toronto, ON' },
    { value: 'K2P 1L4', detail: 'Ottawa, ON' },
    { value: 'H2W 2R2', detail: 'Montréal, QC' },
    { value: 'V6E 3P3', detail: 'Vancouver, BC' },
    { value: 'T2P 2Y5', detail: 'Calgary, AB' },
    { value: 'B3J 2K9', detail: 'Halifax, NS' },
  ],
  country: [
    { value: 'Canada', detail: 'CA' },
    { value: 'United States', detail: 'US' },
    { value: 'United Kingdom', detail: 'UK' },
    { value: 'France', detail: 'FR' },
  ],
  business_number: [
    { value: '842910482 RC 0001', detail: 'CRA Corporate BN' },
    { value: '719402815 RR 0001', detail: 'CRA Charity / NPO BN' },
    { value: '883104927 RC 0001', detail: 'CRA Operating BN' },
    { value: '12-3456789', detail: 'US Federal EIN format' },
  ],
  fiscal_year: [
    { value: '2025-2026', detail: 'Current fiscal cycle' },
    { value: '2026-2027', detail: 'Upcoming fiscal cycle' },
    { value: '2024-2025', detail: 'Prior fiscal cycle' },
    { value: 'FY 2026', detail: 'Calendar fiscal year' },
    { value: 'Q4 2026', detail: 'Quarterly period' },
  ],
  date: [],
  currency_amount: [
    { value: '5000.00', detail: 'Standard tier' },
    { value: '12500.00', detail: 'Quarterly tranche' },
    { value: '25000.00', detail: 'Program allocation' },
    { value: '50000.00', detail: 'Annual grant ceiling' },
    { value: '125000.00', detail: 'Operating budget' },
  ],
  project_title: [
    { value: 'Canadian Literary Translation & Print Expansion 2026', detail: 'Publishing project' },
    { value: 'National Community Archive Digitization Initiative', detail: 'Heritage & digital' },
    { value: 'Accessible eBook & Audiobook Production Program', detail: 'Accessibility track' },
    { value: 'Regional Distribution & Marketing Modernization', detail: 'Supply chain program' },
  ],
  website: [
    { value: 'https://www.northstarpress.ca', detail: 'Publisher portal' },
    { value: 'https://www.meridiancivic.org', detail: 'Foundation site' },
    { value: 'https://www.cascadesystems.com', detail: 'Corporate site' },
  ],
  bank_account: [
    { value: 'Direct Deposit / EFT', detail: 'Standard disbursement' },
    { value: '003-01242-1048291', detail: 'Inst-Transit-Account' },
  ],
  notes_disclosure: [
    {
      value: 'All reported revenues and eligible project expenditures have been reconciled against audited financial statements for the reporting period.',
      detail: 'Financial reconciliation',
    },
    {
      value: 'No material variances or undisclosed third-party contributions occurred during this fiscal reporting cycle.',
      detail: 'Nil variance disclosure',
    },
    {
      value: 'Supporting invoices, payroll ledgers, and disbursement records are retained on file for six (6) years per program terms.',
      detail: 'Audit retention clause',
    },
  ],
  generic: [],
};

export function normalizeFieldKey(field: Pick<XFAField, 'name' | 'dataRef' | 'caption'>): string {
  const base = (field.dataRef || field.name || field.caption || 'field')
    .toLowerCase()
    .replace(/\[\d+\]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'field';
}

export function classifyFieldEntityCategory(field: XFAField): SmartEntityCategory {
  const dataType = detectFieldDataType(field).type;
  const hay = `${field.name} ${field.caption} ${field.dataRef || ''} ${field.tooltip || ''}`.toLowerCase();

  if (field.type === 'multiline' || hay.includes('note') || hay.includes('comment') || hay.includes('disclos') || hay.includes('explanation') || hay.includes('summary') || hay.includes('description')) {
    return 'notes_disclosure';
  }
  if (dataType === 'email' || hay.includes('email') || hay.includes('e-mail') || hay.includes('courriel')) {
    return 'email';
  }
  if (dataType === 'phone' || hay.includes('phone') || hay.includes('tel') || hay.includes('fax') || hay.includes('mobile')) {
    return 'phone';
  }
  if (dataType === 'postal_code' || hay.includes('postal') || hay.includes('zip')) {
    return 'postal_code';
  }
  if (dataType === 'cra_bn' || hay.includes('business_num') || hay.includes('business number') || hay.includes('cra') || hay.includes('bn') || hay.includes('tax_id') || hay.includes('tax id') || hay.includes('ein') || hay.includes('registry_id') || hay.includes('registration')) {
    return 'business_number';
  }
  if (hay.includes('website') || hay.includes('url') || hay.includes('web_site') || hay.includes('domain')) {
    return 'website';
  }
  if (hay.includes('fiscal') || hay.includes('reporting_period') || hay.includes('reporting period') || hay.includes('tax_year')) {
    return 'fiscal_year';
  }
  if (dataType === 'date' || field.type === 'date') {
    return 'date';
  }
  if (hay.includes('bank') || hay.includes('transit') || hay.includes('routing') || hay.includes('iban') || hay.includes('eft') || hay.includes('disbursement')) {
    return 'bank_account';
  }
  if (hay.includes('project') || hay.includes('program_name') || hay.includes('initiative') || (hay.includes('title') && !hay.includes('job') && !hay.includes('role') && !hay.includes('officer') && !hay.includes('position') && !hay.includes('contact'))) {
    return 'project_title';
  }
  if (hay.includes('job') || hay.includes('position') || hay.includes('role') || hay.includes('officer_title') || hay.includes('signatory_title') || hay.includes('title_of')) {
    return 'job_title';
  }
  if (field.type === 'signature' || hay.includes('sign') || hay.includes('officer') || hay.includes('contact_name') || hay.includes('contact person') || hay.includes('full_name') || hay.includes('applicant_name') || hay.includes('director') || hay.includes('preparer') || hay.includes('representative')) {
    return 'person_name';
  }
  if (hay.includes('org') || hay.includes('company') || hay.includes('corporation') || hay.includes('publisher') || hay.includes('recipient') || hay.includes('entity') || hay.includes('legal_name') || hay.includes('legal name') || hay.includes('firm') || hay.includes('employer') || hay.includes('applicant')) {
    return 'organization';
  }
  if (hay.includes('street') || hay.includes('address') || hay.includes('mailing') || hay.includes('suite') || hay.includes('pobox')) {
    return 'street_address';
  }
  if (hay.includes('city') || hay.includes('municipality') || hay.includes('town') || hay.includes('ville')) {
    return 'city';
  }
  if (hay.includes('province') || hay.includes('state') || hay.includes('territory') || hay.includes('jurisdiction') || hay.includes('region')) {
    return 'province_state';
  }
  if (hay.includes('country') || hay.includes('nation') || hay.includes('pays')) {
    return 'country';
  }
  if (dataType === 'numeric' || field.type === 'numeric') {
    return 'currency_amount';
  }

  return 'generic';
}

function getDynamicDateSuggestions(): Array<{ value: string; detail: string }> {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const year = now.getFullYear();

  return [
    { value: iso(now), detail: 'Today' },
    { value: `${year}-03-31`, detail: 'Fiscal year-end (Mar 31)' },
    { value: `${year}-04-01`, detail: 'Fiscal year-start (Apr 1)' },
    { value: `${year}-12-31`, detail: 'Calendar year-end (Dec 31)' },
    { value: `${year}-01-01`, detail: 'Calendar year-start (Jan 1)' },
  ];
}

function slugifyDomain(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/\b(inc|ltd|ltée|ltee|corp|corporation|llc|llp|co|company|foundation|group)\b/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
  return cleaned.length >= 3 ? cleaned.slice(0, 24) : '';
}

function buildSmartDateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function loadSmartSuggestStore(): SmartSuggestStore {
  const fallback: SmartSuggestStore = {
    entries: [],
    customProfiles: [],
    activeProfileId: BUILTIN_BUSINESS_PROFILES[0].id,
    enabled: true,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SmartSuggestStore>;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      customProfiles: Array.isArray(parsed.customProfiles) ? parsed.customProfiles : [],
      activeProfileId:
        parsed.activeProfileId !== undefined ? parsed.activeProfileId : fallback.activeProfileId,
      enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : true,
    };
  } catch {
    return fallback;
  }
}

export function saveSmartSuggestStore(store: SmartSuggestStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function recordLearnedFieldValue(
  store: SmartSuggestStore,
  field: XFAField,
  rawValue: string
): SmartSuggestStore {
  const value = rawValue.trim();
  if (!value || value.length < 2 || value === '0' || value === '0.00') {
    return store;
  }
  if (field.type === 'check' || field.type === 'choice' || field.readOnly) {
    return store;
  }

  const fieldKey = normalizeFieldKey(field);
  const category = classifyFieldEntityCategory(field);
  const now = Date.now();
  const normalizedLower = value.toLowerCase();

  const existingIdx = store.entries.findIndex(
    e => e.fieldKey === fieldKey && e.value.toLowerCase() === normalizedLower
  );

  let nextEntries: LearnedPatternEntry[];
  if (existingIdx >= 0) {
    const existing = store.entries[existingIdx];
    const updated: LearnedPatternEntry = {
      ...existing,
      value,
      category,
      fieldLabel: field.caption || field.name,
      useCount: existing.useCount + 1,
      lastUsedAt: now,
    };
    nextEntries = [
      updated,
      ...store.entries.slice(0, existingIdx),
      ...store.entries.slice(existingIdx + 1),
    ];
  } else {
    const created: LearnedPatternEntry = {
      id: `hist_${now}_${Math.random().toString(36).slice(2, 7)}`,
      fieldKey,
      fieldLabel: field.caption || field.name,
      category,
      value,
      useCount: 1,
      lastUsedAt: now,
    };
    nextEntries = [created, ...store.entries].slice(0, MAX_LEARNED_ENTRIES);
  }

  return {
    ...store,
    entries: nextEntries,
  };
}

export function removeLearnedEntry(store: SmartSuggestStore, entryId: string): SmartSuggestStore {
  return {
    ...store,
    entries: store.entries.filter(e => e.id !== entryId),
  };
}

export function clearLearnedEntries(store: SmartSuggestStore): SmartSuggestStore {
  return {
    ...store,
    entries: [],
  };
}

export function createCustomProfileFromFields(
  name: string,
  allFields: XFAField[]
): BusinessEntityProfile | null {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  const values: Partial<Record<SmartEntityCategory, string>> = {};
  const profileCategories: SmartEntityCategory[] = [
    'organization',
    'person_name',
    'job_title',
    'email',
    'phone',
    'street_address',
    'city',
    'province_state',
    'postal_code',
    'country',
    'business_number',
    'fiscal_year',
    'website',
    'project_title',
  ];

  allFields.forEach(f => {
    const val = (f.value || '').trim();
    if (!val || val === '0' || val === '0.00') return;
    const cat = classifyFieldEntityCategory(f);
    if (profileCategories.includes(cat) && !values[cat]) {
      values[cat] = val;
    }
  });

  if (!values.organization) {
    values.organization = trimmedName;
  }

  return {
    id: `custom_profile_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: trimmedName,
    industry: 'Saved Entity Profile',
    isCustom: true,
    values,
  };
}

export function getAllBusinessProfiles(store: SmartSuggestStore): BusinessEntityProfile[] {
  return [...store.customProfiles, ...BUILTIN_BUSINESS_PROFILES];
}

function matchRank(candidate: string, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const c = candidate.toLowerCase();
  if (c === q) return 0; // Already exact match; suppress redundant suggestion
  if (c.startsWith(q)) return 40;
  // Word-boundary match
  const words = c.split(/[\s\-_.,/@()]+/);
  if (words.some(w => w.startsWith(q))) return 25;
  if (c.includes(q)) return 12;
  return -1;
}

export function getSmartSuggestionsForField(
  field: XFAField,
  query: string,
  allFields: XFAField[],
  store: SmartSuggestStore,
  maxResults = 7
): SmartSuggestion[] {
  if (field.readOnly || field.type === 'check' || field.type === 'choice') {
    return [];
  }

  const category = classifyFieldEntityCategory(field);
  const fieldKey = normalizeFieldKey(field);
  const q = query.trim();
  const seen = new Set<string>();
  const candidates: SmartSuggestion[] = [];

  const addCandidate = (item: Omit<SmartSuggestion, 'score'>, baseScore: number) => {
    const cleaned = item.value.trim();
    if (!cleaned) return;
    const dedupeKey = cleaned.toLowerCase();
    if (seen.has(dedupeKey)) return;

    const rank = matchRank(cleaned, q);
    if (rank <= 0) return;

    seen.add(dedupeKey);
    candidates.push({
      ...item,
      value: cleaned,
      score: baseScore + rank,
    });
  };

  // 1. Learned user history — exact field matches first, then same semantic category
  store.entries.forEach(entry => {
    const recencyBoost = Math.max(0, 12 - Math.floor((Date.now() - entry.lastUsedAt) / (1000 * 60 * 60 * 24)));
    const freqBoost = Math.min(18, entry.useCount * 4);
    if (entry.fieldKey === fieldKey) {
      addCandidate(
        {
          id: `hist_exact_${entry.id}`,
          value: entry.value,
          source: 'history',
          sourceLabel: entry.useCount > 1 ? `Saved · ${entry.useCount}×` : 'Saved pattern',
          detail: entry.fieldLabel,
          category: entry.category,
          historyEntryId: entry.id,
        },
        130 + freqBoost + recencyBoost
      );
    } else if (category !== 'generic' && entry.category === category) {
      addCandidate(
        {
          id: `hist_cat_${entry.id}`,
          value: entry.value,
          source: 'history',
          sourceLabel: entry.useCount > 1 ? `Recent · ${entry.useCount}×` : 'Recent entry',
          detail: entry.fieldLabel,
          category: entry.category,
          historyEntryId: entry.id,
        },
        105 + freqBoost + recencyBoost
      );
    }
  });

  // 2. Document-level cross-field pattern inference from sibling filled fields
  let detectedOrgName = '';
  let detectedPersonName = '';

  allFields.forEach(sibling => {
    const val = (sibling.value || '').trim();
    if (!val || val === '0' || val === '0.00') return;
    const sibCat = classifyFieldEntityCategory(sibling);
    if (sibCat === 'organization' && !detectedOrgName) detectedOrgName = val;
    if (sibCat === 'person_name' && !detectedPersonName) detectedPersonName = val;

    if (sibling.id !== field.id && category !== 'generic' && sibCat === category) {
      addCandidate(
        {
          id: `doc_sib_${sibling.id}`,
          value: val,
          source: 'document',
          sourceLabel: 'In this form',
          detail: sibling.caption || sibling.name,
          category,
        },
        118
      );
    }
  });

  // Contextual derived suggestions (e.g., email/website derived from entered organization & contact)
  if (category === 'email' && detectedOrgName) {
    const domain = slugifyDomain(detectedOrgName);
    if (domain) {
      if (detectedPersonName) {
        const parts = detectedPersonName
          .toLowerCase()
          .replace(/[^a-z\s-]/g, '')
          .trim()
          .split(/\s+/);
        if (parts.length >= 2) {
          addCandidate(
            {
              id: `doc_derived_email_person`,
              value: `${parts[0][0]}.${parts[parts.length - 1]}@${domain}.ca`,
              source: 'document',
              sourceLabel: 'Derived from form',
              detail: `${detectedPersonName} · ${detectedOrgName}`,
              category,
            },
            115
          );
        }
      }
      addCandidate(
        {
          id: `doc_derived_email_finance`,
          value: `finance@${domain}.ca`,
          source: 'document',
          sourceLabel: 'Derived from form',
          detail: detectedOrgName,
          category,
        },
        112
      );
      addCandidate(
        {
          id: `doc_derived_email_info`,
          value: `info@${domain}.ca`,
          source: 'document',
          sourceLabel: 'Derived from form',
          detail: detectedOrgName,
          category,
        },
        108
      );
    }
  }

  if (category === 'website' && detectedOrgName) {
    const domain = slugifyDomain(detectedOrgName);
    if (domain) {
      addCandidate(
        {
          id: `doc_derived_web`,
          value: `https://www.${domain}.ca`,
          source: 'document',
          sourceLabel: 'Derived from form',
          detail: detectedOrgName,
          category,
        },
        114
      );
    }
  }

  // Dynamic numeric completion when user types a short number (e.g., "125" -> "125,000.00", "125.00")
  if (category === 'currency_amount' && /^\d{1,5}$/.test(q)) {
    const baseNum = parseInt(q, 10);
    if (!Number.isNaN(baseNum) && baseNum > 0) {
      addCandidate(
        {
          id: `num_fmt_exact`,
          value: `${baseNum}.00`,
          source: 'entity',
          sourceLabel: 'Format amount',
          detail: 'Two decimal places',
          category,
        },
        98
      );
      if (baseNum < 1000) {
        addCandidate(
          {
            id: `num_fmt_thousands`,
            value: `${(baseNum * 1000).toFixed(2)}`,
            source: 'entity',
            sourceLabel: 'Scale ×1,000',
            detail: `$${(baseNum * 1000).toLocaleString()}`,
            category,
          },
          94
        );
      }
    }
  }

  // 3. Active Business Entity Profile
  const allProfiles = getAllBusinessProfiles(store);
  const activeProfile = allProfiles.find(p => p.id === store.activeProfileId);
  if (activeProfile && activeProfile.values[category]) {
    addCandidate(
      {
        id: `prof_active_${activeProfile.id}_${category}`,
        value: activeProfile.values[category]!,
        source: 'profile',
        sourceLabel: activeProfile.isCustom ? 'Saved profile' : 'Active entity',
        detail: activeProfile.name,
        category,
      },
      102
    );
  }

  // 4. Other Business Entity Profiles & Common Entity Library
  allProfiles.forEach(profile => {
    if (profile.id === store.activeProfileId) return;
    const val = profile.values[category];
    if (val) {
      addCandidate(
        {
          id: `prof_other_${profile.id}_${category}`,
          value: val,
          source: 'profile',
          sourceLabel: profile.isCustom ? 'Saved profile' : 'Entity preset',
          detail: profile.name,
          category,
        },
        82
      );
    }
  });

  const libraryItems =
    category === 'date'
      ? getDynamicDateSuggestions()
      : COMMON_ENTITY_SUGGESTIONS[category] || [];

  libraryItems.forEach((entry, idx) => {
    addCandidate(
      {
        id: `entity_${category}_${idx}`,
        value: entry.value,
        source: 'entity',
        sourceLabel: category === 'date' ? 'Quick date' : 'Business entity',
        detail: entry.detail,
        category,
      },
      70 - idx
    );
  });

  // Fallback: if generic field and user typed something, check all learned entries as cross-field fallback
  if (category === 'generic' && q.length >= 1) {
    store.entries.forEach(entry => {
      addCandidate(
        {
          id: `hist_any_${entry.id}`,
          value: entry.value,
          source: 'history',
          sourceLabel: 'Saved pattern',
          detail: entry.fieldLabel,
          category: entry.category,
          historyEntryId: entry.id,
        },
        65
      );
    });
  }

  // For date fields with today helper fallback
  if (category === 'date' && candidates.length === 0) {
    addCandidate(
      {
        id: 'date_today_fallback',
        value: buildSmartDateIso(new Date()),
        source: 'entity',
        sourceLabel: 'Today',
        detail: 'ISO 8601',
        category,
      },
      75
    );
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

/**
 * Computes inline ghost completion suffix if the top suggestion is a clean prefix match
 * for what the user has currently typed.
 */
export function getInlineGhostSuffix(currentValue: string, suggestions: SmartSuggestion[]): string {
  if (!currentValue || currentValue.length < 1 || suggestions.length === 0) return '';
  const lowerCurrent = currentValue.toLowerCase();
  const prefixMatch = suggestions.find(s => s.value.toLowerCase().startsWith(lowerCurrent) && s.value.length > currentValue.length);
  if (!prefixMatch) return '';
  return prefixMatch.value.slice(currentValue.length);
}
