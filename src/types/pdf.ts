export interface XFABounds {
  pageNumber: number; // 1-indexed
  x: number; // in PDF points from left edge
  y: number; // in PDF points from top edge
  width: number; // in PDF points
  height: number; // in PDF points
  rawX?: string; // original raw string e.g. "10mm" or "0.5in"
  rawY?: string;
  rawW?: string;
  rawH?: string;
}

export interface XFAFieldAppearance {
  borderColor: string;
  borderWidth: number; // 0, 1, 2, 3
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none';
  backgroundColor: string; // hex or 'transparent'
  textColor: string;
  fontSize: number; // in pt
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  captionPlacement: 'top' | 'left' | 'none';
  cornerRadius: number; // in px
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface XFACrossFieldConstraint {
  relatedFieldIds?: string[];
  description: string;
  type: 'sum_equals' | 'greater_than_or_equal' | 'required_if_checked' | 'balance_check';
}

export interface XFAValidationRule {
  nullTest?: 'error' | 'warning' | 'disabled';
  message?: string;
  picturePattern?: string; // e.g. "date{YYYY-MM-DD}", "text{A9A 9A9}", "num{99999.99}"
  regexPattern?: string;
  minValue?: number;
  maxValue?: number;
  scriptExpr?: string; // FormCalc or JS validation script
  businessConstraint?: string;
  crossFieldConstraint?: XFACrossFieldConstraint;
}

export interface ValidationError {
  id: string;
  fieldId: string;
  fieldName: string;
  fieldCaption: string;
  subformName?: string;
  severity: ValidationSeverity;
  ruleType:
    | 'required'
    | 'picture_pattern'
    | 'regex'
    | 'range'
    | 'email'
    | 'phone'
    | 'postal_code'
    | 'fiscal_year'
    | 'financial_balance'
    | 'script'
    | 'cross_field'
    | 'custom_logic';
  message: string;
  ruleDescription?: string;
  expectedPattern?: string;
  actualValue: string;
}

export interface XFAField {
  id: string;
  name: string;
  caption: string;
  type: 'text' | 'multiline' | 'numeric' | 'choice' | 'check' | 'date' | 'signature' | 'unknown';
  value: string;
  defaultValue?: string;
  dataRef?: string;
  parentSubform?: string;
  options?: string[]; // for choiceList
  required?: boolean;
  readOnly?: boolean;
  visibility?: 'visible' | 'invisible' | 'hidden';
  tooltip?: string;
  format?: string;
  rawXmlSnippet?: string;
  bounds?: XFABounds;
  appearance?: XFAFieldAppearance;
  validation?: XFAValidationRule;
}

export interface XFASubform {
  id: string;
  name: string;
  title: string;
  fields: XFAField[];
  subforms: XFASubform[];
  pageNumber?: number;
}

export interface XFAPackets {
  templateXml?: string;
  datasetsXml?: string;
  configXml?: string;
  localeSetXml?: string;
  schemaXml?: string;
  fullXdpXml?: string;
  otherPackets: Record<string, string>;
}

export interface ExtractedImageResource {
  id: string;
  name: string;
  page: number;
  width: number;
  height: number;
  colorSpace: string;
  bitsPerComponent: number;
  filter: string;
  sizeBytes: number;
  format: 'jpeg' | 'png' | 'raw';
  dataUrl: string;
  blob: Blob;
  aspectRatio: string;
}

export interface ExtractedFontResource {
  id: string;
  name: string;
  baseFont: string;
  subtype: string;
  encoding?: string;
  isEmbedded: boolean;
  fontData?: Uint8Array;
  fontExtension?: 'ttf' | 'otf' | 'cff' | 'bin';
  sizeBytes?: number;
}

export interface ExtractedAttachmentResource {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  modificationDate?: string;
  data: Uint8Array;
}

export interface ExtractedTextPage {
  pageNumber: number;
  text: string;
  wordCount: number;
  lineCount: number;
}

export interface PdfDocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  pdfVersion?: string;
  pageCount: number;
  fileSizeBytes: number;
  hasXfa: boolean;
  xfaType?: 'dynamic' | 'static' | 'none';
  hasAcroForm: boolean;
  isEncrypted: boolean;
}

export interface ExtractedResourceManifest {
  images: ExtractedImageResource[];
  fonts: ExtractedFontResource[];
  attachments: ExtractedAttachmentResource[];
  textPages: ExtractedTextPage[];
  totalWords: number;
  totalCharacters: number;
  xfaPackets: XFAPackets;
  metadata: PdfDocumentMetadata;
}
