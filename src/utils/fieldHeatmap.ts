import { XFAField, ValidationError } from '../types/pdf';
import { validateField } from './validationEngine';

export type HeatmapMetricMode = 'completion' | 'usage' | 'errors';

export interface FieldInteractionStat {
  edits: number;
  selections: number;
  lastInteractedAt?: string;
}

export type FieldInteractionMap = Record<string, FieldInteractionStat>;

export interface FieldHeatmapCell {
  fieldId: string;
  mode: HeatmapMetricMode;
  /** Hex border color */
  borderHex: string;
  /** RGB triplet (r, g, b) so overlay opacity can be adjusted cleanly */
  fillRgb: string;
  /** Compact accessible label rendered on the field corner (e.g. "✓", "Req", "4×", "2E") */
  shortLabel: string;
  /** Human-readable status text */
  statusLabel: string;
  /** 0..1 normalized intensity for subtle glow/emphasis */
  intensity: number;
  /** Text color for the corner indicator */
  indicatorTextClass: string;
  /** Background color for the corner indicator */
  indicatorBgHex: string;
  /** Underlying raw metrics for tooltips & summaries */
  isFilled: boolean;
  isRequired: boolean;
  editCount: number;
  selectionCount: number;
  totalInteractions: number;
  lastInteractedAt?: string;
  errorCount: number;
  warningCount: number;
  issues: ValidationError[];
}

export interface HeatmapSummary {
  totalFields: number;
  completedValid: number;
  filledWithIssues: number;
  emptyRequired: number;
  emptyOptional: number;
  completionPercent: number;
  totalInteractions: number;
  interactedFields: number;
  maxInteractions: number;
  hotspotFieldId: string | null;
  fieldsWithErrors: number;
  fieldsWithWarnings: number;
  cleanFields: number;
  totalErrors: number;
  totalWarnings: number;
  problemFieldIds: string[];
  missingRequiredFieldIds: string[];
}

const STORAGE_PREFIX = 'acroxfa_field_interactions_v1::';

function getStorageKey(docKey: string): string {
  return `${STORAGE_PREFIX}${(docKey || 'default').trim().toLowerCase()}`;
}

export function loadFieldInteractions(docKey: string): FieldInteractionMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(getStorageKey(docKey));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const cleaned: FieldInteractionMap = {};
    Object.entries(parsed).forEach(([fieldId, stat]: [string, any]) => {
      if (stat && typeof stat === 'object') {
        const edits = Math.max(0, Number(stat.edits) || 0);
        const selections = Math.max(0, Number(stat.selections) || 0);
        if (edits > 0 || selections > 0) {
          cleaned[fieldId] = {
            edits,
            selections,
            lastInteractedAt:
              typeof stat.lastInteractedAt === 'string' ? stat.lastInteractedAt : undefined,
          };
        }
      }
    });
    return cleaned;
  } catch {
    return {};
  }
}

export function saveFieldInteractions(docKey: string, map: FieldInteractionMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(docKey), JSON.stringify(map));
  } catch {
    // Ignore localStorage quota errors safely
  }
}

export function isFieldValueFilled(field: XFAField): boolean {
  const val = field.value !== undefined && field.value !== null ? String(field.value).trim() : '';
  if (!val) return false;
  if (field.type === 'check') {
    const lower = val.toLowerCase();
    return lower !== '0' && lower !== 'false' && lower !== 'off' && lower !== 'no';
  }
  return true;
}

export function isFieldConsideredRequired(field: XFAField): boolean {
  return Boolean(field.required || field.validation?.nullTest === 'error');
}

/**
 * Computes full heatmap cell styling and document/page-level summary metrics
 * from live field state, validation issues, and recorded interaction telemetry.
 */
export function computeFieldHeatmap(
  fields: XFAField[],
  interactions: FieldInteractionMap,
  mode: HeatmapMetricMode
): {
  cells: Map<string, FieldHeatmapCell>;
  summary: HeatmapSummary;
} {
  const allFieldsMap = new Map<string, XFAField>();
  fields.forEach(f => allFieldsMap.set(f.id, f));

  // First pass: collect raw stats & find max usage for normalization
  let maxInteractions = 0;
  let totalInteractions = 0;
  let interactedFields = 0;
  let hotspotFieldId: string | null = null;

  const rawStats = fields.map(field => {
    const stat = interactions[field.id];
    const editCount = stat?.edits || 0;
    const selectionCount = stat?.selections || 0;
    const total = editCount + selectionCount;
    if (total > 0) {
      interactedFields += 1;
      totalInteractions += total;
      if (total > maxInteractions) {
        maxInteractions = total;
        hotspotFieldId = field.id;
      }
    }

    const issues = validateField(field, allFieldsMap);
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const isFilled = isFieldValueFilled(field);
    const isRequired = isFieldConsideredRequired(field);

    return {
      field,
      editCount,
      selectionCount,
      totalInteractions: total,
      lastInteractedAt: stat?.lastInteractedAt,
      issues,
      errorCount,
      warningCount,
      isFilled,
      isRequired,
    };
  });

  const cells = new Map<string, FieldHeatmapCell>();

  let completedValid = 0;
  let filledWithIssues = 0;
  let emptyRequired = 0;
  let emptyOptional = 0;
  let fieldsWithErrors = 0;
  let fieldsWithWarnings = 0;
  let cleanFields = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  const problemFieldIds: string[] = [];
  const missingRequiredFieldIds: string[] = [];

  // Normalize usage with a minimum ceiling of 4 so a single click isn't shown as critical hot
  const usageDenominator = Math.max(4, maxInteractions);

  rawStats.forEach(item => {
    const {
      field,
      editCount,
      selectionCount,
      totalInteractions: fieldTotal,
      lastInteractedAt,
      issues,
      errorCount,
      warningCount,
      isFilled,
      isRequired,
    } = item;

    // Tally document-level completion counts
    if (isFilled) {
      if (errorCount > 0 || warningCount > 0) {
        filledWithIssues += 1;
      } else {
        completedValid += 1;
      }
    } else if (isRequired) {
      emptyRequired += 1;
      missingRequiredFieldIds.push(field.id);
    } else {
      emptyOptional += 1;
    }

    // Tally document-level error counts
    totalErrors += errorCount;
    totalWarnings += warningCount;
    if (errorCount > 0) {
      fieldsWithErrors += 1;
      problemFieldIds.push(field.id);
    } else if (warningCount > 0) {
      fieldsWithWarnings += 1;
      problemFieldIds.push(field.id);
    } else {
      cleanFields += 1;
    }

    // Determine cell color & label for active heatmap mode
    let borderHex = '#64748b';
    let fillRgb = '100, 116, 139';
    let shortLabel = '—';
    let statusLabel = 'Optional (Empty)';
    let intensity = 0.25;
    let indicatorBgHex = '#334155';
    let indicatorTextClass = 'text-slate-100';

    if (mode === 'completion') {
      if (isFilled && errorCount === 0 && warningCount === 0) {
        borderHex = '#10b981';
        fillRgb = '16, 185, 129';
        shortLabel = 'Done';
        statusLabel = 'Completed & Valid';
        intensity = 0.65;
        indicatorBgHex = '#047857';
        indicatorTextClass = 'text-emerald-50';
      } else if (isFilled && (errorCount > 0 || warningCount > 0)) {
        borderHex = '#f59e0b';
        fillRgb = '245, 158, 11';
        shortLabel = 'Check';
        statusLabel = `Filled (${errorCount > 0 ? `${errorCount} err` : `${warningCount} warn`})`;
        intensity = 0.85;
        indicatorBgHex = '#b45309';
        indicatorTextClass = 'text-amber-50';
      } else if (!isFilled && isRequired) {
        borderHex = '#ef4444';
        fillRgb = '239, 68, 68';
        shortLabel = 'Req';
        statusLabel = 'Required (Missing)';
        intensity = 0.95;
        indicatorBgHex = '#b91c1c';
        indicatorTextClass = 'text-rose-50';
      } else {
        borderHex = '#64748b';
        fillRgb = '100, 116, 139';
        shortLabel = 'Open';
        statusLabel = 'Optional (Empty)';
        intensity = 0.35;
        indicatorBgHex = '#334155';
        indicatorTextClass = 'text-slate-200';
      }
    } else if (mode === 'usage') {
      const ratio = Math.min(1, fieldTotal / usageDenominator);
      if (fieldTotal === 0) {
        borderHex = '#475569';
        fillRgb = '71, 85, 105';
        shortLabel = '0×';
        statusLabel = 'Untouched (0 interactions)';
        intensity = 0.25;
        indicatorBgHex = '#334155';
        indicatorTextClass = 'text-slate-200';
      } else if (ratio < 0.34) {
        borderHex = '#3b82f6';
        fillRgb = '59, 130, 246';
        shortLabel = `${fieldTotal}×`;
        statusLabel = `Low Activity (${fieldTotal} interactions)`;
        intensity = 0.5;
        indicatorBgHex = '#1d4ed8';
        indicatorTextClass = 'text-blue-50';
      } else if (ratio < 0.67) {
        borderHex = '#f59e0b';
        fillRgb = '245, 158, 11';
        shortLabel = `${fieldTotal}×`;
        statusLabel = `Active (${fieldTotal} interactions)`;
        intensity = 0.78;
        indicatorBgHex = '#b45309';
        indicatorTextClass = 'text-amber-50';
      } else {
        borderHex = '#ea580c';
        fillRgb = '234, 88, 12';
        shortLabel = `${fieldTotal}×`;
        statusLabel = `High-Traffic Hotspot (${fieldTotal} interactions)`;
        intensity = 1;
        indicatorBgHex = '#c2410c';
        indicatorTextClass = 'text-orange-50';
      }
    } else {
      // mode === 'errors'
      if (errorCount >= 2) {
        borderHex = '#dc2626';
        fillRgb = '220, 38, 38';
        shortLabel = `${errorCount}E`;
        statusLabel = `Critical (${errorCount} errors${warningCount > 0 ? `, ${warningCount} warn` : ''})`;
        intensity = 1;
        indicatorBgHex = '#991b1b';
        indicatorTextClass = 'text-rose-50';
      } else if (errorCount === 1) {
        borderHex = '#ea580c';
        fillRgb = '234, 88, 12';
        shortLabel = '1E';
        statusLabel = `1 Error${warningCount > 0 ? `, ${warningCount} warning` : ''}`;
        intensity = 0.85;
        indicatorBgHex = '#c2410c';
        indicatorTextClass = 'text-orange-50';
      } else if (warningCount > 0) {
        borderHex = '#f59e0b';
        fillRgb = '245, 158, 11';
        shortLabel = `${warningCount}W`;
        statusLabel = `${warningCount} ${warningCount === 1 ? 'Warning' : 'Warnings'}`;
        intensity = 0.68;
        indicatorBgHex = '#b45309';
        indicatorTextClass = 'text-amber-50';
      } else {
        borderHex = '#10b981';
        fillRgb = '16, 185, 129';
        shortLabel = 'OK';
        statusLabel = 'No Validation Errors';
        intensity = 0.3;
        indicatorBgHex = '#065f46';
        indicatorTextClass = 'text-emerald-100';
      }
    }

    cells.set(field.id, {
      fieldId: field.id,
      mode,
      borderHex,
      fillRgb,
      shortLabel,
      statusLabel,
      intensity,
      indicatorTextClass,
      indicatorBgHex,
      isFilled,
      isRequired,
      editCount,
      selectionCount,
      totalInteractions: fieldTotal,
      lastInteractedAt,
      errorCount,
      warningCount,
      issues,
    });
  });

  const totalFields = fields.length;
  const filledTotal = completedValid + filledWithIssues;
  const completionPercent = totalFields > 0 ? Math.round((filledTotal / totalFields) * 100) : 0;

  return {
    cells,
    summary: {
      totalFields,
      completedValid,
      filledWithIssues,
      emptyRequired,
      emptyOptional,
      completionPercent,
      totalInteractions,
      interactedFields,
      maxInteractions,
      hotspotFieldId,
      fieldsWithErrors,
      fieldsWithWarnings,
      cleanFields,
      totalErrors,
      totalWarnings,
      problemFieldIds,
      missingRequiredFieldIds,
    },
  };
}
