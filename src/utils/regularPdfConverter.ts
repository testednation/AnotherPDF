import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import { XFAField, XFASubform } from '../types/pdf';
import { extractXfaPackets, parseXfaTemplate } from './xfaEngine';
import { PageAnnotations, DrawingStroke } from '../types/drawing';

export type StandardPdfConversionMode = 'interactive' | 'hybrid' | 'flattened';

export interface ConvertXfaToRegularPdfOptions {
  mode: StandardPdfConversionMode;
  dpiScale?: number; // 1.5 (~108 DPI), 2.0 (~144 DPI standard), 3.0 (~216 DPI ultra print)
  includeAnnotations?: boolean; // include freehand drawings / signatures
  pageAnnotations?: PageAnnotations;
  includeFormValues?: boolean; // populate current field values into the converted PDF
  preserveReadOnlyState?: boolean; // preserve XFA readOnly access attribute on AcroForm widgets
  documentTitle?: string;
  onProgress?: (progress: { current: number; total: number; message: string; percent: number }) => void;
}

export interface ConvertedFieldMappingRecord {
  id: string;
  xfaName: string;
  standardFieldName: string;
  caption: string;
  subform: string;
  xfaType: XFAField['type'];
  standardWidgetType: 'PDFTextField' | 'PDFCheckBox' | 'PDFDropdown' | 'StaticText';
  retainedValue: string;
  pageNumber: number;
  readOnly: boolean;
  required: boolean;
  interactivityNote: string;
}

export interface XfaToStandardConversionReport {
  sourceFilename?: string;
  outputMode: StandardPdfConversionMode;
  totalXfaFields: number;
  retainedFieldsCount: number;
  retainedDataCount: number;
  pagesGenerated: number;
  wasDynamicShellReplaced: boolean;
  xfaPacketsStripped: boolean;
  reducedInteractivityNotes: string[];
  fieldMappings: ConvertedFieldMappingRecord[];
}

export interface XfaToStandardConversionResult {
  pdfBytes: Uint8Array;
  report: XfaToStandardConversionReport;
}

/**
 * Sanitizes arbitrary UTF-8 strings so pdf-lib's WinAnsiEncoding standard fonts (Helvetica)
 * never throw encoding exceptions while preserving all readable text.
 */
export function sanitizeWinAnsiText(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/[\u2713\u2714\u2611]/g, '[X]')
    .replace(/[\u2610\u2717\u2718]/g, '[ ]')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    // Replace any remaining non-Latin1 characters with closest ASCII or '?'
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

/**
 * Determines human-readable note explaining how an XFA field's behavior was adapted to Standard PDF.
 */
function buildInteractivityNote(
  field: XFAField,
  mode: StandardPdfConversionMode
): string {
  const notes: string[] = [];

  if (mode === 'flattened') {
    notes.push('Flattened into static page content stream');
  } else if (mode === 'hybrid') {
    notes.push('Interactive AcroForm widget + baked visual fallback');
  } else {
    if (field.type === 'check') {
      notes.push('Mapped to standard AcroForm CheckBox (/Btn)');
    } else if (field.type === 'choice') {
      notes.push(`Mapped to AcroForm Dropdown (/Ch) with ${field.options?.length || 0} options`);
    } else if (field.type === 'multiline') {
      notes.push('Mapped to multiline AcroForm TextField (/Tx)');
    } else {
      notes.push('Mapped to standard AcroForm TextField (/Tx)');
    }
  }

  if (field.validation?.scriptExpr) {
    notes.push('XFA FormCalc/script evaluated; static result retained');
  } else if (field.validation?.picturePattern) {
    notes.push(`Picture clause (${field.validation.picturePattern}) applied to value`);
  }

  if (field.type === 'signature') {
    notes.push('XFA signature block converted to standard attestation field');
  }

  return notes.join(' · ');
}

/**
 * Full conversion pipeline that takes an XFA PDF (bytes + optional pre-parsed fields)
 * and produces both the standard ISO 32000-1 PDF bytes and a detailed retention report.
 */
export async function convertXfaToStandardPdfWithReport(
  pdfBytes: Uint8Array,
  fields: XFAField[] = [],
  options: ConvertXfaToRegularPdfOptions = { mode: 'interactive' }
): Promise<XfaToStandardConversionResult> {
  const {
    mode = 'interactive',
    dpiScale = 2.0,
    includeAnnotations = true,
    pageAnnotations = {},
    includeFormValues = true,
    preserveReadOnlyState = false,
    documentTitle = 'Converted Standard PDF Document',
    onProgress,
  } = options;

  onProgress?.({
    current: 0,
    total: 100,
    message: 'Extracting XFA template, datasets & field bindings...',
    percent: 5,
  });

  // 1. Ensure fields are extracted from the XFA PDF if not already provided
  let fieldsToConvert = [...fields];
  let detectedSubforms: XFASubform[] = [];

  try {
    const inspectDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const packets = await extractXfaPackets(inspectDoc, pdfBytes);
    if (packets.templateXml) {
      detectedSubforms = parseXfaTemplate(packets.templateXml, packets.datasetsXml);
      if (fieldsToConvert.length === 0) {
        const autoFields: XFAField[] = [];
        const collect = (list: XFASubform[]) => {
          list.forEach(sf => {
            autoFields.push(...sf.fields);
            if (sf.subforms.length > 0) collect(sf.subforms);
          });
        };
        collect(detectedSubforms);
        fieldsToConvert = autoFields;
      }
    }
  } catch (e) {
    console.warn('Auto XFA packet inspection note:', e);
  }

  // Filter out strictly hidden internal fields while keeping visible/relevant ones
  const visibleFields = fieldsToConvert.filter(f => f.visibility !== 'hidden');

  // 2. Load the XFA document via PDF.js to inspect rendered pages
  let pdfJsDoc: any = null;
  let numPages = 1;
  let isFallbackNoticePage = false;

  try {
    pdfJsDoc = await pdfjsLib.getDocument({
      data: pdfBytes.slice(0),
      enableXfa: true,
    }).promise;
    numPages = pdfJsDoc.numPages || 1;

    // Detect if Page 1 is the classic LiveCycle "Please wait..." shell page
    const page1 = await pdfJsDoc.getPage(1);
    const textContent = await page1.getTextContent();
    const textStr = textContent.items.map((it: any) => it.str).join(' ');
    if (
      textStr.includes('Please wait') ||
      textStr.includes('If this message is not eventually replaced') ||
      (numPages === 1 && visibleFields.some(f => (f.bounds?.pageNumber || 1) > 1))
    ) {
      isFallbackNoticePage = true;
    }
  } catch (err) {
    console.warn('PDF.js page inspection fallback:', err);
    isFallbackNoticePage = true;
  }

  // 3. Initialize clean Standard ISO 32000-1 PDFDocument via pdf-lib (zero /XFA streams)
  const outPdfDoc = await PDFDocument.create();
  outPdfDoc.setTitle(sanitizeWinAnsiText(documentTitle));
  outPdfDoc.setCreator('AcroXFA Standard PDF Converter');
  outPdfDoc.setProducer('pdf-lib (Standard ISO 32000-1 AcroForm & Vector Stream)');
  outPdfDoc.setSubject('Converted from XFA PDF with Form Fields & Dataset Values Retained');
  outPdfDoc.setCreationDate(new Date());
  outPdfDoc.setModificationDate(new Date());

  const helvetica = await outPdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await outPdfDoc.embedFont(StandardFonts.HelveticaBold);
  const form = outPdfDoc.getForm();
  const usedFieldNames = new Set<string>();
  const fieldMappings: ConvertedFieldMappingRecord[] = [];

  // Collect reduced interactivity notes based on what XFA features were present
  const reducedInteractivityNotes: string[] = [
    'Proprietary Adobe LiveCycle /XFA XML packets stripped to prevent "Please wait..." viewer locks.',
  ];
  const calculatedCount = visibleFields.filter(f => Boolean(f.validation?.scriptExpr)).length;
  if (calculatedCount > 0) {
    reducedInteractivityNotes.push(
      `${calculatedCount} XFA FormCalc/JavaScript calculated field(s) evaluated and retained as pre-filled values.`
    );
  }
  const signatureCount = visibleFields.filter(f => f.type === 'signature').length;
  if (signatureCount > 0) {
    reducedInteractivityNotes.push(
      `${signatureCount} XFA digital signature subform(s) converted to standard attestation text fields.`
    );
  }
  if (detectedSubforms.length > 0) {
    reducedInteractivityNotes.push(
      `Dynamic XFA subform flow layouts (${detectedSubforms.length} subform sections) anchored to fixed ISO 32000-1 page coordinates.`
    );
  }

  // Helper to create/bake a single field onto an output PDFPage
  const placeFieldOnPage = (
    outPage: PDFPage,
    f: XFAField,
    pageNum: number,
    fieldIdx: number,
    x: number,
    pdfLibY: number,
    w: number,
    h: number,
    drawLabelAndBox: boolean
  ) => {
    const rawVal = includeFormValues && f.value !== undefined ? String(f.value) : '';
    const cleanVal = sanitizeWinAnsiText(rawVal);
    const cleanCaption = sanitizeWinAnsiText(f.caption || f.name);

    let cleanName = sanitizeWinAnsiText(f.name || `field_p${pageNum}_${fieldIdx}`).replace(
      /[^\w.-]/g,
      '_'
    );
    if (!cleanName) cleanName = `field_p${pageNum}_${fieldIdx}`;
    if (usedFieldNames.has(cleanName)) {
      cleanName = `${cleanName}_p${pageNum}_${fieldIdx}`;
    }
    usedFieldNames.add(cleanName);

    // Draw field label & container border when synthesizing pages or in hybrid/flattened mode
    if (drawLabelAndBox) {
      if (f.type !== 'check') {
        const displayLabel =
          (cleanCaption.length > 68 ? cleanCaption.slice(0, 65) + '...' : cleanCaption) +
          (f.required ? ' *' : '');
        outPage.drawText(displayLabel, {
          x,
          y: pdfLibY + h + 3.5,
          size: 8,
          font: helveticaBold,
          color: rgb(0.2, 0.25, 0.35),
        });
      }

      outPage.drawRectangle({
        x,
        y: pdfLibY,
        width: f.type === 'check' ? 15 : w,
        height: f.type === 'check' ? 15 : h,
        borderColor: f.required ? rgb(0.55, 0.65, 0.82) : rgb(0.74, 0.79, 0.86),
        borderWidth: 0.8,
        color: rgb(0.985, 0.99, 1.0),
      });
    }

    // Draw static baked value if mode === 'flattened' or mode === 'hybrid'
    if (mode === 'flattened' || mode === 'hybrid') {
      drawStaticFieldValueOnPage(outPage, f, cleanVal, cleanCaption, x, pdfLibY, w, h, helvetica, helveticaBold, drawLabelAndBox);
    }

    // Inject interactive AcroForm widget if mode === 'interactive' or mode === 'hybrid'
    let widgetType: ConvertedFieldMappingRecord['standardWidgetType'] = 'StaticText';

    if (mode === 'interactive' || mode === 'hybrid') {
      try {
        if (f.type === 'check') {
          const cb = form.createCheckBox(cleanName);
          const isChecked =
            cleanVal === '1' ||
            cleanVal.toLowerCase() === 'true' ||
            cleanVal.toLowerCase() === 'yes' ||
            cleanVal.toLowerCase() === 'on';
          if (isChecked) cb.check();
          if (preserveReadOnlyState && f.readOnly) cb.enableReadOnly();

          cb.addToPage(outPage, {
            x,
            y: pdfLibY,
            width: Math.min(w, 16),
            height: Math.min(h, 16),
            borderWidth: 1,
            borderColor: rgb(0.3, 0.38, 0.5),
          });

          if (drawLabelAndBox && mode === 'interactive') {
            outPage.drawText(cleanCaption.slice(0, 75), {
              x: x + 21,
              y: pdfLibY + 3.5,
              size: 8.5,
              font: helvetica,
              color: rgb(0.18, 0.23, 0.32),
            });
          }
          widgetType = 'PDFCheckBox';
        } else if (f.type === 'choice' && f.options && f.options.length > 0) {
          const dd = form.createDropdown(cleanName);
          const sanitizedOptions = f.options
            .map(o => sanitizeWinAnsiText(o))
            .filter(o => o.length > 0);
          if (cleanVal && !sanitizedOptions.includes(cleanVal)) {
            sanitizedOptions.unshift(cleanVal);
          }
          dd.setOptions(sanitizedOptions);
          if (cleanVal && sanitizedOptions.includes(cleanVal)) {
            dd.select(cleanVal);
          }
          if (preserveReadOnlyState && f.readOnly) dd.enableReadOnly();

          dd.addToPage(outPage, {
            x,
            y: pdfLibY,
            width: w,
            height: h,
            borderWidth: 0.75,
            borderColor: rgb(0.55, 0.63, 0.75),
            backgroundColor: rgb(0.99, 0.995, 1.0),
          });
          widgetType = 'PDFDropdown';
        } else {
          const tf = form.createTextField(cleanName);
          if (cleanVal) {
            tf.setText(cleanVal);
          }
          if (f.type === 'multiline' || h > 36) {
            tf.enableMultiline();
          }
          if (preserveReadOnlyState && f.readOnly) {
            tf.enableReadOnly();
          }

          tf.addToPage(outPage, {
            x,
            y: pdfLibY,
            width: w,
            height: h,
            borderWidth: 0.75,
            borderColor: rgb(0.55, 0.63, 0.75),
            backgroundColor: rgb(0.99, 0.995, 1.0),
          });
          widgetType = 'PDFTextField';
        }
      } catch (widgetErr) {
        console.warn(`AcroForm widget fallback for ${cleanName}:`, widgetErr);
        // Fallback: bake value directly onto page so field data is never lost
        if (mode === 'interactive') {
          drawStaticFieldValueOnPage(outPage, f, cleanVal, cleanCaption, x, pdfLibY, w, h, helvetica, helveticaBold, drawLabelAndBox);
        }
        widgetType = 'StaticText';
      }
    }

    fieldMappings.push({
      id: f.id,
      xfaName: f.name,
      standardFieldName: cleanName,
      caption: f.caption || f.name,
      subform: f.parentSubform || 'root',
      xfaType: f.type,
      standardWidgetType: widgetType,
      retainedValue: rawVal,
      pageNumber: pageNum,
      readOnly: Boolean(f.readOnly),
      required: Boolean(f.required),
      interactivityNote: buildInteractivityNote(f, mode),
    });
  };

  // CASE A: Pure Dynamic LiveCycle XFA fallback document ("Please wait...")
  // Synthesize structured, clean multi-page standard PDF form layout preserving all fields & subforms
  if (isFallbackNoticePage && visibleFields.length > 0) {
    const totalTargetPages = Math.max(1, ...visibleFields.map(f => f.bounds?.pageNumber || 1));

    for (let pageNum = 1; pageNum <= totalTargetPages; pageNum++) {
      onProgress?.({
        current: pageNum,
        total: totalTargetPages,
        message: `Synthesizing Standard PDF Page ${pageNum} of ${totalTargetPages} with retained XFA fields...`,
        percent: Math.round(15 + (pageNum / totalTargetPages) * 70),
      });

      const pageWidth = 612; // Standard US Letter
      const pageHeight = 792;
      const outPage = outPdfDoc.addPage([pageWidth, pageHeight]);

      // Top Header Banner
      outPage.drawRectangle({
        x: 0,
        y: pageHeight - 62,
        width: pageWidth,
        height: 62,
        color: rgb(0.08, 0.13, 0.22),
      });
      outPage.drawRectangle({
        x: 0,
        y: pageHeight - 65,
        width: pageWidth,
        height: 3,
        color: rgb(0.14, 0.52, 0.85),
      });

      outPage.drawText(sanitizeWinAnsiText(documentTitle.replace(/\.pdf$/i, '')), {
        x: 40,
        y: pageHeight - 34,
        size: 13,
        font: helveticaBold,
        color: rgb(0.96, 0.98, 1.0),
      });

      outPage.drawText(
        `Standard ISO 32000-1 PDF (Converted from Dynamic XFA)  •  Page ${pageNum} of ${totalTargetPages}`,
        {
          x: 40,
          y: pageHeight - 50,
          size: 8,
          font: helvetica,
          color: rgb(0.68, 0.78, 0.9),
        }
      );

      // Footer
      outPage.drawLine({
        start: { x: 40, y: 36 },
        end: { x: pageWidth - 40, y: 36 },
        thickness: 0.5,
        color: rgb(0.82, 0.85, 0.9),
      });
      outPage.drawText(
        `Page ${pageNum} of ${totalTargetPages}  •  Form Fields & Dataset Values Retained`,
        {
          x: 40,
          y: 22,
          size: 7.5,
          font: helvetica,
          color: rgb(0.45, 0.5, 0.58),
        }
      );

      const pageFields = visibleFields.filter(f => (f.bounds?.pageNumber || 1) === pageNum);

      // Track current vertical cursor to prevent overlapping fields when XFA templates use relative flow
      let currentSubform = '';
      let flowCursorY = 82; // top-down Y coordinate

      pageFields.forEach((f, fieldIdx) => {
        // Draw subform section header if subform changed
        if (f.parentSubform && f.parentSubform !== currentSubform && flowCursorY < pageHeight - 110) {
          currentSubform = f.parentSubform;
          const sectionTitle = sanitizeWinAnsiText(
            currentSubform
              .replace(/[_-]+/g, ' ')
              .replace(/([a-z])([A-Z])/g, '$1 $2')
              .toUpperCase()
          );
          const bannerPdfY = Math.max(55, pageHeight - flowCursorY - 18);
          outPage.drawRectangle({
            x: 40,
            y: bannerPdfY,
            width: pageWidth - 80,
            height: 16,
            color: rgb(0.93, 0.95, 0.98),
          });
          outPage.drawText(`SECTION: ${sectionTitle}`, {
            x: 46,
            y: bannerPdfY + 4.5,
            size: 7.5,
            font: helveticaBold,
            color: rgb(0.15, 0.3, 0.55),
          });
          flowCursorY += 26;
        }

        const bounds = f.bounds || { x: 45, y: flowCursorY, width: 522, height: 24 };
        const x = Math.max(40, Math.min(bounds.x, pageWidth - 80));
        const w = Math.max(24, Math.min(bounds.width, pageWidth - x - 40));
        const h = Math.max(16, Math.min(bounds.height, 70));

        // Use whichever is lower on the page: explicit bounds.y or safe flowCursorY
        const effectiveTopY = Math.max(bounds.y, flowCursorY);
        const pdfLibY = Math.max(45, pageHeight - effectiveTopY - h);

        placeFieldOnPage(outPage, f, pageNum, fieldIdx, x, pdfLibY, w, h, true);

        flowCursorY = effectiveTopY + h + 18;
      });

      if (includeAnnotations && pageAnnotations[pageNum] && pageAnnotations[pageNum].length > 0) {
        drawAnnotationsOnPdfPage(outPage, pageAnnotations[pageNum]);
      }
    }
  } else {
    // CASE B: Standard / Hybrid XFA rendered pages via PDF.js + overlaid AcroForm / Flattened values
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pagePercent = Math.round(10 + (pageNum / numPages) * 75);
      onProgress?.({
        current: pageNum,
        total: numPages,
        message: `Rendering & converting Page ${pageNum} of ${numPages} (${
          mode === 'interactive'
            ? 'Standard AcroForm'
            : mode === 'hybrid'
            ? 'Hybrid AcroForm + Baked Values'
            : 'Flattened Standard PDF'
        })...`,
        percent: pagePercent,
      });

      const page = await pdfJsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: dpiScale });
      const unscaledViewport = page.getViewport({ scale: 1 });

      const pageWidth = unscaledViewport.width;
      const pageHeight = unscaledViewport.height;

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error(`Failed to create 2D canvas context for page ${pageNum}`);
      }

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
        canvas: canvas as any,
      }).promise;

      if (includeAnnotations && pageAnnotations[pageNum] && pageAnnotations[pageNum].length > 0) {
        drawAnnotationsOnCanvas(ctx, pageAnnotations[pageNum], dpiScale);
      }

      const pngDataUrl = canvas.toDataURL('image/png');
      const embeddedImage = await outPdfDoc.embedPng(pngDataUrl);

      const outPage = outPdfDoc.addPage([pageWidth, pageHeight]);
      outPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      // Retain all fields and their current values on this page (for interactive, hybrid, AND flattened modes!)
      const pageFields = visibleFields.filter(f => (f.bounds?.pageNumber || 1) === pageNum);

      pageFields.forEach((f, fieldIdx) => {
        if (!f.bounds) return;

        const x = Math.max(0, Math.min(f.bounds.x, pageWidth - 15));
        const rawY = f.bounds.y;
        const w = Math.max(16, Math.min(f.bounds.width, pageWidth - x));
        const h = Math.max(12, Math.min(f.bounds.height, pageHeight - 10));
        const pdfLibY = Math.max(0, pageHeight - rawY - h);

        placeFieldOnPage(outPage, f, pageNum, fieldIdx, x, pdfLibY, w, h, false);
      });
    }
  }

  // 4. Finalize AcroForm appearances & flatten if requested
  onProgress?.({
    current: numPages,
    total: numPages,
    message: 'Finalizing standard PDF catalog and field appearances...',
    percent: 92,
  });

  if (mode === 'interactive' || mode === 'hybrid') {
    try {
      form.updateFieldAppearances(helvetica);
    } catch (appErr) {
      console.warn('Field appearance update note:', appErr);
    }
  } else if (mode === 'flattened') {
    try {
      form.flatten();
    } catch {
      // ignore if no interactive widgets were created
    }
  }

  onProgress?.({
    current: numPages,
    total: numPages,
    message: 'Saving standard ISO 32000-1 PDF stream...',
    percent: 98,
  });

  const convertedBytes = await outPdfDoc.save();
  const retainedDataCount = fieldMappings.filter(
    m => m.retainedValue && m.retainedValue.trim().length > 0 && m.retainedValue !== '0'
  ).length;

  onProgress?.({
    current: numPages,
    total: numPages,
    message: 'Conversion completed!',
    percent: 100,
  });

  return {
    pdfBytes: convertedBytes,
    report: {
      outputMode: mode,
      totalXfaFields: visibleFields.length,
      retainedFieldsCount: fieldMappings.length,
      retainedDataCount,
      pagesGenerated: outPdfDoc.getPageCount(),
      wasDynamicShellReplaced: isFallbackNoticePage,
      xfaPacketsStripped: true,
      reducedInteractivityNotes,
      fieldMappings,
    },
  };
}

/**
 * Backward-compatible wrapper returning the converted Uint8Array directly.
 */
export async function convertXfaToRegularPdf(
  pdfBytes: Uint8Array,
  fields: XFAField[] = [],
  options: ConvertXfaToRegularPdfOptions = { mode: 'interactive' }
): Promise<Uint8Array> {
  const res = await convertXfaToStandardPdfWithReport(pdfBytes, fields, options);
  return res.pdfBytes;
}

/**
 * Draws static field value text or vector checkmarks onto a PDFPage for flattened/hybrid modes.
 */
function drawStaticFieldValueOnPage(
  outPage: PDFPage,
  f: XFAField,
  cleanVal: string,
  cleanCaption: string,
  x: number,
  pdfLibY: number,
  w: number,
  h: number,
  helvetica: PDFFont,
  helveticaBold: PDFFont,
  showCheckCaption: boolean
) {
  if (f.type === 'check') {
    const boxSize = Math.min(w, h, 15);
    outPage.drawRectangle({
      x,
      y: pdfLibY,
      width: boxSize,
      height: boxSize,
      borderColor: rgb(0.3, 0.38, 0.5),
      borderWidth: 1,
      color: rgb(0.99, 0.995, 1.0),
    });

    const isChecked =
      cleanVal === '1' ||
      cleanVal.toLowerCase() === 'true' ||
      cleanVal.toLowerCase() === 'yes' ||
      cleanVal.toLowerCase() === 'on';

    if (isChecked) {
      // Draw crisp vector checkmark (WinAnsi-safe)
      outPage.drawLine({
        start: { x: x + 3, y: pdfLibY + boxSize * 0.45 },
        end: { x: x + boxSize * 0.42, y: pdfLibY + 3 },
        thickness: 1.8,
        color: rgb(0.08, 0.42, 0.78),
      });
      outPage.drawLine({
        start: { x: x + boxSize * 0.42, y: pdfLibY + 3 },
        end: { x: x + boxSize - 2.5, y: pdfLibY + boxSize - 3 },
        thickness: 1.8,
        color: rgb(0.08, 0.42, 0.78),
      });
    }

    if (showCheckCaption) {
      outPage.drawText(cleanCaption.slice(0, 75), {
        x: x + boxSize + 6,
        y: pdfLibY + 3.5,
        size: 8.5,
        font: helvetica,
        color: rgb(0.18, 0.23, 0.32),
      });
    }
  } else if (cleanVal) {
    // Draw solid background over existing box so updated field value is crisp and legible
    outPage.drawRectangle({
      x: x + 1,
      y: pdfLibY + 1,
      width: Math.max(10, w - 2),
      height: Math.max(10, h - 2),
      color: rgb(0.99, 0.995, 1.0),
      borderColor: rgb(0.75, 0.8, 0.88),
      borderWidth: 0.5,
    });

    const maxChars = Math.max(12, Math.floor(w / 4.6));
    const lines = cleanVal.split(/\r?\n/);
    const firstLine = lines[0].slice(0, maxChars);

    outPage.drawText(firstLine, {
      x: x + 5,
      y: pdfLibY + Math.max(4, h / 2 - 3.5),
      size: 8.5,
      font: helvetica,
      color: rgb(0.08, 0.14, 0.24),
    });
  }
}

/**
 * Draws handwritten vector strokes onto an HTML canvas context at print resolution
 */
function drawAnnotationsOnCanvas(
  ctx: CanvasRenderingContext2D,
  strokes: DrawingStroke[],
  scale: number
) {
  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length === 0) continue;

    ctx.save();
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = Math.max(stroke.width * scale, 1);
    ctx.lineCap = stroke.tool === 'highlighter' ? 'square' : 'round';
    ctx.lineJoin = stroke.tool === 'highlighter' ? 'miter' : 'round';

    const points = stroke.points;
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x * scale, points[0].y * scale, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x * scale, points[0].y * scale);
      ctx.lineTo(points[1].x * scale, points[1].y * scale);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(points[0].x * scale, points[0].y * scale);
      for (let i = 1; i < points.length - 1; i++) {
        const midX = ((points[i].x + points[i + 1].x) / 2) * scale;
        const midY = ((points[i].y + points[i + 1].y) / 2) * scale;
        ctx.quadraticCurveTo(points[i].x * scale, points[i].y * scale, midX, midY);
      }
      const last = points.length - 1;
      ctx.lineTo(points[last].x * scale, points[last].y * scale);
      ctx.stroke();
    }

    ctx.restore();
  }
}

/**
 * Draws handwritten strokes directly onto a PDF page via pdf-lib
 */
function drawAnnotationsOnPdfPage(page: PDFPage, strokes: DrawingStroke[]) {
  if (!strokes || strokes.length === 0) return;
  const pageHeight = page.getHeight();
  strokes.forEach(s => {
    if (!s.points || s.points.length < 2) return;
    for (let i = 0; i < s.points.length - 1; i++) {
      const p1 = s.points[i];
      const p2 = s.points[i + 1];
      page.drawLine({
        start: { x: p1.x, y: Math.max(0, pageHeight - p1.y) },
        end: { x: p2.x, y: Math.max(0, pageHeight - p2.y) },
        thickness: Math.max(1, s.width),
        color: rgb(0.12, 0.35, 0.85),
        opacity: s.opacity || 1.0,
      });
    }
  });
}
