import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import { XFAField, XFASubform } from '../types/pdf';
import { extractXfaPackets, parseXfaTemplate } from './xfaEngine';
import { PageAnnotations, DrawingStroke } from '../types/drawing';

export interface ConvertXfaToRegularPdfOptions {
  mode: 'interactive' | 'flattened'; // 'interactive' creates standard AcroForm fields, 'flattened' produces read-only archival PDF
  dpiScale?: number; // 1.5 (~108 DPI), 2.0 (~144 DPI standard), 3.0 (~216 DPI ultra print)
  includeAnnotations?: boolean; // include freehand drawings / signatures
  pageAnnotations?: PageAnnotations;
  includeFormValues?: boolean; // populate current field values into the converted PDF
  documentTitle?: string;
  onProgress?: (progress: { current: number; total: number; message: string; percent: number }) => void;
}

/**
 * Converts a dynamic or static XFA PDF into a 100% standard, universal regular PDF (ISO 32000-1)
 * Eliminates the Adobe LiveCycle "Please wait..." barrier so the PDF opens and functions seamlessly
 * in Google Chrome, Apple Safari, macOS Preview, Edge, Firefox, Android, and iOS.
 */
export async function convertXfaToRegularPdf(
  pdfBytes: Uint8Array,
  fields: XFAField[] = [],
  options: ConvertXfaToRegularPdfOptions = { mode: 'interactive' }
): Promise<Uint8Array> {
  const {
    mode = 'interactive',
    dpiScale = 2.0,
    includeAnnotations = true,
    pageAnnotations = {},
    includeFormValues = true,
    documentTitle = 'Converted Regular Document',
    onProgress,
  } = options;

  onProgress?.({
    current: 0,
    total: 100,
    message: 'Analyzing XFA structure & packet architecture...',
    percent: 5,
  });

  // Ensure fields are available
  let fieldsToConvert = [...fields];
  if (fieldsToConvert.length === 0) {
    try {
      const inspectDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const packets = await extractXfaPackets(inspectDoc, pdfBytes);
      if (packets.templateXml) {
        const parsedSubforms = parseXfaTemplate(packets.templateXml, packets.datasetsXml);
        const autoFields: XFAField[] = [];
        const collect = (list: XFASubform[]) => {
          list.forEach(sf => {
            autoFields.push(...sf.fields);
            if (sf.subforms.length > 0) collect(sf.subforms);
          });
        };
        collect(parsedSubforms);
        fieldsToConvert = autoFields;
      }
    } catch (e) {
      console.warn('Auto field extraction note:', e);
    }
  }

  // 1. Load the XFA document via PDF.js
  const pdfJsDoc = await pdfjsLib.getDocument({
    data: pdfBytes.slice(0),
    enableXfa: true,
  }).promise;

  const numPages = pdfJsDoc.numPages;
  if (numPages === 0) {
    throw new Error('Unable to extract rendered pages from XFA document');
  }

  // Check if this document displays the classic LiveCycle "Please wait..." fallback page
  let isFallbackNoticePage = false;
  try {
    const page1 = await pdfJsDoc.getPage(1);
    const textContent = await page1.getTextContent();
    const textStr = textContent.items.map((it: any) => it.str).join(' ');
    if (textStr.includes('Please wait') || textStr.includes('If this message is not eventually replaced')) {
      isFallbackNoticePage = true;
    }
  } catch {}

  // 2. Initialize new standard PDFDocument via pdf-lib
  const outPdfDoc = await PDFDocument.create();
  outPdfDoc.setTitle(documentTitle);
  outPdfDoc.setCreator('AcroXFA Universal PDF Engine');
  outPdfDoc.setProducer('pdf-lib (Standard ISO 32000-1 AcroForm)');
  outPdfDoc.setCreationDate(new Date());

  const helvetica = await outPdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await outPdfDoc.embedFont(StandardFonts.HelveticaBold);
  const form = outPdfDoc.getForm();
  const usedFieldNames = new Set<string>();

  // CASE A: Pure Dynamic LiveCycle XFA fallback document ("Please wait...")
  // Instead of baking the "Please wait" warning screen, synthesize genuine clean PDF form pages!
  if (isFallbackNoticePage && fieldsToConvert.length > 0) {
    const totalTargetPages = Math.max(1, ...fieldsToConvert.map(f => f.bounds?.pageNumber || 1));

    for (let pageNum = 1; pageNum <= totalTargetPages; pageNum++) {
      onProgress?.({
        current: pageNum,
        total: totalTargetPages,
        message: `Synthesizing clean standard Page ${pageNum} of ${totalTargetPages} (${mode === 'interactive' ? 'Interactive Form' : 'Flattened'})...`,
        percent: Math.round(15 + (pageNum / totalTargetPages) * 70),
      });

      const pageWidth = 612; // Standard Letter
      const pageHeight = 792;
      const outPage = outPdfDoc.addPage([pageWidth, pageHeight]);

      // Header Banner
      outPage.drawRectangle({
        x: 0,
        y: pageHeight - 65,
        width: pageWidth,
        height: 65,
        color: rgb(0.96, 0.97, 0.99),
      });
      outPage.drawLine({
        start: { x: 0, y: pageHeight - 65 },
        end: { x: pageWidth, y: pageHeight - 65 },
        thickness: 1,
        color: rgb(0.85, 0.88, 0.93),
      });

      // Document Title
      outPage.drawText(documentTitle.replace(/\.pdf$/i, ''), {
        x: 40,
        y: pageHeight - 38,
        size: 14,
        font: helveticaBold,
        color: rgb(0.1, 0.15, 0.25),
      });

      outPage.drawText(`ISO 32000-1 Universal PDF  •  Page ${pageNum} of ${totalTargetPages}`, {
        x: 40,
        y: pageHeight - 54,
        size: 8.5,
        font: helvetica,
        color: rgb(0.4, 0.45, 0.55),
      });

      // Fields for this page
      const pageFields = fieldsToConvert.filter(f => (f.bounds?.pageNumber || 1) === pageNum && f.visibility !== 'hidden');

      pageFields.forEach((f, fieldIdx) => {
        const bounds = f.bounds || { x: 50, y: 120 + fieldIdx * 45, width: 512, height: 28 };
        const x = Math.max(40, Math.min(bounds.x, pageWidth - 60));
        const rawY = bounds.y;
        const w = Math.max(20, Math.min(bounds.width, pageWidth - x - 40));
        const h = Math.max(14, Math.min(bounds.height, pageHeight - 80));

        // Top-down Y to bottom-up PDF coordinates
        const pdfLibY = Math.max(30, pageHeight - rawY - h);
        const labelY = Math.min(pageHeight - 20, pdfLibY + h + 3);

        const val = includeFormValues && f.value !== undefined ? String(f.value) : '';
        const caption = f.caption || f.name;

        // Draw Field Label
        if (f.type !== 'check') {
          const cleanCaption = caption.length > 55 ? caption.slice(0, 52) + '...' : caption;
          try {
            outPage.drawText(cleanCaption, {
              x,
              y: labelY,
              size: 8,
              font: helveticaBold,
              color: rgb(0.25, 0.3, 0.4),
            });
          } catch {}
        }

        // Draw Field Container Rectangle
        if (mode === 'flattened' || f.type === 'check') {
          outPage.drawRectangle({
            x,
            y: pdfLibY,
            width: f.type === 'check' ? 16 : w,
            height: f.type === 'check' ? 16 : h,
            borderColor: rgb(0.75, 0.8, 0.88),
            borderWidth: 0.75,
            color: rgb(0.985, 0.99, 1.0),
          });
        }

        // Handle Interactive AcroForm injection
        let cleanName = (f.name || `field_p${pageNum}_${fieldIdx}`).replace(/[^\w.-]/g, '_');
        if (usedFieldNames.has(cleanName)) {
          cleanName = `${cleanName}_${fieldIdx}`;
        }
        usedFieldNames.add(cleanName);

        if (mode === 'interactive') {
          try {
            if (f.type === 'check') {
              const cb = form.createCheckBox(cleanName);
              if (val === '1' || val === 'true' || val === 'yes' || val === 'on') {
                cb.check();
              }
              cb.addToPage(outPage, {
                x,
                y: pdfLibY,
                width: 16,
                height: 16,
                borderWidth: 1,
                borderColor: rgb(0.35, 0.4, 0.5),
              });
              // Draw check caption next to box
              outPage.drawText(caption, {
                x: x + 22,
                y: pdfLibY + 4,
                size: 8.5,
                font: helvetica,
                color: rgb(0.2, 0.25, 0.35),
              });
            } else if (f.type === 'choice' && f.options && f.options.length > 0) {
              const dd = form.createDropdown(cleanName);
              dd.setOptions(f.options);
              if (val && f.options.includes(val)) dd.select(val);
              dd.addToPage(outPage, {
                x,
                y: pdfLibY,
                width: w,
                height: h,
                borderWidth: 0.75,
                borderColor: rgb(0.65, 0.7, 0.8),
              });
            } else {
              const tf = form.createTextField(cleanName);
              if (val) tf.setText(val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''));
              if (f.type === 'multiline') tf.enableMultiline();
              tf.addToPage(outPage, {
                x,
                y: pdfLibY,
                width: w,
                height: h,
                borderWidth: 0.75,
                borderColor: rgb(0.65, 0.7, 0.8),
                backgroundColor: rgb(0.99, 0.995, 1.0),
              });
            }
          } catch (err) {
            console.warn(`AcroForm error for ${cleanName}:`, err);
          }
        } else {
          // Flattened mode: Render text value directly
          if (f.type === 'check') {
            const isChecked = val === '1' || val === 'true' || val === 'yes' || val === 'on';
            if (isChecked) {
              outPage.drawText('✓', {
                x: x + 3,
                y: pdfLibY + 3,
                size: 11,
                font: helveticaBold,
                color: rgb(0.1, 0.4, 0.8),
              });
            }
            outPage.drawText(caption, {
              x: x + 22,
              y: pdfLibY + 4,
              size: 8.5,
              font: helvetica,
              color: rgb(0.2, 0.25, 0.35),
            });
          } else if (val) {
            try {
              outPage.drawText(val.slice(0, 80), {
                x: x + 6,
                y: pdfLibY + (h / 2) - 4,
                size: 9,
                font: helvetica,
                color: rgb(0.1, 0.15, 0.25),
              });
            } catch {}
          }
        }
      });

      // Draw handwritten annotations on this synthesized page if present
      if (includeAnnotations && pageAnnotations[pageNum] && pageAnnotations[pageNum].length > 0) {
        drawAnnotationsOnPdfPage(outPage, pageAnnotations[pageNum]);
      }
    }
  } else {
    // CASE B: Standard / Static rendered pages via PDF.js canvas
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pagePercent = Math.round(10 + (pageNum / numPages) * 75);
      onProgress?.({
        current: pageNum,
        total: numPages,
        message: `Rendering & baking Page ${pageNum} of ${numPages} (${mode === 'interactive' ? 'Interactive AcroForm' : 'Flattened'})...`,
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

      if (mode === 'interactive') {
        const pageFields = fieldsToConvert.filter(f => (f.bounds?.pageNumber || 1) === pageNum);

        pageFields.forEach((f, fieldIdx) => {
          if (!f.bounds) return;

          let cleanName = (f.name || `field_p${pageNum}_${fieldIdx}`).replace(/[^\w.-]/g, '_');
          if (usedFieldNames.has(cleanName)) {
            cleanName = `${cleanName}_${fieldIdx}`;
          }
          usedFieldNames.add(cleanName);

          const x = Math.max(0, Math.min(f.bounds.x, pageWidth - 10));
          const rawY = f.bounds.y;
          const w = Math.max(16, Math.min(f.bounds.width, pageWidth - x));
          const h = Math.max(12, Math.min(f.bounds.height, pageHeight - 10));

          const pdfLibY = Math.max(0, pageHeight - rawY - h);
          const val = includeFormValues && f.value !== undefined ? String(f.value) : '';

          try {
            if (f.type === 'check') {
              const cb = form.createCheckBox(cleanName);
              const isChecked = val === '1' || val === 'true' || val === 'yes' || val === 'on';
              if (isChecked) cb.check();
              cb.addToPage(outPage, {
                x,
                y: pdfLibY,
                width: Math.min(w, 18),
                height: Math.min(h, 18),
                borderWidth: 1,
                borderColor: rgb(0.3, 0.3, 0.3),
              });
            } else if (f.type === 'choice' && f.options && f.options.length > 0) {
              const dd = form.createDropdown(cleanName);
              dd.setOptions(f.options);
              if (val && f.options.includes(val)) dd.select(val);
              dd.addToPage(outPage, {
                x,
                y: pdfLibY,
                width: w,
                height: h,
                borderWidth: 0.75,
                borderColor: rgb(0.6, 0.6, 0.6),
              });
            } else {
              const tf = form.createTextField(cleanName);
              if (val) tf.setText(val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''));
              if (f.type === 'multiline') tf.enableMultiline();
              tf.addToPage(outPage, {
                x,
                y: pdfLibY,
                width: w,
                height: h,
                borderWidth: 0.75,
                borderColor: rgb(0.65, 0.65, 0.65),
                backgroundColor: rgb(0.98, 0.98, 1.0),
              });
            }
          } catch (fieldErr) {
            console.warn(`Could not add AcroForm field ${cleanName}:`, fieldErr);
          }
        });
      }
    }
  }

  // 5. Finalize Form & Appearances
  onProgress?.({
    current: numPages,
    total: numPages,
    message: 'Finalizing standard PDF catalog and field appearances...',
    percent: 92,
  });

  if (mode === 'interactive') {
    try {
      form.updateFieldAppearances(helvetica);
    } catch (appErr) {
      console.warn('Field appearance update note:', appErr);
    }
  } else if (mode === 'flattened') {
    // If flattened mode was requested with fields, flatten all AcroForm fields
    try {
      form.flatten();
    } catch {
      // ignore
    }
  }

  onProgress?.({
    current: numPages,
    total: numPages,
    message: 'Saving universal regular PDF stream...',
    percent: 98,
  });

  const convertedBytes = await outPdfDoc.save();

  onProgress?.({
    current: numPages,
    total: numPages,
    message: 'Conversion completed successfully!',
    percent: 100,
  });

  return convertedBytes;
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
      const last = points[points.length - 1];
      ctx.lineTo(last.x * scale, last.y * scale);
      ctx.stroke();
    }

    ctx.restore();
  }
}

/**
 * Draws handwritten strokes directly onto a PDF page via pdf-lib
 */
function drawAnnotationsOnPdfPage(
  page: any,
  strokes: DrawingStroke[]
) {
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
