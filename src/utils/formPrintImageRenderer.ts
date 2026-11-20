import JSZip from 'jszip';
import { pdfjsLib } from './pdfWorker';
import { XFAField, XFASubform } from '../types/pdf';
import { PageAnnotations, DrawingStroke } from '../types/drawing';

export type PrintImageFormat = 'png' | 'jpeg' | 'webp';
export type PrintImageDpi = 150 | 200 | 300;
export type PrintImageColorMode = 'color' | 'grayscale';
export type PrintImageLayoutMode = 'auto' | 'exact_pdf' | 'clean_print_sheet';

export interface FormPrintImageOptions {
  dpi: PrintImageDpi;
  format: PrintImageFormat;
  jpegQuality?: number; // 0.7 - 1.0
  colorMode: PrintImageColorMode;
  layoutMode: PrintImageLayoutMode;
  showFieldBorders: boolean;
  includeEmptyFields: boolean;
  includePrintFooter: boolean;
  includeAnnotations?: boolean;
  pageAnnotations?: PageAnnotations;
  documentTitle?: string;
  onProgress?: (progress: { current: number; total: number; message: string; percent: number }) => void;
}

export interface RenderedPrintPageImage {
  pageNumber: number;
  widthPx: number;
  heightPx: number;
  dpi: PrintImageDpi;
  format: PrintImageFormat;
  mimeType: string;
  dataUrl: string;
  blob: Blob;
  sizeBytes: number;
  renderedFieldsCount: number;
  filledFieldsCount: number;
  usedSynthesizedSheet: boolean;
}

export interface FormPrintImageResult {
  pages: RenderedPrintPageImage[];
  totalFieldsRendered: number;
  totalFilledFields: number;
  wasDynamicShellSynthesized: boolean;
  dpi: PrintImageDpi;
  format: PrintImageFormat;
  generatedAtIso: string;
}

function getMimeType(format: PrintImageFormat): string {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  return 'image/png';
}

export function getFormatExtension(format: PrintImageFormat): string {
  if (format === 'jpeg') return 'jpg';
  if (format === 'webp') return 'webp';
  return 'png';
}

function isCheckboxChecked(val: string | undefined): boolean {
  if (!val) return false;
  const v = val.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on' || v === 'checked' || v === 'x';
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode rendered canvas to image blob'));
      },
      mimeType,
      quality
    );
  });
}

/**
 * Converts a canvas to true monochrome grayscale simulating a laser print proof.
 */
function applyPrintGrayscale(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 709 luminance formula
    const lum = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    data[i] = lum;
    data[i + 1] = lum;
    data[i + 2] = lum;
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Word-wraps a string into lines that fit within `maxWidth` pixels in the current canvas font.
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines?: number
): string[] {
  if (!text) return [];
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          if (maxLines && lines.length >= maxLines) return lines;
        }
        // Break overly long single words cleanly if needed
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
              lines.push(chunk);
              if (maxLines && lines.length >= maxLines) return lines;
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          currentLine = chunk;
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
      if (maxLines && lines.length >= maxLines) return lines;
    }
  }

  return maxLines ? lines.slice(0, maxLines) : lines;
}

/**
 * Draws a crisp print-ready vector checkmark inside a checkbox rectangle.
 */
function drawPrintCheckbox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  checked: boolean,
  scale: number,
  borderColor = '#334155',
  checkColor = '#0f172a'
) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = Math.max(1, 0.9 * scale);
  ctx.strokeRect(x, y, size, size);

  if (checked) {
    ctx.strokeStyle = checkColor;
    ctx.lineWidth = Math.max(1.5, 1.75 * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x + size * 0.2, y + size * 0.52);
    ctx.lineTo(x + size * 0.43, y + size * 0.76);
    ctx.lineTo(x + size * 0.82, y + size * 0.24);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws freehand annotations / handwritten strokes onto the print canvas.
 */
function drawAnnotationsOnPrintCanvas(
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

    const pts = stroke.points;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x * scale, pts[0].y * scale, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pts.length === 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
      ctx.lineTo(pts[1].x * scale, pts[1].y * scale);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = ((pts[i].x + pts[i + 1].x) / 2) * scale;
        const midY = ((pts[i].y + pts[i + 1].y) / 2) * scale;
        ctx.quadraticCurveTo(pts[i].x * scale, pts[i].y * scale, midX, midY);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x * scale, last.y * scale);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * Draws a subtle print proof footer in the bottom margin of a rendered print page.
 */
function drawPrintProofFooter(
  ctx: CanvasRenderingContext2D,
  widthPx: number,
  heightPx: number,
  scale: number,
  title: string,
  pageNumber: number,
  totalPages: number,
  dpi: PrintImageDpi
) {
  ctx.save();
  const marginX = 32 * scale;
  const footerY = heightPx - 14 * scale;

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = Math.max(0.75, 0.5 * scale);
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 11 * scale);
  ctx.lineTo(widthPx - marginX, footerY - 11 * scale);
  ctx.stroke();

  const fontSizePx = Math.max(9, Math.round(7.5 * scale));
  ctx.font = `400 ${fontSizePx}px "Inter", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = '#475569';
  ctx.textBaseline = 'alphabetic';

  const dateStamp = new Date().toLocaleDateString('en-CA');
  const leftText = `${title.slice(0, 65)} · Print Preview (${dpi} DPI · ${dateStamp})`;
  ctx.textAlign = 'left';
  ctx.fillText(leftText, marginX, footerY);

  ctx.textAlign = 'right';
  ctx.fillText(`Page ${pageNumber} of ${totalPages}`, widthPx - marginX, footerY);
  ctx.restore();
}

/**
 * Composites a single XFAField's live value directly onto a rendered PDF page canvas
 * using print-accurate typography (no web input chrome or focus borders).
 */
function compositeFieldOntoPdfCanvas(
  ctx: CanvasRenderingContext2D,
  field: XFAField,
  scale: number,
  showFieldBorders: boolean,
  includeEmptyFields: boolean
) {
  if (!field.bounds) return;
  const rawVal = field.value !== undefined && field.value !== null ? String(field.value) : '';
  const hasValue = rawVal.trim().length > 0;

  if (!hasValue && !includeEmptyFields && field.type !== 'check') {
    return;
  }

  const x = field.bounds.x * scale;
  const y = field.bounds.y * scale;
  const w = Math.max(12 * scale, field.bounds.width * scale);
  const h = Math.max(12 * scale, field.bounds.height * scale);

  ctx.save();

  // Checkbox rendering
  if (field.type === 'check') {
    const boxSize = Math.min(w, h, 14 * scale);
    const checked = isCheckboxChecked(rawVal);
    drawPrintCheckbox(
      ctx,
      x + (w - boxSize) / 2,
      y + (h - boxSize) / 2,
      boxSize,
      checked,
      scale,
      field.appearance?.borderColor && field.appearance.borderColor !== 'transparent'
        ? field.appearance.borderColor
        : '#334155',
      field.appearance?.textColor || '#0f172a'
    );
    ctx.restore();
    return;
  }

  // Mask underlying PDF box area cleanly when value is present (or custom background set)
  const customBg =
    field.appearance?.backgroundColor && field.appearance.backgroundColor !== 'transparent'
      ? field.appearance.backgroundColor
      : null;

  if (hasValue || customBg) {
    ctx.fillStyle = customBg || '#ffffff';
    ctx.fillRect(x + 0.5 * scale, y + 0.5 * scale, Math.max(1, w - scale), Math.max(1, h - scale));
  }

  // Optional clean print border or baseline underline
  if (showFieldBorders) {
    const borderCol =
      field.appearance?.borderColor && field.appearance.borderColor !== 'transparent'
        ? field.appearance.borderColor
        : '#94a3b8';
    const borderW =
      field.appearance?.borderWidth !== undefined
        ? field.appearance.borderWidth * scale * 0.7
        : 0.65 * scale;

    if (borderW > 0 && field.appearance?.borderStyle !== 'none') {
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = Math.max(0.75, borderW);
      if (field.appearance?.borderStyle === 'dashed') {
        ctx.setLineDash([4 * scale, 2.5 * scale]);
      } else if (field.appearance?.borderStyle === 'dotted') {
        ctx.setLineDash([1.5 * scale, 2 * scale]);
      }
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }

  if (!hasValue) {
    ctx.restore();
    return;
  }

  // Clip text neatly inside field bounds
  ctx.beginPath();
  ctx.rect(x + 1.5 * scale, y + 1 * scale, Math.max(4, w - 3 * scale), Math.max(4, h - 2 * scale));
  ctx.clip();

  const fontSizePt = field.appearance?.fontSize || (field.type === 'multiline' ? 9 : 9.5);
  const fontSizePx = Math.max(8, Math.round(fontSizePt * scale));
  const fontWeight = field.appearance?.fontWeight === 'bold' ? '700' : '400';
  const fontStyle = field.type === 'signature' ? 'italic' : 'normal';
  const fontFamily =
    field.type === 'signature'
      ? '"Georgia", "Times New Roman", serif'
      : field.appearance?.fontFamily || '"Helvetica Neue", Arial, sans-serif';

  ctx.font = `${fontStyle} ${fontWeight} ${fontSizePx}px ${fontFamily}`;
  ctx.fillStyle = field.appearance?.textColor || '#0f172a';
  ctx.textBaseline = 'top';

  const padX = 4 * scale;
  const maxTextW = Math.max(12, w - padX * 2);

  if (field.type === 'multiline' || h > fontSizePx * 2.2) {
    const lineHeight = fontSizePx * 1.28;
    const maxLines = Math.max(1, Math.floor((h - 4 * scale) / lineHeight));
    const lines = wrapCanvasText(ctx, rawVal, maxTextW, maxLines);
    const startY = y + 3 * scale;
    lines.forEach((line, idx) => {
      ctx.fillText(line, x + padX, startY + idx * lineHeight);
    });
  } else {
    // Single-line field (numeric right-aligned if purely numeric, otherwise left-aligned)
    const isNumeric = field.type === 'numeric' && /^[$€£¥+\-\d,.\s%()]+$/.test(rawVal.trim());
    const textY = y + Math.max(1.5 * scale, (h - fontSizePx) / 2);

    // Truncate with ellipsis if text overflows single line
    let displayStr = rawVal.replace(/\r?\n/g, ' ');
    while (displayStr.length > 3 && ctx.measureText(displayStr).width > maxTextW) {
      displayStr = displayStr.slice(0, -1);
    }
    if (displayStr.length < rawVal.length && displayStr.length > 3) {
      displayStr = `${displayStr.slice(0, -1)}…`;
    }

    if (isNumeric) {
      ctx.textAlign = 'right';
      ctx.fillText(displayStr, x + w - padX, textY);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(displayStr, x + padX, textY);
    }
  }

  ctx.restore();
}

interface SheetSection {
  title: string;
  fields: XFAField[];
}

function groupFieldsIntoPrintSections(fields: XFAField[], subforms: XFASubform[]): SheetSection[] {
  const sections: SheetSection[] = [];
  const usedIds = new Set<string>();

  const collectSubforms = (list: XFASubform[], parentTitle = '') => {
    for (const sf of list) {
      const heading = sf.title || sf.name || 'Form Section';
      const fullTitle = parentTitle && parentTitle !== heading ? `${parentTitle} — ${heading}` : heading;
      const visible = sf.fields.filter(f => f.visibility !== 'hidden');
      if (visible.length > 0) {
        sections.push({ title: fullTitle, fields: visible });
        visible.forEach(f => usedIds.add(f.id));
      }
      if (sf.subforms && sf.subforms.length > 0) {
        collectSubforms(sf.subforms, fullTitle);
      }
    }
  };

  if (subforms && subforms.length > 0) {
    collectSubforms(subforms);
  }

  // Fallback for any fields not attached to subforms
  const remaining = fields.filter(f => f.visibility !== 'hidden' && !usedIds.has(f.id));
  if (remaining.length > 0) {
    const bySubform = new Map<string, XFAField[]>();
    for (const f of remaining) {
      const key = f.parentSubform || 'Form Fields';
      if (!bySubform.has(key)) bySubform.set(key, []);
      bySubform.get(key)!.push(f);
    }
    bySubform.forEach((group, title) => {
      sections.push({ title, fields: group });
    });
  }

  return sections;
}

/**
 * Renders a crisp, publication-grade multi-page US Letter print sheet directly on high-DPI HTML5 Canvas
 * for Dynamic XFA "Please wait..." shells or when the user chooses "Clean Print Sheet Layout".
 */
async function renderSynthesizedPrintSheetPages(
  fields: XFAField[],
  subforms: XFASubform[],
  options: FormPrintImageOptions
): Promise<RenderedPrintPageImage[]> {
  const scale = options.dpi / 72;
  const pageWidthPt = 612; // US Letter 8.5 in
  const pageHeightPt = 792; // US Letter 11 in
  const widthPx = Math.round(pageWidthPt * scale);
  const heightPx = Math.round(pageHeightPt * scale);

  const marginX = 42 * scale;
  const marginTop = 42 * scale;
  const marginBottom = 46 * scale;
  const contentWidth = widthPx - marginX * 2;

  const docTitle = options.documentTitle || 'XFA Form Print Representation';
  const sections = groupFieldsIntoPrintSections(fields, subforms);

  // Filter sections if includeEmptyFields is false
  const filteredSections = sections
    .map(sec => ({
      ...sec,
      fields: options.includeEmptyFields
        ? sec.fields
        : sec.fields.filter(f => {
            if (f.type === 'check') return isCheckboxChecked(f.value);
            return Boolean(f.value && f.value.trim().length > 0);
          }),
    }))
    .filter(sec => sec.fields.length > 0);

  const activeSections = filteredSections.length > 0 ? filteredSections : sections;

  interface SheetCanvasPage {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    renderedFieldsCount: number;
    filledFieldsCount: number;
  }

  const canvasPages: SheetCanvasPage[] = [];

  const createNewPage = (isFirstPage: boolean): { page: SheetCanvasPage; cursorY: number } => {
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to create 2D canvas context for print sheet');

    // Pure white paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);

    let y = marginTop;

    if (isFirstPage) {
      // Top document masthead banner (clean print typography)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(marginX, y, contentWidth, 3 * scale);
      y += 10 * scale;

      ctx.font = `700 ${Math.round(15 * scale)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(docTitle.slice(0, 68), marginX, y);

      const filledTotal = fields.filter(f => f.visibility !== 'hidden' && f.value && f.value.trim() !== '' && f.value !== '0').length;
      const visibleTotal = fields.filter(f => f.visibility !== 'hidden').length;

      ctx.font = `400 ${Math.round(8.5 * scale)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = '#475569';
      ctx.fillText(
        `Printed Form State · ${filledTotal} of ${visibleTotal} fields populated · Generated ${new Date().toLocaleString()}`,
        marginX,
        y + 20 * scale
      );

      y += 38 * scale;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1, 0.75 * scale);
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(widthPx - marginX, y);
      ctx.stroke();
      y += 14 * scale;
    } else {
      // Continuation header
      ctx.font = `600 ${Math.round(8.5 * scale)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${docTitle.slice(0, 70)} (Continued)`, marginX, y - 16 * scale);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = Math.max(0.75, 0.6 * scale);
      ctx.beginPath();
      ctx.moveTo(marginX, y - 2 * scale);
      ctx.lineTo(widthPx - marginX, y - 2 * scale);
      ctx.stroke();
      y += 8 * scale;
    }

    const page: SheetCanvasPage = {
      canvas,
      ctx,
      renderedFieldsCount: 0,
      filledFieldsCount: 0,
    };
    canvasPages.push(page);
    return { page, cursorY: y };
  };

  let { page: currentPage, cursorY } = createNewPage(true);

  const ensureSpace = (neededPx: number) => {
    if (cursorY + neededPx > heightPx - marginBottom) {
      const next = createNewPage(false);
      currentPage = next.page;
      cursorY = next.cursorY;
    }
  };

  for (const section of activeSections) {
    // Section header band
    ensureSpace(46 * scale);

    const ctx = currentPage.ctx;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(marginX, cursorY, contentWidth, 20 * scale);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(marginX, cursorY, 3 * scale, 20 * scale);

    ctx.font = `700 ${Math.round(9.5 * scale)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(section.title.toUpperCase().slice(0, 82), marginX + 9 * scale, cursorY + 10 * scale);

    cursorY += 27 * scale;

    // Lay out fields in a clean 2-column grid for short fields, full-width for multiline/signature/long values
    let colIndex = 0;
    const colGap = 16 * scale;
    const colWidth = (contentWidth - colGap) / 2;
    let rowMaxHeight = 0;

    const flushRow = () => {
      if (colIndex > 0) {
        cursorY += rowMaxHeight + 10 * scale;
        colIndex = 0;
        rowMaxHeight = 0;
      }
    };

    for (const field of section.fields) {
      const rawVal = field.value !== undefined && field.value !== null ? String(field.value) : '';
      const isFilled =
        field.type === 'check' ? isCheckboxChecked(rawVal) : rawVal.trim().length > 0;
      const isFullWidth =
        field.type === 'multiline' ||
        field.type === 'signature' ||
        rawVal.length > 48 ||
        (field.caption || field.name).length > 44;

      if (isFullWidth && colIndex > 0) {
        flushRow();
      }

      const boxWidth = isFullWidth ? contentWidth : colWidth;
      const valFontPx = Math.round(9.5 * scale);
      const labelFontPx = Math.round(7.8 * scale);

      // Measure height needed
      let boxHeight = 22 * scale;
      let wrappedLines: string[] = [];

      if (field.type === 'check') {
        boxHeight = 18 * scale;
      } else {
        currentPage.ctx.font = `400 ${valFontPx}px "Helvetica Neue", Arial, sans-serif`;
        if (field.type === 'multiline' || isFullWidth) {
          wrappedLines = wrapCanvasText(currentPage.ctx, rawVal, boxWidth - 12 * scale, 10);
          const lineCount = Math.max(field.type === 'multiline' ? 2 : 1, wrappedLines.length);
          boxHeight = Math.max(22 * scale, lineCount * (valFontPx * 1.32) + 10 * scale);
        } else {
          wrappedLines = rawVal ? [rawVal] : [];
          boxHeight = 22 * scale;
        }
      }

      const totalItemHeight = field.type === 'check' ? 20 * scale : labelFontPx + 5 * scale + boxHeight;

      if (colIndex === 0) {
        ensureSpace(totalItemHeight + 12 * scale);
      }

      const drawCtx = currentPage.ctx;
      const fieldX = marginX + (colIndex === 1 ? colWidth + colGap : 0);
      const fieldY = cursorY;

      currentPage.renderedFieldsCount++;
      if (isFilled) currentPage.filledFieldsCount++;

      const captionText = `${field.caption || field.name}${field.required ? ' *' : ''}`;

      if (field.type === 'check') {
        const cbSize = 12 * scale;
        drawPrintCheckbox(
          drawCtx,
          fieldX,
          fieldY + 3 * scale,
          cbSize,
          isCheckboxChecked(rawVal),
          scale
        );
        drawCtx.font = `500 ${Math.round(8.8 * scale)}px "Helvetica Neue", Arial, sans-serif`;
        drawCtx.fillStyle = '#1e293b';
        drawCtx.textAlign = 'left';
        drawCtx.textBaseline = 'middle';
        drawCtx.fillText(captionText.slice(0, 75), fieldX + cbSize + 7 * scale, fieldY + 3 * scale + cbSize / 2);
      } else {
        // Field Label
        drawCtx.font = `600 ${labelFontPx}px "Helvetica Neue", Arial, sans-serif`;
        drawCtx.fillStyle = '#475569';
        drawCtx.textAlign = 'left';
        drawCtx.textBaseline = 'top';
        drawCtx.fillText(captionText.slice(0, isFullWidth ? 110 : 54), fieldX, fieldY);

        const boxY = fieldY + labelFontPx + 4 * scale;

        // Field Box
        drawCtx.fillStyle = isFilled ? '#ffffff' : '#f8fafc';
        drawCtx.fillRect(fieldX, boxY, boxWidth, boxHeight);

        if (options.showFieldBorders) {
          drawCtx.strokeStyle = field.type === 'signature' ? '#64748b' : '#cbd5e1';
          drawCtx.lineWidth = Math.max(0.75, 0.75 * scale);
          drawCtx.strokeRect(fieldX, boxY, boxWidth, boxHeight);
        } else {
          // Clean subtle bottom rule for borderless print mode
          drawCtx.strokeStyle = '#cbd5e1';
          drawCtx.lineWidth = Math.max(0.75, 0.65 * scale);
          drawCtx.beginPath();
          drawCtx.moveTo(fieldX, boxY + boxHeight);
          drawCtx.lineTo(fieldX + boxWidth, boxY + boxHeight);
          drawCtx.stroke();
        }

        // Field Value
        if (rawVal.trim().length > 0) {
          const fontStyle = field.type === 'signature' ? 'italic' : 'normal';
          const fontWeight = field.appearance?.fontWeight === 'bold' ? '700' : '400';
          const fontFamily =
            field.type === 'signature'
              ? '"Georgia", "Times New Roman", serif'
              : '"Helvetica Neue", Arial, sans-serif';

          drawCtx.font = `${fontStyle} ${fontWeight} ${valFontPx}px ${fontFamily}`;
          drawCtx.fillStyle = field.appearance?.textColor || '#0f172a';
          drawCtx.textAlign = 'left';
          drawCtx.textBaseline = 'top';

          if (wrappedLines.length > 1) {
            const lh = valFontPx * 1.32;
            wrappedLines.forEach((line, idx) => {
              drawCtx.fillText(line, fieldX + 6 * scale, boxY + 5 * scale + idx * lh);
            });
          } else {
            let single = wrappedLines[0] || rawVal;
            const maxW = boxWidth - 12 * scale;
            while (single.length > 3 && drawCtx.measureText(single).width > maxW) {
              single = single.slice(0, -1);
            }
            if (single.length < rawVal.length && single.length > 3) {
              single = `${single.slice(0, -1)}…`;
            }
            drawCtx.fillText(single, fieldX + 6 * scale, boxY + (boxHeight - valFontPx) / 2);
          }
        }
      }

      if (isFullWidth) {
        cursorY += totalItemHeight + 10 * scale;
        colIndex = 0;
        rowMaxHeight = 0;
      } else {
        rowMaxHeight = Math.max(rowMaxHeight, totalItemHeight);
        colIndex++;
        if (colIndex >= 2) {
          flushRow();
        }
      }
    }

    flushRow();
    cursorY += 8 * scale;
  }

  // Finalize pages: footer, optional grayscale, encode to target format
  const mimeType = getMimeType(options.format);
  const quality = options.jpegQuality ?? 0.95;
  const totalPages = canvasPages.length;
  const results: RenderedPrintPageImage[] = [];

  for (let i = 0; i < totalPages; i++) {
    const p = canvasPages[i];
    const pageNum = i + 1;

    options.onProgress?.({
      current: pageNum,
      total: totalPages,
      message: `Encoding printed form page ${pageNum} of ${totalPages} at ${options.dpi} DPI...`,
      percent: Math.round(50 + (pageNum / totalPages) * 48),
    });

    if (options.includePrintFooter) {
      drawPrintProofFooter(
        p.ctx,
        widthPx,
        heightPx,
        scale,
        docTitle,
        pageNum,
        totalPages,
        options.dpi
      );
    }

    if (options.colorMode === 'grayscale') {
      applyPrintGrayscale(p.ctx, widthPx, heightPx);
    }

    const blob = await canvasToBlob(p.canvas, mimeType, quality);
    const dataUrl = p.canvas.toDataURL(mimeType, quality);

    results.push({
      pageNumber: pageNum,
      widthPx,
      heightPx,
      dpi: options.dpi,
      format: options.format,
      mimeType,
      dataUrl,
      blob,
      sizeBytes: blob.size,
      renderedFieldsCount: p.renderedFieldsCount,
      filledFieldsCount: p.filledFieldsCount,
      usedSynthesizedSheet: true,
    });
  }

  return results;
}

/**
 * Generates high-fidelity print-ready image representations of the current form state
 * with all live field values rendered as they would appear when printed.
 */
export async function renderFormPrintImages(
  pdfBytes: Uint8Array,
  fields: XFAField[],
  subforms: XFASubform[],
  options: FormPrintImageOptions
): Promise<FormPrintImageResult> {
  const {
    dpi = 200,
    format = 'png',
    jpegQuality = 0.95,
    colorMode = 'color',
    layoutMode = 'auto',
    showFieldBorders = true,
    includeEmptyFields = true,
    includePrintFooter = false,
    includeAnnotations = true,
    pageAnnotations = {},
    documentTitle = 'Form Print Representation',
    onProgress,
  } = options;

  onProgress?.({
    current: 0,
    total: 100,
    message: 'Analyzing PDF pages and live XFA field state...',
    percent: 8,
  });

  const visibleFields = fields.filter(f => f.visibility !== 'hidden');
  let pdfJsDoc: any = null;
  let numPages = 1;
  let isDynamicShell = false;

  if (layoutMode !== 'clean_print_sheet') {
    try {
      pdfJsDoc = await pdfjsLib.getDocument({
        data: pdfBytes.slice(0),
        enableXfa: true,
      }).promise;
      numPages = pdfJsDoc.numPages || 1;

      const page1 = await pdfJsDoc.getPage(1);
      const textContent = await page1.getTextContent();
      const textStr = textContent.items.map((it: any) => it.str).join(' ');
      if (
        textStr.includes('Please wait') ||
        textStr.includes('If this message is not eventually replaced') ||
        (numPages === 1 && visibleFields.some(f => (f.bounds?.pageNumber || 1) > 1))
      ) {
        isDynamicShell = true;
      }
    } catch (err) {
      console.warn('PDF.js render inspection fallback to synthesized print sheet:', err);
      isDynamicShell = true;
    }
  }

  const useSynthesizedSheet =
    layoutMode === 'clean_print_sheet' || (layoutMode === 'auto' && isDynamicShell && visibleFields.length > 0);

  if (useSynthesizedSheet) {
    onProgress?.({
      current: 1,
      total: 2,
      message: `Composing high-fidelity ${dpi} DPI print sheet with current field values...`,
      percent: 30,
    });

    const pages = await renderSynthesizedPrintSheetPages(visibleFields, subforms, {
      ...options,
      documentTitle,
    });

    const totalFieldsRendered = pages.reduce((acc, p) => acc + p.renderedFieldsCount, 0);
    const totalFilledFields = pages.reduce((acc, p) => acc + p.filledFieldsCount, 0);

    onProgress?.({
      current: pages.length,
      total: pages.length,
      message: 'High-fidelity print images ready!',
      percent: 100,
    });

    return {
      pages,
      totalFieldsRendered,
      totalFilledFields,
      wasDynamicShellSynthesized: true,
      dpi,
      format,
      generatedAtIso: new Date().toISOString(),
    };
  }

  // Exact PDF Page Rasterization + Crisp Print-Mode Live Field Compositing
  const scale = dpi / 72;
  const mimeType = getMimeType(format);
  const pages: RenderedPrintPageImage[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.({
      current: pageNum,
      total: numPages,
      message: `Rasterizing Page ${pageNum} of ${numPages} at ${dpi} DPI with live values...`,
      percent: Math.round(15 + ((pageNum - 1) / numPages) * 78),
    });

    const page = await pdfJsDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const widthPx = Math.round(viewport.width);
    const heightPx = Math.round(viewport.height);

    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(`Could not initialize 2D canvas for page ${pageNum}`);
    }

    // Pure white paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas: canvas as any,
    }).promise;

    // Composite live field values onto their exact bounds on this page
    const pageFields = visibleFields.filter(f => (f.bounds?.pageNumber || 1) === pageNum);
    let filledOnPage = 0;

    for (const f of pageFields) {
      const hasVal =
        f.type === 'check'
          ? isCheckboxChecked(f.value)
          : Boolean(f.value && f.value.trim().length > 0);
      if (hasVal) filledOnPage++;

      compositeFieldOntoPdfCanvas(ctx, f, scale, showFieldBorders, includeEmptyFields);
    }

    // Draw handwritten annotations if present
    if (includeAnnotations && pageAnnotations[pageNum]?.length) {
      drawAnnotationsOnPrintCanvas(ctx, pageAnnotations[pageNum], scale);
    }

    // Optional subtle print proof footer
    if (includePrintFooter) {
      drawPrintProofFooter(
        ctx,
        widthPx,
        heightPx,
        scale,
        documentTitle,
        pageNum,
        numPages,
        dpi
      );
    }

    // Optional grayscale print simulation
    if (colorMode === 'grayscale') {
      applyPrintGrayscale(ctx, widthPx, heightPx);
    }

    const blob = await canvasToBlob(canvas, mimeType, jpegQuality);
    const dataUrl = canvas.toDataURL(mimeType, jpegQuality);

    pages.push({
      pageNumber: pageNum,
      widthPx,
      heightPx,
      dpi,
      format,
      mimeType,
      dataUrl,
      blob,
      sizeBytes: blob.size,
      renderedFieldsCount: pageFields.length,
      filledFieldsCount: filledOnPage,
      usedSynthesizedSheet: false,
    });
  }

  onProgress?.({
    current: numPages,
    total: numPages,
    message: 'High-fidelity print images ready!',
    percent: 100,
  });

  return {
    pages,
    totalFieldsRendered: pages.reduce((acc, p) => acc + p.renderedFieldsCount, 0),
    totalFilledFields: pages.reduce((acc, p) => acc + p.filledFieldsCount, 0),
    wasDynamicShellSynthesized: false,
    dpi,
    format,
    generatedAtIso: new Date().toISOString(),
  };
}

/**
 * Stitches all rendered print pages vertically into a single continuous high-resolution image.
 */
export async function stitchPrintPagesVertically(
  pages: RenderedPrintPageImage[],
  format: PrintImageFormat,
  jpegQuality = 0.95
): Promise<{ blob: Blob; dataUrl: string; widthPx: number; heightPx: number }> {
  if (pages.length === 0) {
    throw new Error('No pages available to stitch');
  }

  const gapPx = pages.length > 1 ? Math.round(pages[0].dpi * 0.14) : 0;
  const maxWidth = Math.max(...pages.map(p => p.widthPx));
  const totalHeight =
    pages.reduce((sum, p) => sum + p.heightPx, 0) + gapPx * Math.max(0, pages.length - 1);

  // Guard against browser maximum canvas height (~16384px in some engines)
  const MAX_CANVAS_HEIGHT = 15000;
  const downscale = totalHeight > MAX_CANVAS_HEIGHT ? MAX_CANVAS_HEIGHT / totalHeight : 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(maxWidth * downscale);
  canvas.height = Math.round(totalHeight * downscale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create stitch canvas context');

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let currentY = 0;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = p.dataUrl;
    });

    const drawW = Math.round(p.widthPx * downscale);
    const drawH = Math.round(p.heightPx * downscale);
    const offsetX = Math.round((canvas.width - drawW) / 2);

    ctx.drawImage(img, offsetX, Math.round(currentY), drawW, drawH);
    currentY += drawH + gapPx * downscale;
  }

  const mimeType = getMimeType(format);
  const blob = await canvasToBlob(canvas, mimeType, jpegQuality);
  const dataUrl = canvas.toDataURL(mimeType, jpegQuality);

  return {
    blob,
    dataUrl,
    widthPx: canvas.width,
    heightPx: canvas.height,
  };
}

/**
 * Packages all rendered print page images into a ZIP archive.
 */
export async function bundlePrintImagesAsZip(
  pages: RenderedPrintPageImage[],
  baseFilename: string,
  format: PrintImageFormat
): Promise<Blob> {
  const zip = new JSZip();
  const ext = getFormatExtension(format);
  const cleanBase = baseFilename.replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '_');

  for (const p of pages) {
    const padded = String(p.pageNumber).padStart(2, '0');
    zip.file(`${cleanBase}_print_page_${padded}.${ext}`, p.blob);
  }

  return await zip.generateAsync({ type: 'blob' });
}
