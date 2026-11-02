import { PageAnnotations } from './drawing';

export type PaperUnit = 'in' | 'mm' | 'pt';

export type PaperSizeId =
  | 'letter'
  | 'legal'
  | 'tabloid'
  | 'executive'
  | 'statement'
  | 'a3'
  | 'a4'
  | 'a5'
  | 'b4'
  | 'b5'
  | 'ansi_c'
  | 'custom';

export interface PaperSizeSpec {
  id: PaperSizeId;
  name: string;
  shortLabel: string;
  region: 'North America (ANSI)' | 'International (ISO)' | 'JIS / Archival' | 'Custom';
  widthPt: number;  // 1 inch = 72 pt
  heightPt: number;
  widthIn: number;
  heightIn: number;
  widthMm: number;
  heightMm: number;
  description: string;
}

export type PrintScalingMode =
  | 'fit_printable'     // Proportionally scale to fit inside target printable area (margins respected)
  | 'fit_full_page'     // Proportionally scale to fit full target sheet dimensions
  | 'shrink_only'       // Only shrink if source exceeds target printable area; never enlarge > 100%
  | 'fill_page'         // Scale proportionally to completely fill target printable area (may crop edges)
  | 'stretch_exact'     // Non-uniform X/Y scale to match target printable area aspect ratio
  | 'actual_size'       // 100% scale (1:1 physical dimensions, crops or pads as needed)
  | 'custom_scale';     // User-specified exact scale percentage (e.g., 78%)

export type PageOrientation = 'auto' | 'portrait' | 'landscape';

export type PageAlignment = 'center' | 'top_left' | 'top_center';

export type MarginPreset = 'none' | 'minimal' | 'standard' | 'wide' | 'custom';

export interface PrintScaleOptions {
  sourceSizeId: PaperSizeId | 'auto_detected';
  sourceCustomWidthPt?: number;
  sourceCustomHeightPt?: number;
  targetSizeId: PaperSizeId;
  targetCustomWidthPt: number;
  targetCustomHeightPt: number;
  targetOrientation: PageOrientation;
  scalingMode: PrintScalingMode;
  customScalePercent: number; // e.g. 100
  marginPreset: MarginPreset;
  customMarginPt: number; // in points (72pt = 1in)
  alignment: PageAlignment;
  includeCropMarks: boolean;
  includeScaleFooter: boolean;
  outputMode: 'flattened' | 'interactive';
  dpiScale: number; // 2.0 (150 DPI) or 3.0 (300 DPI)
  includeFormValues: boolean;
  includeAnnotations: boolean;
  pageAnnotations?: PageAnnotations;
}

export interface ComputedScaleMetrics {
  sourceWidthPt: number;
  sourceHeightPt: number;
  targetSheetWidthPt: number;
  targetSheetHeightPt: number;
  marginPt: number;
  printableWidthPt: number;
  printableHeightPt: number;
  scaleX: number;
  scaleY: number;
  effectiveScalePercent: number;
  renderedWidthPt: number;
  renderedHeightPt: number;
  offsetXPt: number; // From left of target sheet (PDF bottom-left origin & top-left canvas helper)
  offsetYPt: number; // From bottom of target sheet
  clipsContent: boolean;
  aspectRatioDeltaPercent: number;
}
