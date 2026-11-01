import { PDFDocument, PDFDict, PDFName, PDFArray } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import { XFAField } from '../types/pdf';
import {
  DetectedFormField,
  DetectionScanSummary,
  DetectionScanOptions,
  DetectionSource,
} from '../types/detection';

// Common pattern recognition dictionary for heuristic field classification
const FIELD_LABEL_PATTERNS = [
  { regex: /(?:first\s*name|given\s*name|prénom)/i, type: 'text' as const, name: 'FirstName', caption: 'First Name', confidence: 0.94 },
  { regex: /(?:last\s*name|surname|family\s*name|nom\s*de\s*famille)/i, type: 'text' as const, name: 'LastName', caption: 'Last Name', confidence: 0.94 },
  { regex: /(?:full\s*name|legal\s*name|applicant\s*name|contact\s*name)/i, type: 'text' as const, name: 'FullName', caption: 'Full Legal Name', confidence: 0.92 },
  { regex: /(?:organization|company\s*name|business\s*name|institution)/i, type: 'text' as const, name: 'Organization', caption: 'Organization / Company', confidence: 0.91 },
  { regex: /(?:email(?:\s*address)?|courriel)/i, type: 'text' as const, name: 'Email', caption: 'Email Address', confidence: 0.96 },
  { regex: /(?:phone(?:\s*number)?|telephone|téléphone|cell|mobile)/i, type: 'text' as const, name: 'Phone', caption: 'Telephone Number', confidence: 0.93 },
  { regex: /(?:fax)/i, type: 'text' as const, name: 'Fax', caption: 'Fax Number', confidence: 0.89 },
  { regex: /(?:street\s*address|mailing\s*address|address\s*line\s*1|adresse)/i, type: 'text' as const, name: 'StreetAddress', caption: 'Street Address', confidence: 0.91 },
  { regex: /(?:city|town|municipality|ville)/i, type: 'text' as const, name: 'City', caption: 'City / Municipality', confidence: 0.92 },
  { regex: /(?:province|state|territory|région)/i, type: 'text' as const, name: 'ProvinceState', caption: 'Province / State', confidence: 0.91 },
  { regex: /(?:postal\s*code|zip(?:\s*code)?|code\s*postal)/i, type: 'text' as const, name: 'PostalCode', caption: 'Postal / ZIP Code', confidence: 0.95 },
  { regex: /(?:country|pays)/i, type: 'text' as const, name: 'Country', caption: 'Country', confidence: 0.88 },
  { regex: /(?:birth\s*date|date\s*of\s*birth|dob|date\s*de\s*naissance)/i, type: 'date' as const, name: 'DateOfBirth', caption: 'Date of Birth', confidence: 0.95 },
  { regex: /(?:effective\s*date|start\s*date|commencement\s*date)/i, type: 'date' as const, name: 'StartDate', caption: 'Effective Start Date', confidence: 0.91 },
  { regex: /(?:expiry\s*date|expiration\s*date|end\s*date)/i, type: 'date' as const, name: 'EndDate', caption: 'Expiration End Date', confidence: 0.91 },
  { regex: /(?:fiscal\s*year|fiscal\s*year\s*end|exercice\s*financier)/i, type: 'date' as const, name: 'FiscalYear', caption: 'Fiscal Year Period', confidence: 0.92 },
  { regex: /(?:date\b|dated\b|date\s*:)/i, type: 'date' as const, name: 'Date', caption: 'Date', confidence: 0.87 },
  { regex: /(?:signature(?:\s*of\s*(?:applicant|recipient|officer|authorized))?|sign\s*here|signature\s*de)/i, type: 'signature' as const, name: 'Signature', caption: 'Authorized Signature', confidence: 0.96 },
  { regex: /(?:sin|social\s*insurance|ssn|social\s*security|tax\s*id|cra\s*number|business\s*number|bn\b)/i, type: 'text' as const, name: 'TaxOrIdNumber', caption: 'Registration / Tax Identification Number', confidence: 0.94 },
  { regex: /(?:total\s*revenue|gross\s*revenue|sales\s*revenue|revenu\s*total)/i, type: 'numeric' as const, name: 'TotalRevenue', caption: 'Total Revenue ($)', confidence: 0.93 },
  { regex: /(?:total\s*expenses?|operating\s*expenses?|dépenses\s*totales)/i, type: 'numeric' as const, name: 'TotalExpenses', caption: 'Total Expenses ($)', confidence: 0.93 },
  { regex: /(?:net\s*income|net\s*profit|surplus|deficit|bénéfice\s*net)/i, type: 'numeric' as const, name: 'NetIncome', caption: 'Net Income / Balance ($)', confidence: 0.92 },
  { regex: /(?:grant\s*amount|funding\s*requested|amount\s*requested|montant)/i, type: 'numeric' as const, name: 'RequestedAmount', caption: 'Funding / Grant Amount ($)', confidence: 0.92 },
  { regex: /(?:total\s*(?:amount)?|subtotal|solde)/i, type: 'numeric' as const, name: 'TotalAmount', caption: 'Total Amount ($)', confidence: 0.90 },
  { regex: /(?:comments|description|notes|remarks|project\s*summary|remarques)/i, type: 'multiline' as const, name: 'Comments', caption: 'Comments / Narrative Description', confidence: 0.89 },
];

/**
 * Scans PDF bytes and existing XFA models to detect and recognize all interactive and heuristic form fields
 */
export async function detectAllFormFields(
  pdfBytes: Uint8Array,
  knownXfaFields: XFAField[] = [],
  options: DetectionScanOptions = {}
): Promise<DetectionScanSummary> {
  const {
    includeXfa = true,
    includeAcroForm = true,
    includeHeuristics = true,
    sensitivity = 'balanced',
    pageRange = 'all',
    currentPage = 1,
  } = options;

  const detected: DetectedFormField[] = [];
  const locationKeys = new Set<string>();

  const minConfidence =
    sensitivity === 'high' ? 0.70 : sensitivity === 'conservative' ? 0.88 : 0.80;

  // 1. TIER 1: Ingest XFA Fields
  if (includeXfa && knownXfaFields.length > 0) {
    knownXfaFields.forEach(f => {
      const pageNum = f.bounds?.pageNumber || 1;
      if (pageRange === 'current' && pageNum !== currentPage) return;

      const x = f.bounds?.x || 50;
      const y = f.bounds?.y || 100;
      const width = f.bounds?.width || 200;
      const height = f.bounds?.height || (f.type === 'multiline' ? 50 : 26);

      const locKey = `${pageNum}_${Math.round(x / 10)}_${Math.round(y / 10)}`;
      locationKeys.add(locKey);

      detected.push({
        id: `detected_xfa_${f.id}`,
        name: f.name,
        caption: f.caption || f.name,
        type: f.type,
        value: f.value || '',
        pageNumber: pageNum,
        bounds: { x, y, width, height },
        confidence: 0.99,
        source: 'xfa_template',
        options: f.options,
        required: f.required,
        status: 'accepted',
        originalLabel: f.caption,
        subform: f.parentSubform,
      });
    });
  }

  // 2. TIER 2: AcroForm Widget Annotations (native standard PDF widgets)
  if (includeAcroForm) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();

      pages.forEach((page, pageIdx) => {
        const pageNum = pageIdx + 1;
        if (pageRange === 'current' && pageNum !== currentPage) return;

        const pageHeight = page.getHeight();
        const pageWidth = page.getWidth();

        // Extract native Widget annotations
        const annotsRef = page.node.get(PDFName.of('Annots'));
        if (!annotsRef) return;

        const resolvedAnnots = pdfDoc.context.lookup(annotsRef);
        if (resolvedAnnots instanceof PDFArray) {
          for (let i = 0; i < resolvedAnnots.size(); i++) {
            const annotObj = pdfDoc.context.lookup(resolvedAnnots.get(i));
            if (!(annotObj instanceof PDFDict)) continue;

            const subtype = annotObj.get(PDFName.of('Subtype'))?.toString();
            if (subtype !== '/Widget') continue;

            // Get Field Type /FT
            const ft = annotObj.get(PDFName.of('FT'))?.toString() || '';
            const t = annotObj.get(PDFName.of('T'))?.toString().replace(/^\/|\(|\)/g, '') || `acro_${pageNum}_${i}`;
            const v = annotObj.get(PDFName.of('V'))?.toString().replace(/^\/|\(|\)/g, '') || '';

            // Rect: [x1, y1, x2, y2] in PDF coordinates (bottom-left origin)
            const rectObj = annotObj.get(PDFName.of('Rect'));
            if (!(rectObj instanceof PDFArray) || rectObj.size() < 4) continue;

            const x1 = Number(rectObj.get(0)?.toString()) || 0;
            const y1 = Number(rectObj.get(1)?.toString()) || 0;
            const x2 = Number(rectObj.get(2)?.toString()) || x1 + 120;
            const y2 = Number(rectObj.get(3)?.toString()) || y1 + 24;

            const w = Math.abs(x2 - x1);
            const h = Math.abs(y2 - y1);
            // Convert to top-left coordinate origin
            const x = Math.min(x1, x2);
            const y = Math.max(0, pageHeight - Math.max(y1, y2));

            const locKey = `${pageNum}_${Math.round(x / 10)}_${Math.round(y / 10)}`;
            if (locationKeys.has(locKey)) continue; // avoid duplicate of XFA field
            locationKeys.add(locKey);

            let type: DetectedFormField['type'] = 'text';
            if (ft === '/Btn') {
              type = 'check';
            } else if (ft === '/Ch') {
              type = 'choice';
            } else if (ft === '/Sig') {
              type = 'signature';
            }

            detected.push({
              id: `detected_acro_${pageNum}_${i}`,
              name: t,
              caption: formatCleanCaption(t),
              type,
              value: v,
              pageNumber: pageNum,
              bounds: {
                x: Math.max(0, Math.min(x, pageWidth - 20)),
                y: Math.max(0, Math.min(y, pageHeight - 15)),
                width: Math.max(16, w),
                height: Math.max(14, h),
              },
              confidence: 0.96,
              source: 'acroform_widget',
              status: 'accepted',
              originalLabel: t,
            });
          }
        }
      });
    } catch (e) {
      console.warn('AcroForm annotation detection note:', e);
    }
  }

  // 3. TIER 3: Visual & Text Stream Layout Heuristics via PDF.js
  if (includeHeuristics) {
    try {
      const pdfJsDoc = await pdfjsLib.getDocument({
        data: pdfBytes.slice(0),
        enableXfa: true,
      }).promise;

      const totalPages = pdfJsDoc.numPages;

      for (let p = 1; p <= totalPages; p++) {
        if (pageRange === 'current' && p !== currentPage) continue;

        const page = await pdfJsDoc.getPage(p);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();

        const items = textContent.items as Array<{
          str: string;
          transform: number[];
          width: number;
          height: number;
        }>;

        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const text = (item.str || '').trim();
          if (!text || text.length < 2) continue;

          // Check if this text matches any known field label pattern
          for (const pattern of FIELD_LABEL_PATTERNS) {
            if (pattern.confidence < minConfidence) continue;

            if (pattern.regex.test(text)) {
              // PDF.js coordinate transform: [scaleX, skewY, skewX, scaleY, tx, ty]
              // ty is from bottom edge of page
              const tx = item.transform[4];
              const ty = item.transform[5];
              const labelW = item.width || 60;
              const labelH = Math.max(10, item.height || 12);

              // Convert ty (bottom-up) to top-down y
              const topY = Math.max(0, viewport.height - ty - labelH);

              // Target field geometry right after or below label
              let fieldX = tx + labelW + 6;
              let fieldY = topY - 2;
              let fieldW = Math.max(140, Math.min(320, viewport.width - fieldX - 36));
              let fieldH = pattern.type === 'multiline' ? 54 : (pattern.type === 'signature' ? 36 : 24);

              // Check if followed by underline characters like '____'
              const nextItem = items[idx + 1];
              if (nextItem && nextItem.str && nextItem.str.includes('___')) {
                fieldW = Math.max(120, nextItem.width || 180);
              }

              // Adjust for checkboxes
              if (text.includes('[ ]') || text.includes('( )') || text.startsWith('☐') || text.startsWith('☑')) {
                fieldW = 18;
                fieldH = 18;
                fieldX = tx;
                fieldY = topY;
              }

              // If field exceeds right page margin, place below label
              if (fieldX + fieldW > viewport.width - 24) {
                fieldX = tx;
                fieldY = topY + labelH + 4;
                fieldW = Math.max(140, viewport.width - fieldX - 40);
              }

              const locKey = `${p}_${Math.round(fieldX / 15)}_${Math.round(fieldY / 15)}`;
              if (locationKeys.has(locKey)) continue;
              locationKeys.add(locKey);

              const fieldId = `heuristic_${p}_${pattern.name}_${idx}`;

              detected.push({
                id: fieldId,
                name: `${pattern.name}_p${p}_${idx}`,
                caption: pattern.caption,
                type: pattern.type,
                value: '',
                pageNumber: p,
                bounds: {
                  x: Math.round(Math.max(20, Math.min(fieldX, viewport.width - 60))),
                  y: Math.round(Math.max(20, Math.min(fieldY, viewport.height - 30))),
                  width: Math.round(Math.max(20, fieldW)),
                  height: Math.round(fieldH),
                },
                confidence: +(pattern.confidence * 0.98).toFixed(2),
                source: 'heuristic_analysis',
                status: 'suggested',
                originalLabel: text,
              });
              break; // matched pattern, move to next text item
            }
          }
        }
      }
    } catch (e) {
      console.warn('Heuristic PDF.js text scanning note:', e);
    }
  }

  // Sort detected fields by page number then vertical position Y
  detected.sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    return a.bounds.y - b.bounds.y;
  });

  // Calculate summary metrics
  const bySource = {
    xfa: detected.filter(f => f.source === 'xfa_template').length,
    acroform: detected.filter(f => f.source === 'acroform_widget').length,
    heuristic: detected.filter(f => f.source === 'heuristic_analysis').length,
  };

  const byType: Record<string, number> = {};
  detected.forEach(f => {
    byType[f.type] = (byType[f.type] || 0) + 1;
  });

  const totalConfidence = detected.reduce((sum, f) => sum + f.confidence, 0);
  const averageConfidence = detected.length > 0 ? +(totalConfidence / detected.length).toFixed(2) : 1.0;

  const scannedPages = pageRange === 'current' ? 1 : Math.max(1, ...detected.map(f => f.pageNumber));

  return {
    scannedPages,
    totalDetected: detected.length,
    bySource,
    byType,
    averageConfidence,
    fields: detected,
  };
}

function formatCleanCaption(raw: string): string {
  return raw
    .replace(/[_\.\-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, str => str.toUpperCase());
}
