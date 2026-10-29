export interface DrawingPoint {
  x: number; // in PDF points (relative to original page width)
  y: number; // in PDF points (relative to original page height)
  pressure?: number;
}

export type DrawingTool = 'pen' | 'highlighter' | 'eraser';

export interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  width: number; // in PDF points
  opacity: number;
  tool: 'pen' | 'highlighter';
  timestamp: number;
}

export interface PageAnnotations {
  [pageNumber: number]: DrawingStroke[];
}

export interface DrawingSettings {
  tool: DrawingTool;
  color: string;
  width: number; // in points: e.g. 2, 4, 8, 16
  opacity: number;
}

export const DRAWING_COLOR_PALETTE = [
  { name: 'Signature Blue', hex: '#1d4ed8', type: 'pen' },
  { name: 'Executive Black', hex: '#0f172a', type: 'pen' },
  { name: 'Audit Red', hex: '#dc2626', type: 'pen' },
  { name: 'Forest Green', hex: '#15803d', type: 'pen' },
  { name: 'Purple Ink', hex: '#7e22ce', type: 'pen' },
  { name: 'Neon Yellow', hex: '#facc15', type: 'highlighter' },
  { name: 'Electric Cyan', hex: '#38bdf8', type: 'highlighter' },
  { name: 'Mint Green', hex: '#4ade80', type: 'highlighter' },
  { name: 'Coral Pink', hex: '#fb7185', type: 'highlighter' },
];

export const STROKE_WIDTH_PRESETS = [
  { label: 'Fine (1.5pt)', value: 1.5, iconSize: 2 },
  { label: 'Medium (3pt)', value: 3, iconSize: 4 },
  { label: 'Broad (6pt)', value: 6, iconSize: 6 },
  { label: 'Highlighter (16pt)', value: 16, iconSize: 10 },
];
