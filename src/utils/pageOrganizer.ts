import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import { pdfjsLib } from './pdfWorker';
import { XFAField, XFASubform } from '../types/pdf';

export interface OrganizedPageItem {
  id: string;
  /** 1-based original page number in the source PDF, or null if newly inserted blank/addendum page */
  originalPageNumber: number | null;
  width: number;
  height: number;
  /** Additional clockwise rotation in degrees (0, 90, 180, 270) */
  rotation: number;
  thumbnailDataUrl: string;
  fieldCount: number;
  sampleFieldNames: string[];
  isBlankInsert?: boolean;
  customTitle?: string;
}

export interface PageOrganizationResult {
  pdfBytes: Uint8Array;
  newPageCount: number;
  reorderedCount: number;
  deletedPageNumbers: number[];
  insertedCount: number;
  /** Maps 1-based original page number -> 1-based new page number (first occurrence) */
  pageMapping: Map<number, number>;
}

/**
 * Renders thumbnails and extracts page metadata + XFA field counts for every page in the loaded PDF.
 */
export async function generatePageThumbnails(
  pdfBytes: Uint8Array,
  fields: XFAField[] = []
): Promise<OrganizedPageItem[]> {
  const items: OrganizedPageItem[] = [];

  // Group XFA fields by their 1-based page number
  const fieldsByPage = new Map<number, XFAField[]>();
  fields.forEach(f => {
    const p = f.bounds?.pageNumber || 1;
    const list = fieldsByPage.get(p) || [];
    list.push(f);
    fieldsByPage.set(p, list);
  });

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes.slice(0),
      enableXfa: true,
    });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      let width = 612;
      let height = 792;
      let thumbnailDataUrl = '';

      try {
        const page = await pdfDoc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1 });
        width = Math.round(unscaledViewport.width);
        height = Math.round(unscaledViewport.height);

        // Render at a clean thumbnail scale (~260px wide)
        const targetWidth = 260;
        const scale = targetWidth / Math.max(unscaledViewport.width, 1);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({
            canvasContext: ctx,
            viewport,
            canvas,
          }).promise;
          thumbnailDataUrl = canvas.toDataURL('image/png');
        }
      } catch (pageErr) {
        console.warn(`Thumbnail render fallback for page ${pageNum}:`, pageErr);
        thumbnailDataUrl = createFallbackThumbnailDataUrl(pageNum, width, height);
      }

      const pageFields = fieldsByPage.get(pageNum) || [];
      items.push({
        id: `page-orig-${pageNum}-${Math.random().toString(36).slice(2, 7)}`,
        originalPageNumber: pageNum,
        width,
        height,
        rotation: 0,
        thumbnailDataUrl: thumbnailDataUrl || createFallbackThumbnailDataUrl(pageNum, width, height),
        fieldCount: pageFields.length,
        sampleFieldNames: pageFields.slice(0, 4).map(f => f.caption || f.name),
      });
    }
  } catch (err) {
    console.warn('PDF.js thumbnail generation fallback to pdf-lib:', err);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    pages.forEach((p, idx) => {
      const pageNum = idx + 1;
      const { width, height } = p.getSize();
      const pageFields = fieldsByPage.get(pageNum) || [];
      items.push({
        id: `page-orig-${pageNum}-${Math.random().toString(36).slice(2, 7)}`,
        originalPageNumber: pageNum,
        width: Math.round(width),
        height: Math.round(height),
        rotation: 0,
        thumbnailDataUrl: createFallbackThumbnailDataUrl(pageNum, width, height),
        fieldCount: pageFields.length,
        sampleFieldNames: pageFields.slice(0, 4).map(f => f.caption || f.name),
      });
    });
  }

  return items;
}

/**
 * Generates a clean visual thumbnail data URL for newly inserted blank/addendum pages or fallback pages.
 */
export function createFallbackThumbnailDataUrl(
  labelNumber: number | string,
  width = 612,
  height = 792,
  subtitle = 'PDF Document Page'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = Math.round((240 * height) / Math.max(width, 1));
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle header bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, 26);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`PAGE ${labelNumber}`, 14, 17);

  // Simulated content lines
  ctx.fillStyle = '#e2e8f0';
  for (let y = 45; y < canvas.height - 40; y += 18) {
    const lineW = y % 36 === 0 ? canvas.width - 48 : canvas.width - 28;
    ctx.fillRect(14, y, lineW, 7);
  }

  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  ctx.fillText(subtitle, 14, canvas.height - 14);

  return canvas.toDataURL('image/png');
}

/**
 * Applies the user's reordered, rotated, duplicated, and deleted page configuration to the PDF
 * while preserving the catalog's /AcroForm and /XFA streams.
 */
export async function applyPageOrganizationToPdf(
  originalPdfBytes: Uint8Array,
  organizedPages: OrganizedPageItem[]
): Promise<PageOrganizationResult> {
  if (organizedPages.length === 0) {
    throw new Error('Document must contain at least one page.');
  }

  const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  const originalPageCount = pdfDoc.getPageCount();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageMapping = new Map<number, number>();
  let insertedCount = 0;

  // Append the organized pages in their new sequence after the existing pages
  for (let newIdx = 0; newIdx < organizedPages.length; newIdx++) {
    const item = organizedPages[newIdx];
    const newPageNumber = newIdx + 1;

    if (
      item.originalPageNumber !== null &&
      item.originalPageNumber >= 1 &&
      item.originalPageNumber <= originalPageCount &&
      !item.isBlankInsert
    ) {
      const srcZeroIdx = item.originalPageNumber - 1;
      const [copiedPage] = await pdfDoc.copyPages(pdfDoc, [srcZeroIdx]);

      if (item.rotation !== 0) {
        const currentAngle = copiedPage.getRotation().angle || 0;
        copiedPage.setRotation(degrees((currentAngle + item.rotation) % 360));
      }

      pdfDoc.addPage(copiedPage);

      if (!pageMapping.has(item.originalPageNumber)) {
        pageMapping.set(item.originalPageNumber, newPageNumber);
      }
    } else {
      // Newly inserted addendum / notes page
      insertedCount++;
      const w = item.width || 612;
      const h = item.height || 792;
      const newPage = pdfDoc.addPage([w, h]);

      if (item.rotation !== 0) {
        newPage.setRotation(degrees(item.rotation % 360));
      }

      const title = item.customTitle || `Supplemental Addendum & Notes (Page ${newPageNumber})`;
      newPage.drawRectangle({
        x: 0,
        y: h - 14,
        width: w,
        height: 14,
        color: rgb(0.08, 0.15, 0.28),
      });

      newPage.drawText(title, {
        x: 45,
        y: h - 50,
        size: 13,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.25),
      });

      newPage.drawText(
        'Inserted via AcroXFA Page Organizer · Preserves XFA Packet Structure & Datasets',
        {
          x: 45,
          y: h - 66,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.4, 0.45, 0.55),
        }
      );

      newPage.drawLine({
        start: { x: 45, y: h - 78 },
        end: { x: w - 45, y: h - 78 },
        thickness: 1,
        color: rgb(0.82, 0.86, 0.9),
      });

      // Draw ruled notes box
      newPage.drawRectangle({
        x: 45,
        y: 65,
        width: w - 90,
        height: h - 165,
        borderColor: rgb(0.82, 0.86, 0.92),
        borderWidth: 1,
        color: rgb(0.99, 0.99, 1),
      });
    }
  }

  // Remove the original pages from the front of the document (indices originalPageCount - 1 down to 0)
  for (let i = originalPageCount - 1; i >= 0; i--) {
    pdfDoc.removePage(i);
  }

  // Compute deleted original pages and reordered count
  const deletedPageNumbers: number[] = [];
  for (let orig = 1; orig <= originalPageCount; orig++) {
    if (!pageMapping.has(orig)) {
      deletedPageNumbers.push(orig);
    }
  }

  let reorderedCount = 0;
  organizedPages.forEach((item, idx) => {
    if (item.originalPageNumber !== null && item.originalPageNumber !== idx + 1) {
      reorderedCount++;
    }
  });

  const savedBytes = await pdfDoc.save();

  return {
    pdfBytes: savedBytes,
    newPageCount: organizedPages.length,
    reorderedCount,
    deletedPageNumbers,
    insertedCount,
    pageMapping,
  };
}

/**
 * Updates XFASubform field bounds so fields stay aligned with their reordered page numbers.
 * If a page was deleted, fields on that page are reassigned to Page 1 (or the nearest surviving page)
 * unless removeDeletedPageFields is true.
 */
export function remapSubformsAfterPageOrganization(
  subforms: XFASubform[],
  pageMapping: Map<number, number>,
  deletedPageNumbers: number[],
  removeDeletedPageFields = false
): XFASubform[] {
  const deletedSet = new Set(deletedPageNumbers);

  const transformSubformList = (list: XFASubform[]): XFASubform[] => {
    return list.map(sf => {
      const updatedFields = sf.fields
        .filter(f => {
          if (!removeDeletedPageFields) return true;
          const origPage = f.bounds?.pageNumber || 1;
          return !deletedSet.has(origPage);
        })
        .map(f => {
          const origPage = f.bounds?.pageNumber || 1;
          const mappedPage = pageMapping.get(origPage) ?? 1;
          if (!f.bounds || f.bounds.pageNumber === mappedPage) {
            return f;
          }
          return {
            ...f,
            bounds: {
              ...f.bounds,
              pageNumber: mappedPage,
            },
          };
        });

      return {
        ...sf,
        fields: updatedFields,
        subforms: transformSubformList(sf.subforms),
      };
    });
  };

  return transformSubformList(subforms);
}
