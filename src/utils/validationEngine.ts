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
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const CANADIAN_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
const PHONE_REGEX = /^(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}$/;
const FISCAL_YEAR_REGEX = /^\d{4}(-\d{2,4})?$/;
const CBF_PROJECT_NO_REGEX = /^(CBF-)?[A-Za-z0-9\-_]{3,24}$/i;

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
    if (!EMAIL_REGEX.test(val)) {
      errors.push({
        id: `${field.id}_email`,
        fieldId: field.id,
        fieldName: field.name,
        fieldCaption: field.caption,
        subformName: field.parentSubform,
        severity: 'error',
        ruleType: 'email',
        message: `Please enter a valid email address (e.g., user@example.ca).`,
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

  // 10. Date Format Check
  if (field.type === 'date' || nameLower.includes('date') || captionLower.includes('date')) {
    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(val);
    const isSlashDate = /^\d{2}\/\d{2}\/\d{4}$/.test(val);
    const parsedDate = Date.parse(val);
    if (!isIsoDate && !isSlashDate && isNaN(parsedDate)) {
      errors.push({
        id: `${field.id}_date_format`,
        fieldId: field.id,
        fieldName: field.name,
        fieldCaption: field.caption,
        subformName: field.parentSubform,
        severity: 'error',
        ruleType: 'picture_pattern',
        message: `Please enter a valid calendar date (YYYY-MM-DD or MM/DD/YYYY).`,
        ruleDescription: 'Calendar date validation',
        expectedPattern: 'YYYY-MM-DD',
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

  if (error.ruleType === 'financial_balance' && field.name === 'netBalance') {
    // Can calculate balance directly
    return null; // calculated via caller
  }

  return null;
}
