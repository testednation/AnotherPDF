import { PDFDocument, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } from 'pdf-lib';
import { XFAField, XFASubform } from '../types/pdf';
import { extractXfaPackets, parseXfaTemplate } from './xfaEngine';

export interface DiffDocumentSummary {
  filename: string;
  fileSizeBytes: number;
  pageCount: number;
  hasXfa: boolean;
  sourceKind: 'xfa' | 'acroform' | 'live_session' | 'synthetic_demo';
  fields: XFAField[];
  subforms: XFASubform[];
  filledCount: number;
  loadedAtIso: string;
}

export type FieldDiffStatus = 'unchanged' | 'modified' | 'added' | 'removed';

export interface InlineDiffToken {
  text: string;
  type: 'equal' | 'removed' | 'added';
}

export interface FieldDiffEntry {
  id: string;
  matchKey: string;
  name: string;
  caption: string;
  subform: string;
  fieldType: XFAField['type'];
  status: FieldDiffStatus;
  presence: 'both' | 'only_a' | 'only_b';
  valueA: string;
  valueB: string;
  fieldA?: XFAField;
  fieldB?: XFAField;
  tokensA: InlineDiffToken[];
  tokensB: InlineDiffToken[];
  numericDelta?: number;
  numericPercentChange?: number;
  attributeChanges: string[];
}

export interface FieldDiffOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

export interface FieldDiffResult {
  entries: FieldDiffEntry[];
  subformNames: string[];
  stats: {
    totalCompared: number;
    identicalCount: number;
    modifiedCount: number;
    addedCount: number;
    removedCount: number;
    discrepancyCount: number;
    similarityPercent: number;
  };
}

function flattenSubformFields(subforms: XFASubform[]): XFAField[] {
  const result: XFAField[] = [];
  const walk = (list: XFASubform[]) => {
    for (const sf of list) {
      result.push(...sf.fields);
      if (sf.subforms && sf.subforms.length > 0) {
        walk(sf.subforms);
      }
    }
  };
  walk(subforms);
  return result;
}

function isFieldFilled(field: XFAField): boolean {
  const raw = (field.value || '').trim();
  if (!raw) return false;
  if (field.type === 'check') {
    const lower = raw.toLowerCase();
    return lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on';
  }
  return true;
}

/**
 * Extracts standard AcroForm fields from a PDFDocument as XFAField fallback
 * when comparing a standard/converted PDF against an XFA PDF.
 */
function extractAcroFormFallbackFields(pdfDoc: PDFDocument): XFAField[] {
  const fields: XFAField[] = [];
  try {
    const form = pdfDoc.getForm();
    const acroFields = form.getFields();
    acroFields.forEach((af, idx) => {
      const name = af.getName() || `field_${idx + 1}`;
      let value = '';
      let type: XFAField['type'] = 'text';
      let options: string[] | undefined;

      try {
        if (af instanceof PDFTextField) {
          value = af.getText() || '';
          type = af.isMultiline() ? 'multiline' : 'text';
        } else if (af instanceof PDFCheckBox) {
          value = af.isChecked() ? '1' : '0';
          type = 'check';
        } else if (af instanceof PDFDropdown) {
          const sel = af.getSelected();
          value = Array.isArray(sel) ? sel.join(', ') : '';
          options = af.getOptions();
          type = 'choice';
        } else if (af instanceof PDFOptionList) {
          const sel = af.getSelected();
          value = Array.isArray(sel) ? sel.join(', ') : '';
          options = af.getOptions();
          type = 'choice';
        } else if (af instanceof PDFRadioGroup) {
          value = af.getSelected() || '';
          options = af.getOptions();
          type = 'choice';
        }
      } catch {
        // Ignore individual unreadable AcroForm field values
      }

      const cleanCaption = name
        .split(/[._]/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      fields.push({
        id: `acro_${idx}_${name}`,
        name,
        caption: cleanCaption || name,
        type,
        value,
        options,
        parentSubform: 'AcroForm Fields',
        readOnly: typeof af.isReadOnly === 'function' ? af.isReadOnly() : false,
        visibility: 'visible',
      });
    });
  } catch {
    // Document may not have an AcroForm catalog
  }
  return fields;
}

/**
 * Parses an uploaded or byte-buffer XFA PDF into a normalized DiffDocumentSummary.
 */
export async function parsePdfForFieldDiff(
  pdfBytes: Uint8Array,
  filename: string
): Promise<DiffDocumentSummary> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();
  const packets = await extractXfaPackets(pdfDoc, pdfBytes);

  let subforms: XFASubform[] = [];
  let fields: XFAField[] = [];
  let hasXfa = false;
  let sourceKind: DiffDocumentSummary['sourceKind'] = 'xfa';

  if (packets.templateXml) {
    hasXfa = true;
    subforms = parseXfaTemplate(packets.templateXml, packets.datasetsXml);
    fields = flattenSubformFields(subforms);
  }

  if (fields.length === 0) {
    const acroFields = extractAcroFormFallbackFields(pdfDoc);
    if (acroFields.length > 0) {
      fields = acroFields;
      sourceKind = 'acroform';
      subforms = [
        {
          id: 'sf_acroform',
          name: 'AcroForm',
          title: 'Standard AcroForm Fields',
          fields: acroFields,
          subforms: [],
        },
      ];
    }
  }

  const visibleFields = fields.filter(f => f.visibility !== 'hidden');

  return {
    filename,
    fileSizeBytes: pdfBytes.byteLength,
    pageCount,
    hasXfa,
    sourceKind,
    fields: visibleFields,
    subforms,
    filledCount: visibleFields.filter(isFieldFilled).length,
    loadedAtIso: new Date().toISOString(),
  };
}

/**
 * Wraps the currently open live form state (including unsaved edits) into a DiffDocumentSummary.
 */
export function buildDiffSummaryFromLiveSession(
  filename: string,
  pdfBytes: Uint8Array | null,
  fields: XFAField[],
  subforms: XFASubform[],
  hasXfa: boolean,
  pageCount = 1
): DiffDocumentSummary {
  const visibleFields = fields.filter(f => f.visibility !== 'hidden');
  return {
    filename,
    fileSizeBytes: pdfBytes?.byteLength || 0,
    pageCount,
    hasXfa,
    sourceKind: 'live_session',
    fields: visibleFields.map(f => ({ ...f })),
    subforms,
    filledCount: visibleFields.filter(isFieldFilled).length,
    loadedAtIso: new Date().toISOString(),
  };
}

/**
 * Builds a realistic revised copy of a document's fields for instant side-by-side diff preview/demo.
 */
export function buildSimulatedRevisionSummary(baseDoc: DiffDocumentSummary): DiffDocumentSummary {
  const baseName = baseDoc.filename.replace(/\.pdf$/i, '');
  const clonedFields: XFAField[] = baseDoc.fields.map(f => ({ ...f }));

  let modifiedQuota = 0;
  let clearedQuota = 0;
  let populatedQuota = 0;

  for (let i = 0; i < clonedFields.length; i++) {
    const f = clonedFields[i];
    const val = (f.value || '').trim();

    if (f.type === 'check' && modifiedQuota < 6) {
      f.value = val === '1' || val.toLowerCase() === 'true' ? '0' : '1';
      modifiedQuota++;
      continue;
    }

    if (val && modifiedQuota < 6) {
      const parsedNum = parseNumericValue(val);
      if (parsedNum !== null) {
        const delta = i % 2 === 0 ? Math.round(parsedNum * 0.14 + 250) : -Math.round(parsedNum * 0.08 + 100);
        const updated = Math.max(0, parsedNum + delta);
        const hasDollar = val.includes('$');
        f.value = hasDollar ? `$${updated.toLocaleString('en-US')}` : String(updated);
      } else if (f.type === 'date' || /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        f.value = '2026-12-15';
      } else {
        f.value = `${val} (Revised Q4)`;
      }
      modifiedQuota++;
    } else if (val && clearedQuota < 2 && i > 2) {
      f.value = '';
      clearedQuota++;
    } else if (!val && populatedQuota < 3) {
      if (f.type === 'numeric') {
        f.value = '48500';
      } else if (f.type === 'date') {
        f.value = '2026-11-19';
      } else if (f.type === 'choice' && f.options && f.options.length > 0) {
        f.value = f.options[0];
      } else {
        f.value = `Verified ${f.caption || f.name}`;
      }
      populatedQuota++;
    }
  }

  // Add one extra field unique to Doc B so "Only in B" is demonstrated
  clonedFields.push({
    id: 'diff_extra_audit_ref',
    name: 'AuditRevisionReference',
    caption: 'Revision Audit Reference',
    type: 'text',
    value: 'REV-2026-B042',
    parentSubform: clonedFields[0]?.parentSubform || 'Audit Metadata',
    visibility: 'visible',
  });

  return {
    filename: `${baseName}_v2_Revised.pdf`,
    fileSizeBytes: baseDoc.fileSizeBytes,
    pageCount: baseDoc.pageCount,
    hasXfa: baseDoc.hasXfa,
    sourceKind: 'synthetic_demo',
    fields: clonedFields,
    subforms: baseDoc.subforms,
    filledCount: clonedFields.filter(isFieldFilled).length,
    loadedAtIso: new Date().toISOString(),
  };
}

/**
 * Attempts to parse a formatted numeric/currency string into a finite number.
 */
export function parseNumericValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Must contain at least one digit and only numeric/currency formatting characters
  if (!/\d/.test(trimmed)) return null;
  if (!/^[$€£¥+\-(\s]*[\d,]+(?:\.\d+)?[\s)%]*$/.test(trimmed)) return null;

  const isAccountingNegative = trimmed.startsWith('(') && trimmed.endsWith(')');
  const cleaned = trimmed.replace(/[$€£¥,\s()%]/g, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return isAccountingNegative ? -Math.abs(parsed) : parsed;
}

function normalizeForComparison(val: string, options: FieldDiffOptions): string {
  let out = val;
  if (options.ignoreWhitespace) {
    out = out.trim().replace(/\s+/g, ' ');
  }
  if (options.ignoreCase) {
    out = out.toLowerCase();
  }
  return out;
}

function normalizeDisplayValue(field?: XFAField): string {
  if (!field) return '';
  const raw = field.value !== undefined && field.value !== null ? String(field.value) : '';
  if (field.type === 'check') {
    const lower = raw.trim().toLowerCase();
    if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on') return 'Checked (Yes)';
    if (lower === '0' || lower === 'false' || lower === 'no' || lower === 'off' || lower === '') {
      return 'Unchecked (No)';
    }
  }
  return raw;
}

/**
 * Computes word-level inline diff tokens between two strings using LCS.
 */
export function computeInlineDiffTokens(
  textA: string,
  textB: string
): { tokensA: InlineDiffToken[]; tokensB: InlineDiffToken[] } {
  if (textA === textB) {
    return {
      tokensA: textA ? [{ text: textA, type: 'equal' }] : [],
      tokensB: textB ? [{ text: textB, type: 'equal' }] : [],
    };
  }
  if (!textA) {
    return {
      tokensA: [],
      tokensB: [{ text: textB, type: 'added' }],
    };
  }
  if (!textB) {
    return {
      tokensA: [{ text: textA, type: 'removed' }],
      tokensB: [],
    };
  }

  // Split preserving whitespace so spacing stays exact
  const wordsA = textA.split(/(\s+)/).filter(Boolean);
  const wordsB = textB.split(/(\s+)/).filter(Boolean);

  // Guard LCS matrix size for very large paragraphs
  if (wordsA.length * wordsB.length > 40000) {
    return {
      tokensA: [{ text: textA, type: 'removed' }],
      tokensB: [{ text: textB, type: 'added' }],
    };
  }

  const m = wordsA.length;
  const n = wordsB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (wordsA[i] === wordsB[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const tokensA: InlineDiffToken[] = [];
  const tokensB: InlineDiffToken[] = [];

  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (wordsA[i] === wordsB[j]) {
      tokensA.push({ text: wordsA[i], type: 'equal' });
      tokensB.push({ text: wordsB[j], type: 'equal' });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokensA.push({ text: wordsA[i], type: 'removed' });
      i++;
    } else {
      tokensB.push({ text: wordsB[j], type: 'added' });
      j++;
    }
  }
  while (i < m) {
    tokensA.push({ text: wordsA[i], type: 'removed' });
    i++;
  }
  while (j < n) {
    tokensB.push({ text: wordsB[j], type: 'added' });
    j++;
  }

  // Merge adjacent tokens of the same type for clean rendering
  const merge = (list: InlineDiffToken[]): InlineDiffToken[] => {
    const out: InlineDiffToken[] = [];
    for (const tok of list) {
      const prev = out[out.length - 1];
      if (prev && prev.type === tok.type) {
        prev.text += tok.text;
      } else {
        out.push({ ...tok });
      }
    }
    return out;
  };

  return { tokensA: merge(tokensA), tokensB: merge(tokensB) };
}

function buildCanonicalFieldKey(field: XFAField, occurrenceIndex: number): string {
  const sub = (field.parentSubform || '').trim().toLowerCase();
  const ref = (field.dataRef || field.name || '').trim().toLowerCase();
  const base = sub ? `${sub}::${ref}` : ref;
  return occurrenceIndex > 0 ? `${base}#${occurrenceIndex}` : base;
}

/**
 * Compares two parsed XFA PDFs field-by-field and returns structured discrepancy results.
 */
export function compareXfaDocuments(
  docA: DiffDocumentSummary,
  docB: DiffDocumentSummary,
  options: FieldDiffOptions = {}
): FieldDiffResult {
  const mapA = new Map<string, XFAField>();
  const mapB = new Map<string, XFAField>();
  const orderedKeys: string[] = [];

  const countA = new Map<string, number>();
  for (const f of docA.fields) {
    const rawBase = `${(f.parentSubform || '').toLowerCase()}::${(f.dataRef || f.name).toLowerCase()}`;
    const occ = countA.get(rawBase) || 0;
    countA.set(rawBase, occ + 1);
    const key = buildCanonicalFieldKey(f, occ);
    mapA.set(key, f);
    orderedKeys.push(key);
  }

  const countB = new Map<string, number>();
  // Secondary lookup by plain field name if subform hierarchy names differ slightly between revisions
  const unusedByNameA = new Map<string, string>();
  mapA.forEach((f, key) => {
    const simpleName = f.name.trim().toLowerCase();
    if (!unusedByNameA.has(simpleName)) {
      unusedByNameA.set(simpleName, key);
    }
  });

  for (const f of docB.fields) {
    const rawBase = `${(f.parentSubform || '').toLowerCase()}::${(f.dataRef || f.name).toLowerCase()}`;
    const occ = countB.get(rawBase) || 0;
    countB.set(rawBase, occ + 1);
    let key = buildCanonicalFieldKey(f, occ);

    if (!mapA.has(key)) {
      const simpleName = f.name.trim().toLowerCase();
      const matchedKey = unusedByNameA.get(simpleName);
      if (matchedKey && !mapB.has(matchedKey)) {
        key = matchedKey;
        unusedByNameA.delete(simpleName);
      }
    } else {
      unusedByNameA.delete(f.name.trim().toLowerCase());
    }

    mapB.set(key, f);
    if (!mapA.has(key)) {
      orderedKeys.push(key);
    }
  }

  const entries: FieldDiffEntry[] = [];
  const subformSet = new Set<string>();

  let identicalCount = 0;
  let modifiedCount = 0;
  let addedCount = 0;
  let removedCount = 0;

  orderedKeys.forEach((key, idx) => {
    const fieldA = mapA.get(key);
    const fieldB = mapB.get(key);
    const primary = fieldA || fieldB!;
    const subform = primary.parentSubform || 'General Form Fields';
    subformSet.add(subform);

    const valueA = normalizeDisplayValue(fieldA);
    const valueB = normalizeDisplayValue(fieldB);

    const normA = normalizeForComparison(valueA, options);
    const normB = normalizeForComparison(valueB, options);

    const presence: FieldDiffEntry['presence'] =
      fieldA && fieldB ? 'both' : fieldA ? 'only_a' : 'only_b';

    let status: FieldDiffStatus = 'unchanged';
    if (presence === 'only_b') {
      status = 'added';
      addedCount++;
    } else if (presence === 'only_a') {
      status = 'removed';
      removedCount++;
    } else if (normA === normB) {
      status = 'unchanged';
      identicalCount++;
    } else {
      // Both exist, values differ — classify empty->filled as 'added' (green) and filled->empty as 'removed' (red)
      const isEmptyA = !fieldA?.value?.trim() && fieldA?.type !== 'check';
      const isEmptyB = !fieldB?.value?.trim() && fieldB?.type !== 'check';
      if (isEmptyA && !isEmptyB) {
        status = 'added';
        addedCount++;
      } else if (!isEmptyA && isEmptyB) {
        status = 'removed';
        removedCount++;
      } else {
        status = 'modified';
        modifiedCount++;
      }
    }

    const { tokensA, tokensB } = computeInlineDiffTokens(valueA, valueB);

    // Numeric delta calculation when both values are numeric
    let numericDelta: number | undefined;
    let numericPercentChange: number | undefined;
    if (fieldA && fieldB && fieldA.type !== 'check' && fieldB.type !== 'check') {
      const numA = parseNumericValue(fieldA.value || '');
      const numB = parseNumericValue(fieldB.value || '');
      if (numA !== null && numB !== null && numA !== numB) {
        numericDelta = Number((numB - numA).toFixed(4));
        if (numA !== 0) {
          numericPercentChange = Number((((numB - numA) / Math.abs(numA)) * 100).toFixed(1));
        }
      }
    }

    // Track structural attribute differences (required, readOnly, type)
    const attributeChanges: string[] = [];
    if (fieldA && fieldB) {
      if (fieldA.type !== fieldB.type) {
        attributeChanges.push(`Type: ${fieldA.type} → ${fieldB.type}`);
      }
      if (Boolean(fieldA.required) !== Boolean(fieldB.required)) {
        attributeChanges.push(fieldB.required ? 'Marked Required in Doc B' : 'Made Optional in Doc B');
      }
      if (Boolean(fieldA.readOnly) !== Boolean(fieldB.readOnly)) {
        attributeChanges.push(fieldB.readOnly ? 'Locked Read-Only in Doc B' : 'Unlocked Editable in Doc B');
      }
    }

    entries.push({
      id: `diff_${idx}_${key}`,
      matchKey: key,
      name: primary.name,
      caption: primary.caption || primary.name,
      subform,
      fieldType: primary.type,
      status,
      presence,
      valueA,
      valueB,
      fieldA,
      fieldB,
      tokensA,
      tokensB,
      numericDelta,
      numericPercentChange,
      attributeChanges,
    });
  });

  const totalCompared = entries.length;
  const discrepancyCount = modifiedCount + addedCount + removedCount;
  const similarityPercent =
    totalCompared > 0 ? Math.round((identicalCount / totalCompared) * 100) : 100;

  return {
    entries,
    subformNames: Array.from(subformSet),
    stats: {
      totalCompared,
      identicalCount,
      modifiedCount,
      addedCount,
      removedCount,
      discrepancyCount,
      similarityPercent,
    },
  };
}

function escapeCsvCell(val: string): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function generateDiffCsvReport(
  diff: FieldDiffResult,
  docAName: string,
  docBName: string
): string {
  const header = [
    'Status',
    'Presence',
    'Subform',
    'Field Caption',
    'XFA Field Name',
    'Type',
    `Doc A (${docAName})`,
    `Doc B (${docBName})`,
    'Numeric Delta',
    'Attribute Changes',
  ];

  const rows = diff.entries.map(e => [
    e.status.toUpperCase(),
    e.presence,
    e.subform,
    e.caption,
    e.name,
    e.fieldType,
    e.valueA,
    e.valueB,
    e.numericDelta !== undefined ? String(e.numericDelta) : '',
    e.attributeChanges.join('; '),
  ]);

  return [header, ...rows].map(row => row.map(escapeCsvCell).join(',')).join('\n');
}

export function generateDiffJsonReport(
  diff: FieldDiffResult,
  docA: DiffDocumentSummary,
  docB: DiffDocumentSummary
): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      documentA: {
        filename: docA.filename,
        pageCount: docA.pageCount,
        totalFields: docA.fields.length,
        filledFields: docA.filledCount,
      },
      documentB: {
        filename: docB.filename,
        pageCount: docB.pageCount,
        totalFields: docB.fields.length,
        filledFields: docB.filledCount,
      },
      summary: diff.stats,
      comparisons: diff.entries.map(e => ({
        status: e.status,
        presence: e.presence,
        subform: e.subform,
        name: e.name,
        caption: e.caption,
        type: e.fieldType,
        valueA: e.valueA,
        valueB: e.valueB,
        numericDelta: e.numericDelta ?? null,
        numericPercentChange: e.numericPercentChange ?? null,
        attributeChanges: e.attributeChanges,
      })),
    },
    null,
    2
  );
}
