import { XFAField } from './pdf';

export type DetectionSource = 'xfa_template' | 'acroform_widget' | 'heuristic_analysis';

export interface DetectedFormField {
  id: string;
  name: string;
  caption: string;
  type: 'text' | 'multiline' | 'numeric' | 'choice' | 'check' | 'date' | 'signature' | 'unknown';
  value: string;
  pageNumber: number;
  bounds: {
    x: number; // in PDF points from left edge (0 to page width)
    y: number; // in PDF points from top edge (0 to page height)
    width: number;
    height: number;
  };
  confidence: number; // 0.0 to 1.0 (e.g. 0.98 = 98%)
  source: DetectionSource;
  options?: string[];
  required?: boolean;
  status: 'accepted' | 'suggested' | 'ignored';
  originalLabel?: string;
  subform?: string;
}

export interface DetectionScanSummary {
  scannedPages: number;
  totalDetected: number;
  bySource: {
    xfa: number;
    acroform: number;
    heuristic: number;
  };
  byType: Record<string, number>;
  averageConfidence: number;
  fields: DetectedFormField[];
  isDynamicXfaFallback?: boolean;
  xfaSubformsCount?: number;
}

export interface DetectionScanOptions {
  includeXfa?: boolean;
  includeAcroForm?: boolean;
  includeHeuristics?: boolean;
  sensitivity?: 'high' | 'balanced' | 'conservative';
  pageRange?: 'all' | 'current';
  currentPage?: number;
}
