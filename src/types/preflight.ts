export type PreflightProfile =
  | 'comprehensive'
  | 'xfa-compliance'
  | 'pdfa-archival'
  | 'print-quality'
  | 'accessibility';

export type PreflightSeverity = 'error' | 'warning' | 'info' | 'passed';

export interface PreflightIssue {
  id: string;
  ruleId: string;
  ruleName: string;
  profile: PreflightProfile;
  severity: PreflightSeverity;
  message: string;
  detail: string;
  targetType: 'field' | 'font' | 'image' | 'metadata' | 'xml' | 'document';
  targetId?: string;
  targetName?: string;
  pageNumber?: number;
  suggestedFix?: string;
  autoFixable?: boolean;
  fixAction?: 'fill-field' | 'set-metadata' | 'format-xml' | 'embed-font';
}

export interface PreflightSummary {
  documentName: string;
  profile: PreflightProfile;
  timestamp: string;
  totalChecks: number;
  passedCount: number;
  errorsCount: number;
  warningsCount: number;
  noticesCount: number;
  overallStatus: 'pass' | 'warning' | 'fail';
  issues: PreflightIssue[];
}
