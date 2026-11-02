import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import { XFAField } from '../types/pdf';
import { DrawingStroke } from '../types/drawing';
import {
  PaperSizeId,
  PaperSizeSpec,
  PrintScaleOptions,
  ComputedScaleMetrics,
  MarginPreset,
} from '../types/printScale';

export const PAPER_SIZE_CATALOG: Record<PaperSizeId, PaperSizeSpec> = {
  letter: {
    id: 'letter',
    name: 'US Letter',
    shortLabel: '8.5 × 11 in',
    region: 'North America (ANSI)',
    widthPt: 612,
    heightPt: 792,
    widthIn: 8.5,
    heightIn: 11.0,
    widthMm: 215.9,
    heightMm: 279.4,
    description: 'Standard North American business & government form size (ANSI A)',
  },
  legal: {
    id: 'legal',
    name: 'US Legal',
    shortLabel: '8.5 × 14 in',
    region: 'North America (ANSI)',
    widthPt: 612,
    heightPt: 1008,
    widthIn: 8.5,
    heightIn: 14.0,
    widthMm: 215.9,
    heightMm: 355.6,
    description: 'Extended legal contract, statutory & regulatory filing sheet',
  },
  tabloid: {
    id: 'tabloid',
    name: 'Tabloid / Ledger',
    shortLabel: '11 × 17 in',
    region: 'North America (ANSI)',
    widthPt: 792,
    heightPt: 1224,
    widthIn: 11.0,
    heightIn: 17.0,
    widthMm: 279.4,
    heightMm: 431.8,
    description: 'Wide-format ledger & financial spread sheet (ANSI B)',
  },
  executive: {
    id: 'executive',
    name: 'Executive',
    shortLabel: '7.25 × 10.5 in',
    region: 'North America (ANSI)',
    widthPt: 522,
    heightPt: 756,
    widthIn: 7.25,
    heightIn: 10.5,
    widthMm: 184.2,
    heightMm: 266.7,
    description: 'Executive stationery & memo format',
  },
  statement: {
    id: 'statement',
    name: 'Statement (Half Letter)',
    shortLabel: '5.5 × 8.5 in',
    region: 'North America (ANSI)',
    widthPt: 396,
    heightPt: 612,
    widthIn: 5.5,
    heightIn: 8.5,
    widthMm: 139.7,
    heightMm: 215.9,
    description: 'Compact booklet, voucher & half-sheet invoice format',
  },
  a4: {
    id: 'a4',
    name: 'ISO A4',
    shortLabel: '210 × 297 mm',
    region: 'International (ISO)',
    widthPt: 595.28,
    heightPt: 841.89,
    widthIn: 8.27,
    heightIn: 11.69,
    widthMm: 210.0,
    heightMm: 297.0,
    description: 'International standard document & printer paper size (ISO 216)',
  },
  a3: {
    id: 'a3',
    name: 'ISO A3',
    shortLabel: '297 × 420 mm',
    region: 'International (ISO)',
    widthPt: 841.89,
    heightPt: 1190.55,
    widthIn: 11.69,
    heightIn: 16.54,
    widthMm: 297.0,
    heightMm: 420.0,
    description: 'International wide-format spread & engineering table size',
  },
  a5: {
    id: 'a5',
    name: 'ISO A5',
    shortLabel: '148 × 210 mm',
    region: 'International (ISO)',
    widthPt: 419.53,
    heightPt: 595.28,
    widthIn: 5.83,
    heightIn: 8.27,
    widthMm: 148.0,
    heightMm: 210.0,
    description: 'Compact international booklet & receipt sheet (half A4)',
  },
  b4: {
    id: 'b4',
    name: 'JIS B4',
    shortLabel: '257 × 364 mm',
    region: 'JIS / Archival',
    widthPt: 728.5,
    heightPt: 1031.81,
    widthIn: 10.12,
    heightIn: 14.33,
    widthMm: 257.0,
    heightMm: 364.0,
    description: 'East Asian official ledger & archival form size',
  },
  b5: {
    id: 'b5',
    name: 'JIS B5',
    shortLabel: '182 × 257 mm',
    region: 'JIS / Archival',
    widthPt: 515.91,
    heightPt: 728.5,
    widthIn: 7.17,
    heightIn: 10.12,
    widthMm: 182.0,
    heightMm: 257.0,
    description: 'Standard compact academic & administrative form size',
  },
  ansi_c: {
    id: 'ansi_c',
    name: 'ANSI C (Engineering)',
    shortLabel: '17 × 22 in',
    region: 'North America (ANSI)',
    widthPt: 1224,
    heightPt: 1584,
    widthIn: 17.0,
    heightIn: 22.0,
    widthMm: 431.8,
    heightMm: 558.8,
    description: 'Large architectural & schematic broadsheet',
  },
  custom: {
    id: 'custom',
    name: 'Custom Printer Size',
    shortLabel: 'User Defined',
    region: 'Custom',
    widthPt: 612,
    heightPt: 792,
    widthIn: 8.5,
    heightIn: 11.0,
    widthMm: 215.9,
    heightMm: 279.4,
    description: 'Custom physical width and height for specialized printers',
  },
};

export interface PopularScalePreset {
  id: string;
  label: string;
  badge: string;
  sourceId: PaperSizeId;
  targetId: PaperSizeId;
  description: string;
}

export const POPULAR_SCALE_PRESETS: PopularScalePreset[] = [
  {
    id: 'letter_to_a4',
    label: 'US Letter → ISO A4',
    badge: '94.0% Fit',
    sourceId: 'letter',
    targetId: 'a4',
    description: 'Scale North American 8.5×11" forms to print cleanly on European/International A4 printers without horizontal edge clipping.',
  },
  {
    id: 'a4_to_letter',
    label: 'ISO A4 → US Letter',
    badge: '94.0% Fit',
    sourceId: 'a4',
    targetId: 'letter',
    description: 'Scale taller International A4 documents (297mm height) to fit onto standard 11" US Letter trays without bottom footer cutoff.',
  },
  {
    id: 'legal_to_letter',
    label: 'US Legal → US Letter',
    badge: '78.6% Fit',
    sourceId: 'legal',
    targetId: 'letter',
    description: 'Compress 8.5×14" legal statutory forms onto standard 8.5×11" office printer trays.',
  },
  {
    id: 'legal_to_a4',
    label: 'US Legal → ISO A4',
    badge: '83.5% Fit',
    sourceId: 'legal',
    targetId: 'a4',
    description: 'Convert 14-inch US Legal filings to standard ISO A4 paper.',
  },
  {
    id: 'tabloid_to_letter',
    label: 'Tabloid (11×17) → US Letter',
    badge: '64.7% Fit',
    sourceId: 'tabloid',
    targetId: 'letter',
    description: 'Scale wide-format 11×17" ledger tables down to standard 8.5×11" sheets.',
  },
  {
    id: 'a3_to_a4',
    label: 'ISO A3 → ISO A4',
    badge: '70.7% Fit',
    sourceId: 'a3',
    targetId: 'a4',
    description: 'Standard ISO √2 reduction from A3 spread down to A4 printer paper.',
  },
  {
    id: 'letter_to_statement',
    label: 'US Letter → Half-Letter',
    badge: '64.7% Fit',
    sourceId: 'letter',
    targetId: 'statement',
    description: 'Reduce full-page forms to compact 5.5×8.5" statement booklets.',
  },
];

export function getMarginPtFromPreset(preset: MarginPreset, customPt = 24): number {
  switch (preset) {
    case 'none':
      return 0;
    case 'minimal':
      return 18; // 0.25 in (6.35 mm)
    case 'standard':
      return 36; // 0.50 in (12.7 mm)
    case 'wide':
      return 54; // 0.75 in (19.05 mm)
    case 'custom':
      return Math.max(0, Math.min(144, customPt));
  }
}

/**
 * Matches raw PDF page dimensions in points (72 pt = 1 inch) to the closest known paper size.
 */
export function detectPaperSizeFromPoints(
  widthPt: number,
  heightPt: number
): { matchedSpec: PaperSizeSpec; isLandscape: boolean; exactMatch: boolean } {
  const normW = Math.min(widthPt, heightPt);
  const normH = Math.max(widthPt, heightPt);
  const isLandscape = widthPt > heightPt;

  let bestSpec = PAPER_SIZE_CATALOG.letter;
  let minDiff = Infinity;

  (Object.values(PAPER_SIZE_CATALOG) as PaperSizeSpec[]).forEach(spec => {
    if (spec.id === 'custom') return;
    const diff = Math.hypot(spec.widthPt - normW, spec.heightPt - normH);
    if (diff < minDiff) {
      minDiff = diff;
      bestSpec = spec;
    }
  });

  return {
    matchedSpec: bestSpec,
    isLandscape,
    exactMatch: minDiff < 8, // Within ~2.8mm tolerance
  };
}

/**
 * Computes exact X/Y scaling factors, printable margins, and target placement coordinates.
 */
export function computeScaleMetrics(
  actualSourceW: number,
  actualSourceH: number,
  options: PrintScaleOptions
): ComputedScaleMetrics {
  // 1. Determine effective source dimensions
  let sourceWidthPt = actualSourceW || 612;
  let sourceHeightPt = actualSourceH || 792;

  if (options.sourceSizeId !== 'auto_detected') {
    if (options.sourceSizeId === 'custom') {
      sourceWidthPt = options.sourceCustomWidthPt || actualSourceW;
      sourceHeightPt = options.sourceCustomHeightPt || actualSourceH;
    } else {
      const spec = PAPER_SIZE_CATALOG[options.sourceSizeId];
      const sourceIsLandscape = actualSourceW > actualSourceH;
      sourceWidthPt = sourceIsLandscape ? spec.heightPt : spec.widthPt;
      sourceHeightPt = sourceIsLandscape ? spec.widthPt : spec.heightPt;
    }
  }

  // 2. Determine target sheet dimensions
  const targetSpec = PAPER_SIZE_CATALOG[options.targetSizeId] || PAPER_SIZE_CATALOG.a4;
  const baseTargetW =
    options.targetSizeId === 'custom' ? options.targetCustomWidthPt : targetSpec.widthPt;
  const baseTargetH =
    options.targetSizeId === 'custom' ? options.targetCustomHeightPt : targetSpec.heightPt;

  const minDim = Math.min(baseTargetW, baseTargetH);
  const maxDim = Math.max(baseTargetW, baseTargetH);

  let targetSheetWidthPt = minDim;
  let targetSheetHeightPt = maxDim;

  if (options.targetOrientation === 'landscape') {
    targetSheetWidthPt = maxDim;
    targetSheetHeightPt = minDim;
  } else if (options.targetOrientation === 'portrait') {
    targetSheetWidthPt = minDim;
    targetSheetHeightPt = maxDim;
  } else {
    // 'auto': match source orientation
    if (sourceWidthPt > sourceHeightPt) {
      targetSheetWidthPt = maxDim;
      targetSheetHeightPt = minDim;
    } else {
      targetSheetWidthPt = minDim;
      targetSheetHeightPt = maxDim;
    }
  }

  // 3. Printable area after applying printer margins
  const marginPt = getMarginPtFromPreset(options.marginPreset, options.customMarginPt);
  const printableWidthPt = Math.max(72, targetSheetWidthPt - marginPt * 2);
  const printableHeightPt = Math.max(72, targetSheetHeightPt - marginPt * 2);

  // 4. Calculate scaleX and scaleY according to selected scalingMode
  let scaleX = 1;
  let scaleY = 1;

  const fitPrintableRatio = Math.min(
    printableWidthPt / sourceWidthPt,
    printableHeightPt / sourceHeightPt
  );
  const fitFullSheetRatio = Math.min(
    targetSheetWidthPt / sourceWidthPt,
    targetSheetHeightPt / sourceHeightPt
  );
  const fillPrintableRatio = Math.max(
    printableWidthPt / sourceWidthPt,
    printableHeightPt / sourceHeightPt
  );

  switch (options.scalingMode) {
    case 'fit_printable':
      scaleX = fitPrintableRatio;
      scaleY = fitPrintableRatio;
      break;
    case 'fit_full_page':
      scaleX = fitFullSheetRatio;
      scaleY = fitFullSheetRatio;
      break;
    case 'shrink_only':
      scaleX = Math.min(1.0, fitPrintableRatio);
      scaleY = Math.min(1.0, fitPrintableRatio);
      break;
    case 'fill_page':
      scaleX = fillPrintableRatio;
      scaleY = fillPrintableRatio;
      break;
    case 'stretch_exact':
      scaleX = printableWidthPt / sourceWidthPt;
      scaleY = printableHeightPt / sourceHeightPt;
      break;
    case 'actual_size':
      scaleX = 1.0;
      scaleY = 1.0;
      break;
    case 'custom_scale': {
      const factor = Math.max(0.1, Math.min(4.0, options.customScalePercent / 100));
      scaleX = factor;
      scaleY = factor;
      break;
    }
  }

  const renderedWidthPt = sourceWidthPt * scaleX;
  const renderedHeightPt = sourceHeightPt * scaleY;

  // 5. Calculate X/Y offset on target sheet (in PDF points from bottom-left origin)
  let offsetXPt = marginPt + (printableWidthPt - renderedWidthPt) / 2;
  let offsetYPt = marginPt + (printableHeightPt - renderedHeightPt) / 2;

  if (options.scalingMode === 'fit_full_page') {
    offsetXPt = (targetSheetWidthPt - renderedWidthPt) / 2;
    offsetYPt = (targetSheetHeightPt - renderedHeightPt) / 2;
  } else if (options.alignment === 'top_left') {
    offsetXPt = marginPt;
    offsetYPt = targetSheetHeightPt - marginPt - renderedHeightPt;
  } else if (options.alignment === 'top_center') {
    offsetXPt = marginPt + (printableWidthPt - renderedWidthPt) / 2;
    offsetYPt = targetSheetHeightPt - marginPt - renderedHeightPt;
  }

  const effectiveScalePercent = Math.round(((scaleX + scaleY) / 2) * 1000) / 10;

  const clipsContent =
    renderedWidthPt > targetSheetWidthPt + 1 || renderedHeightPt > targetSheetHeightPt + 1;

  const sourceAspect = sourceWidthPt / sourceHeightPt;
  const targetAspect = targetSheetWidthPt / targetSheetHeightPt;
  const aspectRatioDeltaPercent =
    Math.round((Math.abs(sourceAspect - targetAspect) / sourceAspect) * 1000) / 10;

  return {
    sourceWidthPt,
    sourceHeightPt,
    targetSheetWidthPt,
    targetSheetHeightPt,
    marginPt,
    printableWidthPt,
    printableHeightPt,
    scaleX,
    scaleY,
    effectiveScalePercent,
    renderedWidthPt,
    renderedHeightPt,
    offsetXPt,
    offsetYPt,
    clipsContent,
    aspectRatioDeltaPercent,
  };
}

/**
 * Generates a new PDF document where every page is scaled from its source paper size
 * onto the selected Target Printer Paper Size, preserving crisp visuals, freehand annotations,
 * and optionally rescaling interactive AcroForm fields.
 */
export async function generateScaledPrintPdf(
  pdfBytes: Uint8Array,
  fields: XFAField[],
  options: PrintScaleOptions,
  onProgress?: (info: { current: number; total: number; message: string; percent: number }) => void
): Promise<{
  bytes: Uint8Array;
  metrics: ComputedScaleMetrics;
  pageCount: number;
}> {
  // 1. Load source PDF via PDF.js with XFA enabled
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes.slice(0),
    enableXfa: true,
  });
  const pdfJsDoc = await loadingTask.promise;
  const numPages = pdfJsDoc.numPages;

  // 2. Create output PDFDocument
  const outPdfDoc = await PDFDocument.create();
  const helveticaFont = await outPdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await outPdfDoc.embedFont(StandardFonts.HelveticaBold);

  const targetSpec = PAPER_SIZE_CATALOG[options.targetSizeId] || PAPER_SIZE_CATALOG.a4;
  outPdfDoc.setTitle(`${targetSpec.name} Scaled Printout`);
  outPdfDoc.setProducer('AcroXFA Print & Paper Size Scaling Engine (ISO 32000-1)');
  outPdfDoc.setCreator('AcroXFA Studio');

  const form = options.outputMode === 'interactive' ? outPdfDoc.getForm() : null;
  const usedFieldNames = new Set<string>();

  let firstPageMetrics: ComputedScaleMetrics | null = null;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) {
      onProgress({
        current: pageNum,
        total: numPages,
        message: `Scaling page ${pageNum} of ${numPages} to ${targetSpec.name} (${targetSpec.shortLabel})...`,
        percent: Math.round(((pageNum - 1) / numPages) * 85),
      });
    }

    const page = await pdfJsDoc.getPage(pageNum);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const renderViewport = page.getViewport({ scale: options.dpiScale });

    const metrics = computeScaleMetrics(
      unscaledViewport.width,
      unscaledViewport.height,
      options
    );
    if (!firstPageMetrics) {
      firstPageMetrics = metrics;
    }

    // Render source page at high DPI to an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(renderViewport.width);
    canvas.height = Math.round(renderViewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(`Failed to initialize 2D canvas for page ${pageNum}`);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport: renderViewport,
      canvas: canvas as any,
    }).promise;

    // Burn in freehand annotations if enabled
    if (
      options.includeAnnotations &&
      options.pageAnnotations &&
      options.pageAnnotations[pageNum]?.length
    ) {
      drawAnnotationsOnCanvas(ctx, options.pageAnnotations[pageNum], options.dpiScale);
    }

    // If flattened mode and includeFormValues is true, also ensure custom field values are burned in
    if (options.outputMode === 'flattened' && options.includeFormValues) {
      const pageFields = fields.filter(f => (f.bounds?.pageNumber || 1) === pageNum);
      drawFlattenedFieldValuesOnCanvas(ctx, pageFields, options.dpiScale);
    }

    const pngDataUrl = canvas.toDataURL('image/png');
    const embeddedImage = await outPdfDoc.embedPng(pngDataUrl);

    // Add target-sized sheet to output PDF
    const pdfPage = outPdfDoc.addPage([
      metrics.targetSheetWidthPt,
      metrics.targetSheetHeightPt,
    ]);

    // Draw scaled page image onto target sheet
    pdfPage.drawImage(embeddedImage, {
      x: metrics.offsetXPt,
      y: metrics.offsetYPt,
      width: metrics.renderedWidthPt,
      height: metrics.renderedHeightPt,
    });

    // Optional: Draw printer trim / registration crop marks around the scaled page boundary
    if (options.includeCropMarks) {
      drawPrinterCropMarks(pdfPage, metrics);
    }

    // Optional: Draw calibration scale footer in bottom margin
    if (options.includeScaleFooter) {
      const sourceDetected = detectPaperSizeFromPoints(
        unscaledViewport.width,
        unscaledViewport.height
      );
      const footerText = `Scaled Printout: ${sourceDetected.matchedSpec.name} (${sourceDetected.matchedSpec.shortLabel}) -> ${targetSpec.name} (${targetSpec.shortLabel}) | Scale: ${metrics.effectiveScalePercent}% | Page ${pageNum}/${numPages}`;
      pdfPage.drawText(footerText, {
        x: Math.max(14, metrics.marginPt),
        y: 8,
        size: 6.5,
        font: helveticaFont,
        color: rgb(0.42, 0.46, 0.52),
      });
    }

    // Optional: Inject rescaled interactive AcroForm fields onto the target sheet
    if (options.outputMode === 'interactive' && form) {
      const pageFields = fields.filter(f => (f.bounds?.pageNumber || 1) === pageNum);
      for (const field of pageFields) {
        if (!field.bounds) continue;

        const baseName =
          field.name.replace(/[^a-zA-Z0-9_.-]/g, '_') || `field_p${pageNum}`;
        let uniqueName = baseName;
        let idx = 1;
        while (usedFieldNames.has(uniqueName)) {
          uniqueName = `${baseName}_${idx++}`;
        }
        usedFieldNames.add(uniqueName);

        // Source field top-left coordinates in points
        const srcX = field.bounds.x;
        const srcY = field.bounds.y;
        const srcW = Math.max(12, field.bounds.width);
        const srcH = Math.max(10, field.bounds.height);

        // Transform field geometry into Target Sheet bottom-left PDF coordinates
        const scaledW = srcW * metrics.scaleX;
        const scaledH = srcH * metrics.scaleY;
        const scaledX = metrics.offsetXPt + srcX * metrics.scaleX;
        // In source page, (srcY + srcH) is distance from top of source page to bottom of field
        const distFromSourceBottom =
          unscaledViewport.height - srcY - srcH;
        const scaledY = metrics.offsetYPt + distFromSourceBottom * metrics.scaleY;

        try {
          if (field.type === 'check') {
            const checkBox = form.createCheckBox(uniqueName);
            const boxSize = Math.min(scaledW, scaledH, 16);
            checkBox.addToPage(pdfPage, {
              x: scaledX + (scaledW - boxSize) / 2,
              y: scaledY + (scaledH - boxSize) / 2,
              width: boxSize,
              height: boxSize,
              borderWidth: 1,
              borderColor: rgb(0.25, 0.35, 0.5),
            });
            if (
              options.includeFormValues &&
              (field.value === '1' ||
                field.value?.toLowerCase() === 'true' ||
                field.value?.toLowerCase() === 'yes')
            ) {
              checkBox.check();
            }
          } else if (
            field.type === 'choice' &&
            field.options &&
            field.options.length > 0
          ) {
            const dropdown = form.createDropdown(uniqueName);
            dropdown.addOptions(field.options);
            if (options.includeFormValues && field.value) {
              if (!field.options.includes(field.value)) {
                dropdown.addOptions([field.value]);
              }
              dropdown.select(field.value);
            }
            dropdown.addToPage(pdfPage, {
              x: scaledX,
              y: scaledY,
              width: scaledW,
              height: scaledH,
              font: helveticaFont,
              borderWidth: 0.75,
              borderColor: rgb(0.6, 0.68, 0.78),
            });
          } else {
            const textField = form.createTextField(uniqueName);
            if (options.includeFormValues && field.value) {
              textField.setText(field.value);
            }
            if (field.type === 'multiline' || scaledH > 32) {
              textField.enableMultiline();
            }
            textField.addToPage(pdfPage, {
              x: scaledX,
              y: scaledY,
              width: scaledW,
              height: scaledH,
              font:
                field.appearance?.fontWeight === 'bold'
                  ? helveticaBold
                  : helveticaFont,
              borderWidth: 0.5,
              borderColor: rgb(0.65, 0.72, 0.82),
              backgroundColor: rgb(0.98, 0.99, 1.0),
            });
            const baseFontSize = field.appearance?.fontSize || 9.5;
            const scaledFontSize = Math.max(
              6,
              Math.min(16, Math.round(baseFontSize * metrics.scaleY * 10) / 10)
            );
            textField.setFontSize(scaledFontSize);
          }
        } catch (fieldErr) {
          console.warn(`Skipped field ${uniqueName} during scaling:`, fieldErr);
        }
      }
    }
  }

  if (onProgress) {
    onProgress({
      current: numPages,
      total: numPages,
      message: 'Finalizing scaled PDF document stream...',
      percent: 96,
    });
  }

  const outBytes = await outPdfDoc.save();

  if (onProgress) {
    onProgress({
      current: numPages,
      total: numPages,
      message: 'Scaled printout PDF ready!',
      percent: 100,
    });
  }

  return {
    bytes: outBytes,
    metrics:
      firstPageMetrics ||
      computeScaleMetrics(612, 792, options),
    pageCount: numPages,
  };
}

function drawPrinterCropMarks(pdfPage: any, metrics: ComputedScaleMetrics) {
  const markLen = 12;
  const markGap = 4;
  const left = metrics.offsetXPt;
  const right = metrics.offsetXPt + metrics.renderedWidthPt;
  const bottom = metrics.offsetYPt;
  const top = metrics.offsetYPt + metrics.renderedHeightPt;
  const markColor = rgb(0.2, 0.25, 0.35);

  // Bottom-Left corner
  pdfPage.drawLine({
    start: { x: left - markGap - markLen, y: bottom },
    end: { x: left - markGap, y: bottom },
    thickness: 0.5,
    color: markColor,
  });
  pdfPage.drawLine({
    start: { x: left, y: bottom - markGap - markLen },
    end: { x: left, y: bottom - markGap },
    thickness: 0.5,
    color: markColor,
  });

  // Bottom-Right corner
  pdfPage.drawLine({
    start: { x: right + markGap, y: bottom },
    end: { x: right + markGap + markLen, y: bottom },
    thickness: 0.5,
    color: markColor,
  });
  pdfPage.drawLine({
    start: { x: right, y: bottom - markGap - markLen },
    end: { x: right, y: bottom - markGap },
    thickness: 0.5,
    color: markColor,
  });

  // Top-Left corner
  pdfPage.drawLine({
    start: { x: left - markGap - markLen, y: top },
    end: { x: left - markGap, y: top },
    thickness: 0.5,
    color: markColor,
  });
  pdfPage.drawLine({
    start: { x: left, y: top + markGap },
    end: { x: left, y: top + markGap + markLen },
    thickness: 0.5,
    color: markColor,
  });

  // Top-Right corner
  pdfPage.drawLine({
    start: { x: right + markGap, y: top },
    end: { x: right + markGap + markLen, y: top },
    thickness: 0.5,
    color: markColor,
  });
  pdfPage.drawLine({
    start: { x: right, y: top + markGap },
    end: { x: right, y: top + markGap + markLen },
    thickness: 0.5,
    color: markColor,
  });
}

function drawAnnotationsOnCanvas(
  ctx: CanvasRenderingContext2D,
  strokes: DrawingStroke[],
  scale: number
) {
  ctx.save();
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * scale;
    ctx.globalAlpha = stroke.opacity;

    if (stroke.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
    }

    ctx.beginPath();
    const pts = stroke.points;
    if (pts.length === 1) {
      ctx.arc(
        pts[0].x * scale,
        pts[0].y * scale,
        (stroke.width * scale) / 2,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = stroke.color;
      ctx.fill();
    } else {
      ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = ((pts[i].x + pts[i + 1].x) / 2) * scale;
        const midY = ((pts[i].y + pts[i + 1].y) / 2) * scale;
        ctx.quadraticCurveTo(
          pts[i].x * scale,
          pts[i].y * scale,
          midX,
          midY
        );
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x * scale, last.y * scale);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawFlattenedFieldValuesOnCanvas(
  ctx: CanvasRenderingContext2D,
  pageFields: XFAField[],
  scale: number
) {
  ctx.save();
  for (const field of pageFields) {
    if (!field.bounds || !field.value || field.value.trim() === '') continue;
    const x = field.bounds.x * scale;
    const y = field.bounds.y * scale;
    const w = field.bounds.width * scale;
    const h = field.bounds.height * scale;

    if (field.type === 'check') {
      if (
        field.value === '1' ||
        field.value.toLowerCase() === 'true' ||
        field.value.toLowerCase() === 'yes'
      ) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.22, y + h * 0.52);
        ctx.lineTo(x + w * 0.44, y + h * 0.74);
        ctx.lineTo(x + w * 0.78, y + h * 0.26);
        ctx.stroke();
      }
    } else {
      const fontSize = (field.appearance?.fontSize || 9.5) * scale;
      ctx.font = `${field.appearance?.fontWeight === 'bold' ? 'bold ' : ''}${fontSize}px sans-serif`;
      ctx.fillStyle = field.appearance?.textColor || '#0f172a';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 2 * scale, y, Math.max(10, w - 4 * scale), h);
      ctx.clip();
      ctx.fillText(field.value, x + 4 * scale, y + h / 2);
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * Triggers native browser print dialog using an embedded hidden PDF iframe.
 */
export function triggerBrowserPrintPdf(pdfBytes: Uint8Array) {
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  const existingIframe = document.getElementById('acroxfa-print-iframe');
  if (existingIframe) {
    existingIframe.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'acroxfa-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.src = blobUrl;

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn('Direct iframe print fallback:', e);
      window.print();
    }
  };

  document.body.appendChild(iframe);
}
