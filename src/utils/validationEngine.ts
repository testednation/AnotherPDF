import { XFAField, XFASubform, ValidationError, ValidationSeverity } from '../types/pdf';

/**
 * Converts XFA Picture Clause to a JavaScript RegExp
 * Reference: Adobe XML Forms Architecture (XFA) Specification v3.3 Section 11 - Picture Clauses
 *
 * Common XFA Picture patterns:
 * - text{999-999-999}  -> 3 digits - 3 digits - 3 digits (e.g. SIN / Tax ID)
 * - text{A9A 9A9}      -> Canadian postal code
 * - text{99999}        -> 5-digit zip
 * - text{99999-9999}   -> 9-digit zip
 * - date{YYYY-MM-DD}   -> ISO date
 * - date{MM/DD/YYYY}   -> US date
 * - num{zz,zzz,zz9.99} -> Currency/number
 */
export function xfaPictureToRegex(picture: string): RegExp | null {
  try {
    const trimmed = picture.trim();
    const match = trimmed.match(/^([a-z]+)\{(.+)\}$/i);
    if (!match) return null;

    const kind = match[1].toLowerCase();
    const pattern = match[2];

    if (kind === 'text') {
      let regexStr = '^';
      for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];
        if (char === '9') {
          regexStr += '\\d';
        } else if (char === 'A') {
          regexStr += '[A-Za-z]';
        } else if (char === 'X') {
          regexStr += '[A-Za-z0-9]';
        } else if (char === '?') {
          regexStr += '.';
        } else if ('- ()/.:,'.includes(char)) {
          regexStr += `\\${char}`;
        } else {
          regexStr += `[${char}]`;
        }
      }
      regexStr += '$';
      return new RegExp(regexStr);
    }

    if (kind === 'date') {
      if (pattern.toUpperCase() === 'YYYY-MM-DD') {
        return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
      }
      if (pattern.toUpperCase() === 'MM/DD/YYYY') {
        return /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
      }
      if (pattern.toUpperCase() === 'DD/MM/YYYY') {
        return /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
      }
      return /^\d{4}[-/]\d{2}[-/]\d{2}$/;
    }

    if (kind === 'num') {
      return /^[-+]?\$?\s*\d{1,3}(,\d{3})*(\.\d+)?$|^[-+]?\d+(\.\d+)?$/;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Standard Semantic Business Logic Patterns
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
export const CANADIAN_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
export const PHONE_REGEX = /^(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}$/;
export const FISCAL_YEAR_REGEX = /^\d{4}(-\d{2,4})?$/;
export const CBF_PROJECT_NO_REGEX = /^(CBF-)?[A-Za-z0-9\-_]{3,24}$/i;
export const CRA_BN_REGEX = /^\d{9}$/;

export type FieldDataType =
  | 'date'
  | 'numeric'
  | 'email'
  | 'phone'
  | 'postal_code'
  | 'cra_bn'
  | 'fiscal_year'
  | 'check'
  | 'choice'
  | 'signature'
  | 'multiline'
  | 'text';

export interface FieldDataTypeInfo {
  type: FieldDataType;
  label: string;
  description?: string;
  shortTag: string;
  badgeClass: string;
  accentBorder: string;
  expectedPattern?: string;
  expectedFormat?: string;
  exampleValue?: string;
  minValue?: number;
  maxValue?: number;
  min?: number;
  max?: number;
  unit?: string;
}

/**
 * Normalizes FieldDataTypeInfo to ensure convenient alias properties exist
 */
function normalizeDataTypeInfo(info: FieldDataTypeInfo): FieldDataTypeInfo {
  return {
    ...info,
    description: info.description || info.label,
    expectedFormat: info.expectedFormat || info.expectedPattern,
    min: info.min !== undefined ? info.min : info.minValue,
    max: info.max !== undefined ? info.max : info.maxValue,
    minValue: info.minValue !== undefined ? info.minValue : info.min,
    maxValue: info.maxValue !== undefined ? info.maxValue : info.max,
  };
}

/**
 * Detects the semantic data type and constraints of an XFA field
 */
export function detectFieldDataType(field: XFAField): FieldDataTypeInfo {
  const raw = detectFieldDataTypeRaw(field);
  return normalizeDataTypeInfo(raw);
}

function detectFieldDataTypeRaw(field: XFAField): FieldDataTypeInfo {
  const name = field.name.toLowerCase();
  const caption = (field.caption || '').toLowerCase();
  const format = (field.format || '').toLowerCase();
  const pic = (field.validation?.picturePattern || '').toLowerCase();

  // 1. Calendar Date
  if (
    field.type === 'date' ||
    pic.includes('date{') ||
    format.includes('date') ||
    name.includes('date') ||
    caption.includes('date') ||
    name.includes('period_end') ||
    name.includes('period_start')
  ) {
    return {
      type: 'date',
      label: 'Calendar Date',
      shortTag: 'Date',
      badgeClass: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80',
      accentBorder: 'border-indigo-500/70',
      expectedPattern: field.validation?.picturePattern || 'YYYY-MM-DD',
      exampleValue: '2025-03-31',
    };
  }

  // 2. Email Address
  if (name.includes('email') || caption.includes('email') || format === 'email') {
    return {
      type: 'email',
      label: 'Email Address',
      shortTag: 'Email',
      badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80',
      accentBorder: 'border-cyan-500/70',
      expectedPattern: 'user@domain.com',
      exampleValue: 'contact@publisher.ca',
    };
  }

  // 3. Telephone Number
  if (name.includes('phone') || caption.includes('phone') || name.includes('telephone') || caption.includes('telephone')) {
    return {
      type: 'phone',
      label: 'Telephone Number',
      shortTag: 'Phone',
      badgeClass: 'bg-teal-950/80 text-teal-300 border-teal-800/80',
      accentBorder: 'border-teal-500/70',
      expectedPattern: '(XXX) XXX-XXXX',
      exampleValue: '(613) 555-0199',
    };
  }

  // 4. Canadian Postal Code
  if (name.includes('postal') || caption.includes('postal') || name.includes('postcode') || caption.includes('zip')) {
    return {
      type: 'postal_code',
      label: 'Canadian Postal Code',
      shortTag: 'Postal',
      badgeClass: 'bg-sky-950/80 text-sky-300 border-sky-800/80',
      accentBorder: 'border-sky-500/70',
      expectedPattern: 'A1A 1A1',
      exampleValue: 'K1A 0B4',
    };
  }

  // 5. CRA Business Number
  if (name.includes('business_number') || name.includes('bus_num') || name.includes('businessnumber') || caption.includes('business number') || name.includes('cra_bn')) {
    return {
      type: 'cra_bn',
      label: 'CRA Business Number',
      shortTag: 'CRA BN',
      badgeClass: 'bg-violet-950/80 text-violet-300 border-violet-800/80',
      accentBorder: 'border-violet-500/70',
      expectedPattern: '9-digit number',
      exampleValue: '123456789',
    };
  }

  // 6. Fiscal Year
  if (name.includes('fiscal') || caption.includes('fiscal')) {
    return {
      type: 'fiscal_year',
      label: 'Fiscal Year',
      shortTag: 'Fiscal',
      badgeClass: 'bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-800/80',
      accentBorder: 'border-fuchsia-500/70',
      expectedPattern: 'YYYY-YYYY',
      exampleValue: '2024-2025',
    };
  }

  // 7. Checkbox
  if (field.type === 'check') {
    return {
      type: 'check',
      label: 'Affirmation Checkbox',
      shortTag: 'Check',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
      accentBorder: 'border-emerald-500/70',
      expectedPattern: '1 or 0',
      exampleValue: '1',
    };
  }

  // 8. Choice / Dropdown
  if (field.type === 'choice') {
    return {
      type: 'choice',
      label: 'Dropdown Selection',
      shortTag: 'Choice',
      badgeClass: 'bg-purple-950/80 text-purple-300 border-purple-800/80',
      accentBorder: 'border-purple-500/70',
    };
  }

  // 9. Digital Signature
  if (field.type === 'signature' || name.includes('sign') || caption.includes('sign') || name.includes('witness')) {
    return {
      type: 'signature',
      label: 'Digital Legal Signature',
      shortTag: 'Signature',
      badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-800/80',
      accentBorder: 'border-rose-500/70',
      exampleValue: 'Jane Doe, Executive Director',
    };
  }

  // 10. Numeric Range / Currency
  if (
    field.type === 'numeric' ||
    pic.includes('num{') ||
    name.includes('amount') ||
    name.includes('revenue') ||
    caption.includes('revenue') ||
    name.includes('expenditure') ||
    caption.includes('expenditure') ||
    name.includes('cost') ||
    name.includes('fee') ||
    name.includes('salary') ||
    name.includes('sales') ||
    name.includes('grant') ||
    name.includes('contribution') ||
    name.includes('balance') ||
    name.includes('variance')
  ) {
    const isPercent = name.includes('percent') || caption.includes('%') || format.includes('percent');
    const min = field.validation?.minValue ?? (name.includes('variance') || name.includes('balance') ? undefined : 0);
    const max = field.validation?.maxValue ?? (isPercent ? 100 : undefined);
    return {
      type: 'numeric',
      label: isPercent ? 'Percentage (0-100%)' : 'Numeric Range / CAD $',
      shortTag: isPercent ? 'Percent' : 'Numeric Range',
      badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
      accentBorder: 'border-amber-500/70',
      expectedPattern: isPercent ? '0% - 100%' : field.validation?.picturePattern || 'num{$ZZZ,ZZ9.99}',
      exampleValue: isPercent ? '75%' : '$25,000.00',
      minValue: min,
      maxValue: max,
      unit: isPercent ? '%' : '$ CAD',
    };
  }

  // 11. Multi-line Notes
  if (field.type === 'multiline') {
    return {
      type: 'multiline',
      label: 'Multi-line Text',
      shortTag: 'Notes',
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
      accentBorder: 'border-slate-600',
    };
  }

  // 12. Standard Text
  return {
    type: 'text',
    label: 'Alphanumeric Text',
    shortTag: 'Text',
    badgeClass: 'bg-slate-800/90 text-slate-300 border-slate-700/80',
    accentBorder: 'border-slate-700',
  };
}

/**
 * Validates calendar date structure and real month/day boundaries
 */
export function isValidCalendarDate(val: string): { valid: boolean; message?: string } {
  const trimmed = val.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const usSlashMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  let y = 0, m = 0, d = 0;
  if (isoMatch) {
    y = parseInt(isoMatch[1], 10);
    m = parseInt(isoMatch[2], 10);
    d = parseInt(isoMatch[3], 10);
  } else if (usSlashMatch) {
    const first = parseInt(usSlashMatch[1], 10);
    const second = parseInt(usSlashMatch[2], 10);
    y = parseInt(usSlashMatch[3], 10);
    if (first > 12 && second <= 12) {
      d = first;
      m = second;
    } else {
      m = first;
      d = second;
    }
  } else {
    return { valid: false, message: 'Date format must be YYYY-MM-DD or MM/DD/YYYY.' };
  }

  if (m < 1 || m > 12) {
    return { valid: false, message: `Invalid month (${m}). Month must be between 01 and 12.` };
  }
  if (y < 1900 || y > 2100) {
    return { valid: false, message: `Year (${y}) is outside valid historical/fiscal range (1900-2100).` };
  }

  const daysInMonth = new Date(y, m, 0).getDate();
  if (d < 1 || d > daysInMonth) {
    return { valid: false, message: `Invalid day (${d}) for month ${m}/${y}. Month only has ${daysInMonth} days.` };
  }

  return { valid: true };
}

/**
 * Detailed diagnostics for email address formatting
 */
export function validateEmailDetailed(val: string): { valid: boolean; message?: string } {
  const trimmed = val.trim();
  if (!trimmed.includes('@')) {
    return { valid: false, message: 'Email address is missing an "@" symbol.' };
  }
  const parts = trimmed.split('@');
  if (parts.length > 2) {
    return { valid: false, message: 'Email cannot contain multiple "@" symbols.' };
  }
  if (!parts[0]) {
    return { valid: false, message: 'Email username prefix before "@" cannot be empty.' };
  }
  if (!parts[1] || !parts[1].includes('.')) {
    return { valid: false, message: 'Email domain must contain a valid top-level domain (e.g. .ca, .com).' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, message: 'Email contains invalid characters or malformed domain structure.' };
  }
  return { valid: true };
}

export interface FieldValidationState {
  status: 'valid' | 'invalid' | 'warning' | 'empty_required' | 'empty_optional';
  statusLabel: string;
  statusBadgeClass: string;
  inputBorderClass: string;
  cardHighlightClass: string;
  primaryIssue?: ValidationError;
}

/**
 * Returns the live real-time validation state and color highlights for an XFA field
 */
export function getFieldValidationState(field: XFAField, issues: ValidationError[] = []): FieldValidationState {
  const val = field.value !== undefined && field.value !== null ? String(field.value).trim() : '';
  const isRequired = field.required || field.validation?.nullTest === 'error';
  const hasError = issues.some(i => i.severity === 'error');
  const hasWarning = !hasError && issues.some(i => i.severity === 'warning');
  const primaryError = issues.find(i => i.severity === 'error') || issues[0];

  if (!val) {
    if (isRequired) {
      return {
        status: 'empty_required',
        statusLabel: 'Required Missing',
        statusBadgeClass: 'bg-rose-950/80 text-rose-300 border-rose-800',
        inputBorderClass: 'border-rose-500/80 focus:border-rose-400 focus:ring-rose-500/40',
        cardHighlightClass: 'border-rose-500/60 bg-rose-950/15 ring-1 ring-rose-500/30',
        primaryIssue: primaryError,
      };
    }
    return {
      status: 'empty_optional',
      statusLabel: 'Optional',
      statusBadgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
      inputBorderClass: 'border-slate-800 focus:border-sky-500 focus:ring-sky-500',
      cardHighlightClass: 'border-slate-800/80 bg-slate-950/40',
    };
  }

  if (hasError) {
    return {
      status: 'invalid',
      statusLabel: 'Format Error',
      statusBadgeClass: 'bg-rose-950 text-rose-300 border-rose-700',
      inputBorderClass: 'border-rose-500 bg-rose-950/20 text-rose-100 focus:border-rose-400 focus:ring-rose-500/50',
      cardHighlightClass: 'border-rose-500/80 bg-rose-950/25 ring-1 ring-rose-500/40 shadow-sm',
      primaryIssue: primaryError,
    };
  }

  if (hasWarning) {
    return {
      status: 'warning',
      statusLabel: 'Format Warning',
      statusBadgeClass: 'bg-amber-950 text-amber-300 border-amber-700',
      inputBorderClass: 'border-amber-500/80 bg-amber-950/20 text-amber-100 focus:border-amber-400 focus:ring-amber-500/40',
      cardHighlightClass: 'border-amber-500/80 bg-amber-950/20 ring-1 ring-amber-500/30',
      primaryIssue: primaryError,
    };
  }

  return {
    status: 'valid',
    statusLabel: 'Valid Format',
    statusBadgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
    inputBorderClass: 'border-emerald-600/70 focus:border-emerald-400 focus:ring-emerald-500/30',
    cardHighlightClass: 'border-emerald-500/40 bg-emerald-950/10 ring-1 ring-emerald-500/20',
  };
}

/**
 * Parses numeric currency strings like "$125,000.00" or "(500.00)" into raw floats
 */
export function parseCurrencyOrNumber(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/\$/g, '').replace(/,/g, '').trim();
  if (clean.startsWith('(') && clean.endsWith(')')) {
    const inner = clean.slice(1, -1);
    const num = parseFloat(inner);
    return isNaN(num) ? 0 : -num;
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Validates a single XFA field against:
 * 1. Required / NullTest constraints
 * 2. XFA Picture clauses (<picture> or format)
 * 3. Custom regex patterns
 * 4. Numeric min/max bounds
 * 5. Semantic field heuristics (email, phone, postal code, fiscal year, project numbers)
 * 6. Business logic constraints
 */
export function validateField(
  field: XFAField,
  allFieldsMap: Map<string, XFAField>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const val = field.value !== undefined && field.value !== null ? String(field.value).trim() : '';
  const validation = field.validation;
  const isRequired = field.required || validation?.nullTest === 'error';
  const nameLower = field.name.toLowerCase();
  const captionLower = field.caption.toLowerCase();

  // 1. Required / Empty check
  if (isRequired && !val) {
    errors.push({
      id: `${field.id}_required`,
      fieldId: field.id,
      fieldName: field.name,
      fieldCaption: field.caption,
      subformName: field.parentSubform,
      severity: 'error',
      ruleType: 'required',
      message: validation?.message || `${field.caption || field.name} is mandatory and cannot be left blank.`,
      ruleDescription: 'Mandatory XFA Field (nullTest="error")',
      actualValue: val,
    });
    // If empty and required, return early so we don't pile on format errors
    return errors;
  }

  // If empty and not required, skip format checks
  if (!val) {
    return errors;
  }

  // 2. XFA Picture Clause pattern
  const picturePattern = validation?.picturePattern || field.format;
  if (picturePattern) {
    const rx = xfaPictureToRegex(picturePattern);
    if (rx && !rx.test(val)) {
      errors.push({
        id: `${field.id}_picture`,
        fieldId: field.id,
        fieldName: field.name,
        fieldCaption: field.caption,
        subformName: field.parentSubform,
        severity: 'error',
        ruleType: 'picture_pattern',
        message: validation?.message || `Value does not match required XFA format: ${picturePattern}`,
        ruleDescription: `XFA Picture Clause: ${picturePattern}`,
        expectedPattern: picturePattern,
        actualValue: val,
      });
    }
  }

  // 3. Custom regex pattern (if specified in validation rule)
  if (validation?.regexPattern) {
    try {
      const rx = new RegExp(validation.regexPattern);
      if (!rx.test(val)) {
        errors.push({
          id: `${field.id}_regex`,
          fieldId: field.id,
          fieldName: field.name,
          fieldCaption: field.caption,
          subformName: field.parentSubform,
          severity: 'error',
          ruleType: 'regex',
          message: validation.message || `Value fails validation pattern: ${validation.regexPattern}`,
          ruleDescription: `RegExp constraint: ${validation.regexPattern}`,
          expectedPattern: validation.regexPattern,
          actualValue: val,
        });
      }
    } catch {
      // Ignore invalid regex in user definition
    }
  }

  // 4. Numeric Bounds (min/max and type checking)
  if (field.type === 'numeric' || nameLower.includes('amount') || nameLower.includes('fee') || nameLower.includes('revenue') || nameLower.includes('cost') || nameLower.includes('expense')) {
    const num = parseCurrencyOrNumber(val);
    if (isNaN(num) && val !== '') {
      errors.push({
        id: `${field.id}_not_numeric`,
        fieldId: field.id,
        fieldName: field.name,
        fieldCaption: field.caption,
        subformName: field.parentSubform,
        severity: 'error',
        ruleType: 'range',
        message: `Must be a valid numerical or monetary amount.`,
        ruleDescription: 'Numeric constraint',
        actualValue: val,
      });
    } else {
      if (validation?.minValue !== undefined && num < validation.minValue) {
        errors.push({
          id: `${field.id}_min`,
          fieldId: field.id,
          fieldName: field.name,
          fieldCaption: field.caption,
          subformName: field.parentSubform,
          severity: 'error',
          ruleType: 'range',
          message: `Amount must be at least ${validation.minValue}.`,
          ruleDescription: `Minimum allowed value: ${validation.minValue}`,
          actualValue: val,
        });
      }
      if (validation?.maxValue !== undefined && num > validation.maxValue) {
        errors.push({
          id: `${field.id}_max`,
          fieldId: field.id,
          fieldName: field.name,
          fieldCaption: field.caption,
          subformName: field.parentSubform,
          severity: 'error',
          ruleType: 'range',
          message: `Amount cannot exceed ${validation.maxValue}.`,
          ruleDescription: `Maximum allowed value: ${validation.maxValue}`,
          actualValue: val,
        });
      }
    }
  }

  // 5. Semantic Field Intelligence: Email check
  if (nameLower.includes('email') || captionLower.includes('email') || field.format === 'email') {
    const emailResult = validateEmailDetailed(val);
    if (!emailResult.valid) {
      errors.push({
        id: `${field.id}_email`,
        fieldId: field.id,
        fieldName: field.name,
        fieldCaption: field.caption,
        subformName: field.parentSubform,
        severity: 'error',
        ruleType: 'email',
        message: emailResult.message || `Please enter a valid email address (e.g., user@example.ca).`,
        ruleDescription: 'Standard RFC-compliant email address',
        expectedPattern: 'user@domain.com',
        actualValue: val,
      });
    }
  }

  // 6. Semantic Field Intelligence: Phone number check
  if (nameLower.includes('phone') || captionLower.includes('phone') || nameLower.includes('telephone') || captionLower.includes('telephone')) {
    if (!PHONE_REGEX.test(val)) {
      errors.push({
        id: `${field.id}_phone`,
        fieldId: field.id,
        fieldName: field.name,
        fieldCaption: field.caption,
        subformName: field.parentSubform,
        severity: 'warning',
        ruleType: 'phone',
        message: `Phone number format recommended: (XXX) XXX-XXXX or XXX-XXX-XXXX`,
        ruleDescription: 'North American telephone format',
        expectedPattern: '(555) 000-0000',
        actualValue: val,
      });
    }
  }

  // 7. Semantic Field Intelligence: Canadian Postal Code
  if (nameLower.includes('postal') || captionLower.includes('postal') || nameLower.includes('postcode')) {
    if (!CANADIAN_POSTAL_REGEX.test(val)) {
      errors.push({
        id: `${field.id}_postal`,
        fieldId: field.id,
        fieldName: field.name,
        fieldCaption: field.caption,
        subformName: field.parentSubform,
        severity: 'error',
        ruleType: 'postal_code',
        message: `Canadian Postal Code must follow A1A 1A1 format (e.g. K1A 0B4).`,
        ruleDescription: 'Canadian Postal Code format',
        expectedPattern: 'A1A 1A1',
        actualValue: val,
      });
    }
  }

  // 8. Semantic Field Intelligence: Fiscal Year
  if (nameLower.includes('fiscalyear') || captionLower.includes('fiscal year')) {
    if (!FISCAL_YEAR_REGEX.test(val)) {
      errors.push({
        id: `${field.id}_fiscal_year`,
        fieldId: field.id,
        fieldName: field.name,
        fieldCaption: field.caption,
        subformName: field.parentSubform,
        severity: 'error',
        ruleType: 'fiscal_year',
        message: `Fiscal Year must follow YYYY-YYYY or YYYY format (e.g. 2024-2025).`,
        ruleDescription: 'Government Fiscal Cycle Format',
        expectedPattern: '2024-2025',
        actualValue: val,
      });
    }
  }

  // 9. Semantic Field Intelligence: Project Number
  if (nameLower.includes('projectnumber') || captionLower.includes('project number') || nameLower.includes('cbfproject')) {
    if (!CBF_PROJECT_NO_REGEX.test(val)) {
      errors.push({
        id: `${field.id}_project_no`,
        fieldId: field.id,
        fieldName: field.name,
        fieldCaption: field.caption,
        subformName: field.parentSubform,
        severity: 'warning',
        ruleType: 'custom_logic',
        message: `Project Number should match standard identifier format (e.g. CBF-2024-0018).`,
        ruleDescription: 'Canada Book Fund Project Identifier',
        expectedPattern: 'CBF-YYYY-XXXX',
        actualValue: val,
      });
    }
  }

  // 10. Date Format & Calendar Validity Check
  if (field.type === 'date' || nameLower.includes('date') || captionLower.includes('date') || field.validation?.picturePattern?.includes('date{')) {
    const dateResult = isValidCalendarDate(val);
    if (!dateResult.valid) {
      errors.push({
        id: `${field.id}_date_format`,
        fieldId: field.id,
        fieldName: field.name,
        fieldCaption: field.caption,
        subformName: field.parentSubform,
        severity: 'error',
        ruleType: 'picture_pattern',
        message: dateResult.message || `Please enter a valid calendar date (YYYY-MM-DD or MM/DD/YYYY).`,
        ruleDescription: 'Calendar date validation',
        expectedPattern: 'YYYY-MM-DD',
        actualValue: val,
      });
    }
  }

  // 10b. CRA Business Number Check
  if (nameLower.includes('business_number') || nameLower.includes('bus_num') || nameLower.includes('businessnumber') || captionLower.includes('business number') || nameLower.includes('cra_bn')) {
    const digits = val.replace(/\D/g, '');
    if (digits.length !== 9) {
      errors.push({
        id: `${field.id}_cra_bn`,
        fieldId: field.id,
        fieldName: field.name,
        fieldCaption: field.caption,
        subformName: field.parentSubform,
        severity: 'error',
        ruleType: 'custom_logic',
        message: `CRA Business Number must be exactly 9 numeric digits (entered: ${digits.length}).`,
        ruleDescription: 'Canada Revenue Agency 9-Digit Business Number',
        expectedPattern: '123456789',
        actualValue: val,
      });
    }
  }

  // 11. Cross-Field Business Logic Constraints
  // Conditional: If digital declaration checkbox is checked, signatory details must be completed
  if (field.name === 'declarationAgreed' || field.name === 'certificationCheck' || field.name === 'certifiedAgree') {
    const isChecked = val === '1' || val.toLowerCase() === 'true' || val.toLowerCase() === 'yes';
    if (isChecked) {
      // Find officer name and date
      const officerField = Array.from(allFieldsMap.values()).find(
        f => f.name.toLowerCase().includes('officer') || f.name.toLowerCase().includes('authorizedsignatory')
      );
      if (officerField && !officerField.value.trim()) {
        errors.push({
          id: `${field.id}_cross_signatory`,
          fieldId: field.id,
          fieldName: field.name,
          fieldCaption: field.caption,
          subformName: field.parentSubform,
          severity: 'warning',
          ruleType: 'cross_field',
          message: `Declaration is signed, but Authorized Officer Name is missing.`,
          ruleDescription: 'Conditional requirement: Signatory name required when declaration is checked',
          actualValue: val,
        });
      }
    }
  }

  // Check custom businessConstraint string if provided
  if (validation?.businessConstraint) {
    errors.push({
      id: `${field.id}_custom_constraint`,
      fieldId: field.id,
      fieldName: field.name,
      fieldCaption: field.caption,
      subformName: field.parentSubform,
      severity: 'info',
      ruleType: 'custom_logic',
      message: validation.businessConstraint,
      ruleDescription: 'Custom business logic guideline',
      actualValue: val,
    });
  }

  return errors;
}

/**
 * Cross-references whole-form business logic constraints across all fields:
 * - Financial ledger balance checks (Total Revenues vs Line Items, Total Expenditures vs Line Items)
 * - Surplus / Deficit integrity
 * - Staffing & Production counts non-negative
 */
export function validateFormWideConstraints(allFieldsMap: Map<string, XFAField>): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Cross-reference Revenues
  const totalRevField = Array.from(allFieldsMap.values()).find(
    f => f.name === 'totalRevenues' || f.name.toLowerCase().includes('totalrevenue')
  );
  if (totalRevField) {
    const revItems = Array.from(allFieldsMap.values()).filter(
      f =>
        f.id !== totalRevField.id &&
        (f.parentSubform?.toLowerCase().includes('revenue') ||
          f.name.toLowerCase().includes('cbfcontribution') ||
          f.name.toLowerCase().includes('provincialfunding') ||
          f.name.toLowerCase().includes('applicantcontribution') ||
          f.name.toLowerCase().includes('commercialsales') ||
          f.name.toLowerCase().includes('salesrevenues'))
    );

    if (revItems.length > 0) {
      const calculatedSum = revItems.reduce((acc, f) => acc + parseCurrencyOrNumber(f.value), 0);
      const statedTotal = parseCurrencyOrNumber(totalRevField.value);

      if (Math.abs(calculatedSum - statedTotal) > 0.05) {
        errors.push({
          id: `${totalRevField.id}_sum_mismatch`,
          fieldId: totalRevField.id,
          fieldName: totalRevField.name,
          fieldCaption: totalRevField.caption,
          subformName: totalRevField.parentSubform,
          severity: 'warning',
          ruleType: 'financial_balance',
          message: `Total Revenues ($${statedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}) does not match the sum of revenue line items ($${calculatedSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}). Difference: $${Math.abs(calculatedSum - statedTotal).toFixed(2)}`,
          ruleDescription: 'Financial Schedule Cross-Check: Total Revenues == Sum(Line Revenues)',
          actualValue: totalRevField.value,
        });
      }
    }
  }

  // 2. Cross-reference Expenditures
  const totalExpField = Array.from(allFieldsMap.values()).find(
    f => f.name === 'totalExpenditures' || f.name.toLowerCase().includes('totalexpenditure')
  );
  if (totalExpField) {
    const expItems = Array.from(allFieldsMap.values()).filter(
      f =>
        f.id !== totalExpField.id &&
        (f.parentSubform?.toLowerCase().includes('expenditure') ||
          f.name.toLowerCase().includes('editorial') ||
          f.name.toLowerCase().includes('production') ||
          f.name.toLowerCase().includes('marketing') ||
          f.name.toLowerCase().includes('distribution') ||
          f.name.toLowerCase().includes('admin'))
    );

    if (expItems.length > 0) {
      const calculatedSum = expItems.reduce((acc, f) => acc + parseCurrencyOrNumber(f.value), 0);
      const statedTotal = parseCurrencyOrNumber(totalExpField.value);

      if (Math.abs(calculatedSum - statedTotal) > 0.05) {
        errors.push({
          id: `${totalExpField.id}_sum_mismatch`,
          fieldId: totalExpField.id,
          fieldName: totalExpField.name,
          fieldCaption: totalExpField.caption,
          subformName: totalExpField.parentSubform,
          severity: 'warning',
          ruleType: 'financial_balance',
          message: `Total Expenditures ($${statedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}) does not match the sum of expenditure line items ($${calculatedSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}). Difference: $${Math.abs(calculatedSum - statedTotal).toFixed(2)}`,
          ruleDescription: 'Financial Schedule Cross-Check: Total Expenditures == Sum(Line Expenditures)',
          actualValue: totalExpField.value,
        });
      }
    }
  }

  // 3. Cross-reference Net Surplus / Deficit
  const netBalanceField = Array.from(allFieldsMap.values()).find(
    f => f.name === 'netBalance' || f.name.toLowerCase().includes('netsurplus') || f.name.toLowerCase().includes('netdeficit')
  );
  if (netBalanceField && totalRevField && totalExpField) {
    const rev = parseCurrencyOrNumber(totalRevField.value);
    const exp = parseCurrencyOrNumber(totalExpField.value);
    const net = parseCurrencyOrNumber(netBalanceField.value);
    const expectedNet = rev - exp;

    if (Math.abs(expectedNet - net) > 0.05) {
      errors.push({
        id: `${netBalanceField.id}_balance_mismatch`,
        fieldId: netBalanceField.id,
        fieldName: netBalanceField.name,
        fieldCaption: netBalanceField.caption,
        subformName: netBalanceField.parentSubform,
        severity: 'error',
        ruleType: 'financial_balance',
        message: `Net Surplus/Deficit ($${net.toLocaleString('en-US', { minimumFractionDigits: 2 })}) does not equal Total Revenues minus Total Expenditures ($${expectedNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}).`,
        ruleDescription: 'Accounting Integrity Constraint: Net Balance == Revenues - Expenditures',
        actualValue: netBalanceField.value,
      });
    }

    // High deficit warning
    if (rev > 0 && exp > rev * 1.25) {
      errors.push({
        id: `${totalExpField.id}_deficit_warning`,
        fieldId: totalExpField.id,
        fieldName: totalExpField.name,
        fieldCaption: totalExpField.caption,
        subformName: totalExpField.parentSubform,
        severity: 'warning',
        ruleType: 'custom_logic',
        message: `Expenditures exceed total revenues by more than 25%. A formal budget variance explanation may be required by the program officer.`,
        ruleDescription: 'Program Risk Policy: Expenditure Variance Threshold',
        actualValue: totalExpField.value,
      });
    }
  }

  // 4. Performance metrics non-negative checks
  const performanceFields = Array.from(allFieldsMap.values()).filter(
    f => f.parentSubform?.toLowerCase().includes('performance') || f.name.toLowerCase().includes('titlespublished') || f.name.toLowerCase().includes('staff')
  );
  performanceFields.forEach(f => {
    const num = parseCurrencyOrNumber(f.value);
    if (num < 0) {
      errors.push({
        id: `${f.id}_negative_metric`,
        fieldId: f.id,
        fieldName: f.name,
        fieldCaption: f.caption,
        subformName: f.parentSubform,
        severity: 'error',
        ruleType: 'range',
        message: `Metric cannot be negative.`,
        ruleDescription: 'Statistical Metric Constraint',
        actualValue: f.value,
      });
    }
  });

  return errors;
}

export interface ValidationReport {
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
  allIssues: ValidationError[];
  fieldErrorMap: Map<string, ValidationError[]>;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
}

/**
 * Executes the complete validation engine on all fields and subforms
 */
export function validateAllFields(fields: XFAField[]): ValidationReport {
  const allFieldsMap = new Map<string, XFAField>();
  fields.forEach(f => allFieldsMap.set(f.id, f));

  const fieldErrorMap = new Map<string, ValidationError[]>();
  const allIssues: ValidationError[] = [];

  // Validate individual field rules
  fields.forEach(field => {
    const issues = validateField(field, allFieldsMap);
    if (issues.length > 0) {
      fieldErrorMap.set(field.id, issues);
      allIssues.push(...issues);
    }
  });

  // Validate form-wide & cross-field constraints
  const formWideIssues = validateFormWideConstraints(allFieldsMap);
  formWideIssues.forEach(issue => {
    const existing = fieldErrorMap.get(issue.fieldId) || [];
    // prevent duplicate id
    if (!existing.some(e => e.id === issue.id)) {
      existing.push(issue);
      fieldErrorMap.set(issue.fieldId, existing);
      allIssues.push(issue);
    }
  });

  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const infos = allIssues.filter(i => i.severity === 'info');

  return {
    errors,
    warnings,
    infos,
    allIssues,
    fieldErrorMap,
    isValid: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
  };
}

/**
 * Attempts a Quick-Fix for common formatting issues:
 * - Auto-formatting postal code to A1A 1A1
 * - Standardizing phone numbers to (XXX) XXX-XXXX
 * - Standardizing dates to YYYY-MM-DD
 * - Fixing numeric commas
 */
export function quickFixFieldValue(field: XFAField, error: ValidationError): string | null {
  const val = field.value?.trim() || '';
  if (!val) return null;

  if (error.ruleType === 'postal_code') {
    // E.g. "k1a0b4" -> "K1A 0B4"
    const cleaned = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleaned.length === 6) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    }
  }

  if (error.ruleType === 'phone') {
    const digits = val.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
  }

  if (error.ruleType === 'fiscal_year') {
    const digits = val.replace(/\D/g, '');
    if (digits.length === 4) {
      const year = parseInt(digits, 10);
      return `${year}-${year + 1}`;
    }
    if (digits.length === 8) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
  }

  // CRA Business Number quick-fix
  if (error.id.includes('cra_bn') || field.name.toLowerCase().includes('cra') || field.name.toLowerCase().includes('bus_num')) {
    const digits = val.replace(/\D/g, '');
    if (digits.length === 9) {
      return digits;
    }
  }

  // Calendar Date Standardizer (to ISO YYYY-MM-DD)
  if (error.id.includes('date') || error.ruleType === 'picture_pattern' && field.type === 'date') {
    const isoSlashMatch = val.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoSlashMatch) {
      const y = isoSlashMatch[1];
      const m = isoSlashMatch[2].padStart(2, '0');
      const d = isoSlashMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const usMatch = val.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (usMatch) {
      const first = parseInt(usMatch[1], 10);
      const second = parseInt(usMatch[2], 10);
      const y = usMatch[3];
      let m = first;
      let d = second;
      if (first > 12 && second <= 12) {
        d = first;
        m = second;
      }
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const contiguous = val.replace(/\D/g, '');
    if (contiguous.length === 8) {
      const y = contiguous.slice(0, 4);
      const m = contiguous.slice(4, 6);
      const d = contiguous.slice(6, 8);
      if (parseInt(y, 10) >= 1900 && parseInt(m, 10) <= 12 && parseInt(d, 10) <= 31) {
        return `${y}-${m}-${d}`;
      }
    }
  }

  // Email Quick Fix: trim spaces & lowercase
  if (error.ruleType === 'email') {
    const trimmed = val.trim().toLowerCase().replace(/\s+/g, '');
    if (EMAIL_REGEX.test(trimmed)) {
      return trimmed;
    }
  }

  // Numeric Range Clamping & Symbol Cleanup
  if (error.ruleType === 'range' || field.type === 'numeric') {
    const num = parseCurrencyOrNumber(val);
    if (!isNaN(num)) {
      if (field.validation?.minValue !== undefined && num < field.validation.minValue) {
        return String(field.validation.minValue);
      }
      if (field.validation?.maxValue !== undefined && num > field.validation.maxValue) {
        return String(field.validation.maxValue);
      }
      return String(num);
    }
  }

  if (error.ruleType === 'financial_balance' && field.name === 'netBalance') {
    // Can calculate balance directly
    return null; // calculated via caller
  }

  return null;
}
