import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import { XFAField } from '../types/pdf';
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
    message: 'Initializing XFA rendering engine with PDF.js...',
    percent: 5,
  });

  // 1. Load the XFA document via PDF.js with full dynamic XFA evaluation enabled
  const pdfJsDoc = await pdfjsLib.getDocument({
    data: pdfBytes.slice(0),
    enableXfa: true,
  }).promise;

  const numPages = pdfJsDoc.numPages;
  if (numPages === 0) {
    throw new Error('Unable to extract rendered pages from XFA document');
  }

  // 2. Initialize new standard PDFDocument via pdf-lib
  const outPdfDoc = await PDFDocument.create();
  outPdfDoc.setTitle(documentTitle);
  outPdfDoc.setCreator('AcroXFA Universal PDF Engine');
  outPdfDoc.setProducer('pdf-lib (Standard ISO 32000-1 AcroForm)');
  outPdfDoc.setCreationDate(new Date());

  const helvetica = await outPdfDoc.embedFont(StandardFonts.Helvetica);
  const form = outPdfDoc.getForm();
  const usedFieldNames = new Set<string>();

  // 3. Render each page of the XFA document to high-resolution canvas and embed into the standard PDF
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

    // Create offscreen canvas for crisp visual rendering
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(`Failed to create 2D canvas context for page ${pageNum}`);
    }

    // Render page graphics, text, tables, and borders from XFA engine
    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas as any,
    }).promise;

    // Optional: Draw freehand annotations / signatures directly onto the high-resolution page canvas
    if (includeAnnotations && pageAnnotations[pageNum] && pageAnnotations[pageNum].length > 0) {
      drawAnnotationsOnCanvas(ctx, pageAnnotations[pageNum], dpiScale);
    }

    // Convert canvas to PNG data URL
    const pngDataUrl = canvas.toDataURL('image/png');
    const embeddedImage = await outPdfDoc.embedPng(pngDataUrl);

    // Add page to standard PDFDocument with exact native dimensions
    const outPage = outPdfDoc.addPage([pageWidth, pageHeight]);

    // Draw the rendered visual page covering full width and height
    outPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    // 4. If Interactive AcroForm mode: Inject standard PDF interactive form fields
    if (mode === 'interactive') {
      const pageFields = fields.filter(f => (f.bounds?.pageNumber || 1) === pageNum);

      pageFields.forEach((f, fieldIdx) => {
        if (!f.bounds) return;

        // Ensure unique, clean AcroForm field name
        let cleanName = (f.name || `field_p${pageNum}_${fieldIdx}`).replace(/[^\w.-]/g, '_');
        if (usedFieldNames.has(cleanName)) {
          cleanName = `${cleanName}_${fieldIdx}`;
        }
        usedFieldNames.add(cleanName);

        const x = Math.max(0, Math.min(f.bounds.x, pageWidth - 10));
        const rawY = f.bounds.y;
        const w = Math.max(16, Math.min(f.bounds.width, pageWidth - x));
        const h = Math.max(12, Math.min(f.bounds.height, pageHeight - 10));

        // Convert top-down Y (PDF.js / canvas) to bottom-up Y (pdf-lib)
        const pdfLibY = Math.max(0, pageHeight - rawY - h);

        const val = includeFormValues && f.value !== undefined ? String(f.value) : '';

        try {
          if (f.type === 'check') {
            const cb = form.createCheckBox(cleanName);
            const isChecked = val === '1' || val === 'true' || val === 'yes' || val === 'on';
            if (isChecked) {
              cb.check();
            }
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
            if (val && f.options.includes(val)) {
              dd.select(val);
            }
            dd.addToPage(outPage, {
              x,
              y: pdfLibY,
              width: w,
              height: h,
              borderWidth: 0.75,
              borderColor: rgb(0.6, 0.6, 0.6),
            });
          } else {
            // Text, multiline, numeric, date, signature
            const tf = form.createTextField(cleanName);
            if (val) {
              // Sanitize non-printable characters for standard Helvetica
              const cleanVal = val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
              tf.setText(cleanVal);
            }
            if (f.type === 'multiline') {
              tf.enableMultiline();
            }
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
