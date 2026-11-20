export interface CustomFieldRegexRule {
  fieldId: string;
  fieldName: string;
  fieldCaption: string;
  subformName?: string;
  pattern: string;
  flags: string; // '' or 'i'
  message: string;
  enabled: boolean;
  updatedAt: string;
}

export interface RegexPreset {
  id: string;
  label: string;
  pattern: string;
  flags: string;
  defaultMessage: string;
  exampleValid: string;
  exampleInvalid: string;
}

export const CUSTOM_REGEX_PRESETS: RegexPreset[] = [
  {
    id: 'email',
    label: 'Email Address',
    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    flags: 'i',
    defaultMessage: 'Must be a valid email address (e.g. name@company.com).',
    exampleValid: 'alex@company.com',
    exampleInvalid: 'alex@invalid',
  },
  {
    id: 'iso_date',
    label: 'ISO Date (YYYY-MM-DD)',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$',
    flags: '',
    defaultMessage: 'Date must match YYYY-MM-DD format (e.g. 2026-11-19).',
    exampleValid: '2026-11-19',
    exampleInvalid: '11/19/2026',
  },
  {
    id: 'ein_tax_id',
    label: 'Tax ID / EIN (XX-XXXXXXX)',
    pattern: '^\\d{2}-\\d{7}$',
    flags: '',
    defaultMessage: 'Tax ID must follow XX-XXXXXXX format (e.g. 12-9840213).',
    exampleValid: '12-9840213',
    exampleInvalid: '129840213',
  },
  {
    id: 'phone_na',
    label: 'Phone Number',
    pattern: '^(\\+?1[-.\\s]?)?(\\(?\\d{3}\\)?[-.\\s]?)?\\d{3}[-.\\s]?\\d{4}$',
    flags: '',
    defaultMessage: 'Phone number must be a valid 10-digit North American number.',
    exampleValid: '+1 (212) 555-0199',
    exampleInvalid: '555-12',
  },
  {
    id: 'postal_ca',
    label: 'Canadian Postal Code',
    pattern: '^[A-Za-z]\\d[A-Za-z][ -]?\\d[A-Za-z]\\d$',
    flags: 'i',
    defaultMessage: 'Postal code must match A1A 1A1 format.',
    exampleValid: 'K1A 0B4',
    exampleInvalid: '12345',
  },
  {
    id: 'zip_us',
    label: 'US ZIP Code',
    pattern: '^\\d{5}(-\\d{4})?$',
    flags: '',
    defaultMessage: 'ZIP code must be 5 digits or ZIP+4 (e.g. 10001-1234).',
    exampleValid: '10001',
    exampleInvalid: '1000A',
  },
  {
    id: 'currency',
    label: 'Currency / Amount',
    pattern: '^\\$?\\d{1,3}(,\\d{3})*(\\.\\d{1,2})?$|^\\$?\\d+(\\.\\d{1,2})?$',
    flags: '',
    defaultMessage: 'Must be a valid non-negative monetary amount (e.g. 24500.00).',
    exampleValid: '$24,500.00',
    exampleInvalid: 'USD 24k',
  },
  {
    id: 'code_id',
    label: 'Reference Code (ABC-1234)',
    pattern: '^[A-Z]{2,5}-\\d{3,6}$',
    flags: '',
    defaultMessage: 'Reference code must be 2-5 uppercase letters, hyphen, and 3-6 digits.',
    exampleValid: 'CBF-20261',
    exampleInvalid: 'cbf_12',
  },
  {
    id: 'alpha_name',
    label: 'Letters & Spaces Only',
    pattern: "^[A-Za-z\\s'.-]+$",
    flags: '',
    defaultMessage: 'Field may only contain alphabetic characters, spaces, apostrophes, or hyphens.',
    exampleValid: 'Marcus Sterling',
    exampleInvalid: 'Marcus 123!',
  },
];

export interface RegexSyntaxResult {
  valid: boolean;
  regex?: RegExp;
  error?: string;
}

/**
 * Safely compiles a user-defined regex string and optional flags.
 */
export function compileCustomRegex(pattern: string, flags = ''): RegexSyntaxResult {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return { valid: false, error: 'Regex pattern cannot be empty.' };
  }
  const safeFlags = flags.replace(/[^gimsuy]/g, '');
  try {
    const regex = new RegExp(trimmed, safeFlags);
    return { valid: true, regex };
  } catch (err: any) {
    return {
      valid: false,
      error: err?.message || 'Invalid regular expression syntax.',
    };
  }
}

export interface CustomRuleEvaluation {
  status: 'pass' | 'violation' | 'empty' | 'disabled' | 'invalid_regex';
  message?: string;
}

/**
 * Evaluates a field value against a CustomFieldRegexRule.
 */
export function evaluateCustomRegexRule(
  rule: CustomFieldRegexRule | undefined | null,
  rawValue: string
): CustomRuleEvaluation {
  if (!rule || !rule.enabled) {
    return { status: 'disabled' };
  }
  const val = rawValue !== undefined && rawValue !== null ? String(rawValue).trim() : '';
  if (!val) {
    return { status: 'empty' };
  }

  const compiled = compileCustomRegex(rule.pattern, rule.flags);
  if (!compiled.valid || !compiled.regex) {
    return { status: 'invalid_regex', message: compiled.error };
  }

  if (compiled.regex.test(val)) {
    return { status: 'pass' };
  }

  return {
    status: 'violation',
    message:
      rule.message?.trim() ||
      `Value "${val}" does not match custom pattern /${rule.pattern}/${rule.flags || ''}`,
  };
}
