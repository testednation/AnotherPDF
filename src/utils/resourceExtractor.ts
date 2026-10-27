import { PDFDocument, PDFName, PDFDict, PDFStream, PDFRawStream, PDFArray, PDFRef } from 'pdf-lib';
import { inflate } from 'pako';
import JSZip from 'jszip';
import { pdfjsLib } from './pdfWorker';
import {
  ExtractedImageResource,
  ExtractedFontResource,
  ExtractedAttachmentResource,
  ExtractedTextPage,
  PdfDocumentMetadata,
  ExtractedResourceManifest,
  XFAPackets,
} from '../types/pdf';

/**
 * Extracts all embedded resources (images, fonts, attachments, XFA packets, text, metadata)
 * from a PDF file buffer.
 */
export async function extractAllPdfResources(
  pdfBytes: Uint8Array,
  xfaPackets: XFAPackets
): Promise<ExtractedResourceManifest> {
  const fileSizeBytes = pdfBytes.length;

  // 1. Load via pdf-lib for object-level extraction (images, fonts, attachments, metadata)
  let pdfLibDoc: PDFDocument | null = null;
  try {
    pdfLibDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  } catch (err) {
    console.warn('Could not load PDF with pdf-lib:', err);
  }

  // 2. Load via PDF.js for text extraction and visual validation
  let pdfJsDoc: any = null;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes.slice(0),
      enableXfa: true,
    });
    pdfJsDoc = await loadingTask.promise;
  } catch (err) {
    console.warn('Could not load PDF with PDF.js:', err);
  }

  const pageCount = pdfJsDoc ? pdfJsDoc.numPages : (pdfLibDoc ? pdfLibDoc.getPageCount() : 1);

  // 3. Extract Metadata
  const metadata = extractMetadata(pdfLibDoc, pdfJsDoc, fileSizeBytes, pageCount, xfaPackets);

  // 4. Extract Text Content (Page by Page)
  const textPages: ExtractedTextPage[] = [];
  let totalWords = 0;
  let totalCharacters = 0;

  if (pdfJsDoc) {
    for (let i = 1; i <= pageCount; i++) {
      try {
        const page = await pdfJsDoc.getPage(i);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map((item: any) => item.str || '');
        const pageText = textItems.join(' ').replace(/\s+/g, ' ').trim();
        const wordCount = pageText.length > 0 ? pageText.split(/\s+/).length : 0;
        const lineCount = pageText.length > 0 ? pageText.split(/\n/).length : 0;

        totalWords += wordCount;
        totalCharacters += pageText.length;

        textPages.push({
          pageNumber: i,
          text: pageText,
          wordCount,
          lineCount,
        });
      } catch (err) {
        console.warn(`Error extracting text for page ${i}:`, err);
        textPages.push({
          pageNumber: i,
          text: '',
          wordCount: 0,
          lineCount: 0,
        });
      }
    }
  }

  // 5. Extract Images
  const images = await extractImagesFromPdf(pdfLibDoc, pdfBytes);

  // 6. Extract Fonts
  const fonts = extractFontsFromPdf(pdfLibDoc);

  // 7. Extract Attachments
  const attachments = extractAttachmentsFromPdf(pdfLibDoc);

  return {
    images,
    fonts,
    attachments,
    textPages,
    totalWords,
    totalCharacters,
    xfaPackets,
    metadata,
  };
}

/**
 * Extracts metadata information
 */
function extractMetadata(
  pdfDoc: PDFDocument | null,
  pdfJsDoc: any,
  fileSizeBytes: number,
  pageCount: number,
  xfaPackets: XFAPackets
): PdfDocumentMetadata {
  const hasXfa = Boolean(xfaPackets.templateXml || xfaPackets.fullXdpXml);
  const isDynamic = Boolean(xfaPackets.fullXdpXml?.includes('dynamic') || xfaPackets.templateXml?.includes('subform'));

  const meta: PdfDocumentMetadata = {
    pageCount,
    fileSizeBytes,
    hasXfa,
    xfaType: hasXfa ? (isDynamic ? 'dynamic' : 'static') : 'none',
    hasAcroForm: false,
    isEncrypted: false,
  };

  if (pdfDoc) {
    try {
      meta.title = pdfDoc.getTitle() || undefined;
      meta.author = pdfDoc.getAuthor() || undefined;
      meta.subject = pdfDoc.getSubject() || undefined;
      const kw = pdfDoc.getKeywords();
      meta.keywords = Array.isArray(kw) ? kw.join(', ') : (typeof kw === 'string' ? kw : undefined);
      meta.creator = pdfDoc.getCreator() || undefined;
      meta.producer = pdfDoc.getProducer() || undefined;
      meta.creationDate = pdfDoc.getCreationDate()?.toLocaleString() || undefined;
      meta.modificationDate = pdfDoc.getModificationDate()?.toLocaleString() || undefined;

      const acroForm = pdfDoc.catalog.get(PDFName.of('AcroForm'));
      meta.hasAcroForm = Boolean(acroForm);
    } catch (err) {
      console.warn('Metadata parsing error:', err);
    }
  }

  return meta;
}

/**
 * Deeply scans PDF object graph to extract raster images and generate previews
 */
async function extractImagesFromPdf(pdfDoc: PDFDocument | null, rawBytes: Uint8Array): Promise<ExtractedImageResource[]> {
  const extractedImages: ExtractedImageResource[] = [];
  if (!pdfDoc) return extractedImages;

  const context = pdfDoc.context;
  const processedRefs = new Set<string>();
  let imageCounter = 1;

  // 1. Iterate over each page's Resources dictionary
  const pages = pdfDoc.getPages();
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const pageNumber = pageIdx + 1;
    const resourcesRef = page.node.get(PDFName.of('Resources'));
    if (!resourcesRef) continue;

    const resources = context.lookup(resourcesRef);
    if (!(resources instanceof PDFDict)) continue;

    const xObjectRef = resources.get(PDFName.of('XObject'));
    if (!xObjectRef) continue;

    const xObjectDict = context.lookup(xObjectRef);
    if (!(xObjectDict instanceof PDFDict)) continue;

    for (const [keyName, objRef] of xObjectDict.entries()) {
      const refStr = objRef.toString();
      if (processedRefs.has(refStr)) continue;
      processedRefs.add(refStr);

      const resolved = context.lookup(objRef);
      if (!(resolved instanceof PDFStream || resolved instanceof PDFRawStream)) continue;

      const subtype = resolved.dict.get(PDFName.of('Subtype'));
      if (subtype?.toString() !== '/Image') continue;

      try {
        const imageRes = await parseImageStream(
          resolved,
          imageCounter++,
          pageNumber,
          keyName.toString().replace(/^\//, '')
        );
        if (imageRes) {
          extractedImages.push(imageRes);
        }
      } catch (err) {
        console.warn('Failed parsing image stream:', err);
      }
    }
  }

  // 2. Also search all streams in context for image streams that might not be on immediate pages
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    const refStr = ref.toString();
    if (processedRefs.has(refStr)) continue;

    if (obj instanceof PDFStream || obj instanceof PDFRawStream) {
      const subtype = obj.dict.get(PDFName.of('Subtype'));
      if (subtype?.toString() === '/Image') {
        processedRefs.add(refStr);
        try {
          const imageRes = await parseImageStream(
            obj,
            imageCounter++,
            1,
            `EmbeddedImage_${imageCounter}`
          );
          if (imageRes) {
            extractedImages.push(imageRes);
          }
        } catch (err) {
          console.warn('Failed parsing indirect image stream:', err);
        }
      }
    }
  }

  // Fallback: If no images found through dicts, check for raw JPEG markers in binary (SOI 0xFFD8 to EOI 0xFFD9)
  if (extractedImages.length === 0) {
    const rawJpegs = extractRawJpegsFromBuffer(rawBytes);
    rawJpegs.forEach((jpegBytes, idx) => {
      const blob = new Blob([jpegBytes as any], { type: 'image/jpeg' });
      const dataUrl = URL.createObjectURL(blob);
      extractedImages.push({
        id: `raw-jpg-${idx + 1}`,
        name: `Extracted_Photo_${idx + 1}.jpg`,
        page: 1,
        width: 800,
        height: 600,
        colorSpace: 'DeviceRGB',
        bitsPerComponent: 8,
        filter: 'DCTDecode',
        sizeBytes: jpegBytes.length,
        format: 'jpeg',
        dataUrl,
        blob,
        aspectRatio: '4:3',
      });
    });
  }

  return extractedImages;
}

/**
 * Parses a single PDF image stream into a displayable and downloadable resource
 */
async function parseImageStream(
  stream: PDFStream | PDFRawStream,
  index: number,
  pageNumber: number,
  suggestedName: string
): Promise<ExtractedImageResource | null> {
  const dict = stream.dict;
  const widthObj = dict.get(PDFName.of('Width'));
  const heightObj = dict.get(PDFName.of('Height'));
  const colorSpaceObj = dict.get(PDFName.of('ColorSpace'));
  const bpcObj = dict.get(PDFName.of('BitsPerComponent'));
  const filterObj = dict.get(PDFName.of('Filter'));

  const width = widthObj ? parseInt(widthObj.toString(), 10) : 300;
  const height = heightObj ? parseInt(heightObj.toString(), 10) : 300;
  const bitsPerComponent = bpcObj ? parseInt(bpcObj.toString(), 10) : 8;
  const colorSpace = colorSpaceObj ? colorSpaceObj.toString().replace(/^\//, '') : 'DeviceRGB';
  const filter = filterObj ? filterObj.toString().replace(/^\//, '') : 'None';

  const rawContents = stream.getContents();

  // Case 1: DCTDecode is raw JPEG format!
  if (filter.includes('DCTDecode') || filter.includes('DCT')) {
    const blob = new Blob([rawContents as any], { type: 'image/jpeg' });
    const dataUrl = URL.createObjectURL(blob);
    return {
      id: `img-${index}`,
      name: `${suggestedName || `Image_${index}`}.jpg`,
      page: pageNumber,
      width,
      height,
      colorSpace,
      bitsPerComponent,
      filter,
      sizeBytes: rawContents.length,
      format: 'jpeg',
      dataUrl,
      blob,
      aspectRatio: `${width}:${height}`,
    };
  }

  // Case 2: FlateDecode (Deflate compressed raw pixels)
  let decompressedBytes = rawContents;
  if (filter.includes('FlateDecode')) {
    try {
      decompressedBytes = inflate(rawContents);
    } catch (e) {
      // Might already be decompressed by pdf-lib
      decompressedBytes = rawContents;
    }
  }

  // Render raw RGB/RGBA or Grayscale pixels to Canvas to generate high-quality PNG
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx && width > 0 && height > 0) {
      const imgData = ctx.createImageData(width, height);
      const isGray = colorSpace.includes('Gray') || colorSpace.includes('DeviceGray');
      const isCmyk = colorSpace.includes('CMYK');
      const isRgb = !isGray && !isCmyk;

      let srcIdx = 0;
      let dstIdx = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (isRgb) {
            imgData.data[dstIdx] = decompressedBytes[srcIdx] ?? 0;
            imgData.data[dstIdx + 1] = decompressedBytes[srcIdx + 1] ?? 0;
            imgData.data[dstIdx + 2] = decompressedBytes[srcIdx + 2] ?? 0;
            imgData.data[dstIdx + 3] = 255;
            srcIdx += 3;
          } else if (isGray) {
            const gray = decompressedBytes[srcIdx] ?? 0;
            imgData.data[dstIdx] = gray;
            imgData.data[dstIdx + 1] = gray;
            imgData.data[dstIdx + 2] = gray;
            imgData.data[dstIdx + 3] = 255;
            srcIdx += 1;
          } else if (isCmyk) {
            const c = (decompressedBytes[srcIdx] ?? 0) / 255;
            const m = (decompressedBytes[srcIdx + 1] ?? 0) / 255;
            const yk = (decompressedBytes[srcIdx + 2] ?? 0) / 255;
            const k = (decompressedBytes[srcIdx + 3] ?? 0) / 255;
            imgData.data[dstIdx] = 255 * (1 - c) * (1 - k);
            imgData.data[dstIdx + 1] = 255 * (1 - m) * (1 - k);
            imgData.data[dstIdx + 2] = 255 * (1 - yk) * (1 - k);
            imgData.data[dstIdx + 3] = 255;
            srcIdx += 4;
          }
          dstIdx += 4;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (blob) {
        const dataUrl = URL.createObjectURL(blob);
        return {
          id: `img-${index}`,
          name: `${suggestedName || `Image_${index}`}.png`,
          page: pageNumber,
          width,
          height,
          colorSpace,
          bitsPerComponent,
          filter,
          sizeBytes: blob.size,
          format: 'png',
          dataUrl,
          blob,
          aspectRatio: `${width}:${height}`,
        };
      }
    }
  } catch (canvasErr) {
    console.warn('Canvas pixel rendering fallback error:', canvasErr);
  }

  // Fallback as binary blob
  const genericBlob = new Blob([decompressedBytes as any], { type: 'application/octet-stream' });
  return {
    id: `img-${index}`,
    name: `${suggestedName || `Image_${index}`}.bin`,
    page: pageNumber,
    width,
    height,
    colorSpace,
    bitsPerComponent,
    filter,
    sizeBytes: decompressedBytes.length,
    format: 'raw',
    dataUrl: '',
    blob: genericBlob,
    aspectRatio: `${width}:${height}`,
  };
}

/**
 * Searches buffer for embedded JPEG SOI/EOI chunks
 */
function extractRawJpegsFromBuffer(buffer: Uint8Array): Uint8Array[] {
  const jpegs: Uint8Array[] = [];
  const len = buffer.length;

  for (let i = 0; i < len - 3; i++) {
    // Check for SOI: 0xFF, 0xD8, 0xFF
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd8 && buffer[i + 2] === 0xff) {
      // Find matching EOI: 0xFF, 0xD9
      for (let j = i + 3; j < len - 1; j++) {
        if (buffer[j] === 0xff && buffer[j + 1] === 0xd9) {
          const jpegSlice = buffer.slice(i, j + 2);
          if (jpegSlice.length > 512) {
            jpegs.push(jpegSlice);
          }
          i = j + 2;
          break;
        }
      }
    }
  }

  return jpegs;
}

/**
 * Extracts fonts and embedded font programs (TrueType, OpenType, Type1)
 */
function extractFontsFromPdf(pdfDoc: PDFDocument | null): ExtractedFontResource[] {
  const fonts: ExtractedFontResource[] = [];
  if (!pdfDoc) return fonts;

  const context = pdfDoc.context;
  const processedNames = new Set<string>();
  let fontIndex = 1;

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict) {
      const type = obj.get(PDFName.of('Type'));
      if (type?.toString() === '/Font') {
        const subtype = obj.get(PDFName.of('Subtype'))?.toString().replace(/^\//, '') || 'Unknown';
        const baseFont = obj.get(PDFName.of('BaseFont'))?.toString().replace(/^\//, '') || `Font_${fontIndex}`;
        const encoding = obj.get(PDFName.of('Encoding'))?.toString().replace(/^\//, '');

        if (processedNames.has(baseFont)) continue;
        processedNames.add(baseFont);

        // Check if font descriptor exists and has embedded FontFile / FontFile2 / FontFile3
        let isEmbedded = false;
        let fontData: Uint8Array | undefined;
        let fontExt: 'ttf' | 'otf' | 'cff' | 'bin' = 'ttf';

        const fontDescRef = obj.get(PDFName.of('FontDescriptor'));
        if (fontDescRef) {
          const fontDesc = context.lookup(fontDescRef);
          if (fontDesc instanceof PDFDict) {
            const fontFile2 = fontDesc.get(PDFName.of('FontFile2')); // TrueType
            const fontFile3 = fontDesc.get(PDFName.of('FontFile3')); // OpenType / CFF
            const fontFile = fontDesc.get(PDFName.of('FontFile'));   // Type1

            const targetStreamRef = fontFile2 || fontFile3 || fontFile;
            if (targetStreamRef) {
              const stream = context.lookup(targetStreamRef);
              if (stream instanceof PDFStream || stream instanceof PDFRawStream) {
                isEmbedded = true;
                let contents = stream.getContents();
                // If filtered with FlateDecode, decompress
                const f = stream.dict.get(PDFName.of('Filter'))?.toString() || '';
                if (f.includes('FlateDecode')) {
                  try {
                    contents = inflate(contents);
                  } catch {
                    // ignore
                  }
                }
                fontData = contents;
                if (fontFile2) fontExt = 'ttf';
                else if (fontFile3) fontExt = 'otf';
                else fontExt = 'cff';
              }
            }
          }
        }

        // Clean font name (strip random prefix like ABCD+Arial)
        const cleanName = baseFont.replace(/^[A-Z]{6}\+/, '');

        fonts.push({
          id: `font-${fontIndex++}`,
          name: cleanName,
          baseFont,
          subtype,
          encoding,
          isEmbedded,
          fontData,
          fontExtension: fontExt,
          sizeBytes: fontData ? fontData.length : undefined,
        });
      }
    }
  }

  return fonts;
}

/**
 * Extracts attachments and associated files from Document Catalog and annotations
 */
function extractAttachmentsFromPdf(pdfDoc: PDFDocument | null): ExtractedAttachmentResource[] {
  const attachments: ExtractedAttachmentResource[] = [];
  if (!pdfDoc) return attachments;

  const context = pdfDoc.context;
  try {
    const catalog = pdfDoc.catalog;
    const namesRef = catalog.get(PDFName.of('Names'));
    if (namesRef) {
      const names = context.lookup(namesRef);
      if (names instanceof PDFDict) {
        const embeddedFilesRef = names.get(PDFName.of('EmbeddedFiles'));
        if (embeddedFilesRef) {
          const efDict = context.lookup(embeddedFilesRef);
          if (efDict instanceof PDFDict) {
            const namesArrayRef = efDict.get(PDFName.of('Names'));
            if (namesArrayRef) {
              const namesArray = context.lookup(namesArrayRef);
              if (namesArray instanceof PDFArray) {
                for (let i = 0; i < namesArray.size(); i += 2) {
                  const fileNameObj = namesArray.get(i);
                  const fileSpecRef = namesArray.get(i + 1);
                  const fileName = fileNameObj ? fileNameObj.toString().replace(/^"|"$/g, '').replace(/^\/|\/$/g, '') : `attachment_${i}`;

                  if (fileSpecRef) {
                    const fileSpec = context.lookup(fileSpecRef);
                    if (fileSpec instanceof PDFDict) {
                      const efEntry = fileSpec.get(PDFName.of('EF'));
                      if (efEntry) {
                        const efObj = context.lookup(efEntry);
                        if (efObj instanceof PDFDict) {
                          const streamRef = efObj.get(PDFName.of('F')) || efObj.get(PDFName.of('UF'));
                          if (streamRef) {
                            const stream = context.lookup(streamRef);
                            if (stream instanceof PDFStream || stream instanceof PDFRawStream) {
                              let data = stream.getContents();
                              const filter = stream.dict.get(PDFName.of('Filter'))?.toString() || '';
                              if (filter.includes('FlateDecode')) {
                                try {
                                  data = inflate(data);
                                } catch {
                                  // ignore
                                }
                              }
                              const mime = getMimeType(fileName);
                              attachments.push({
                                id: `att-${i}`,
                                name: fileName,
                                mimeType: mime,
                                sizeBytes: data.length,
                                data,
                              });
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error reading embedded files:', err);
  }

  return attachments;
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'xml': return 'application/xml';
    case 'json': return 'application/json';
    case 'csv': return 'text/csv';
    case 'txt': return 'text/plain';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'zip': return 'application/zip';
    default: return 'application/octet-stream';
  }
}

/**
 * Creates and triggers a download of all extracted PDF resources in a clean structured ZIP file!
 */
export async function downloadAllResourcesAsZip(
  manifest: ExtractedResourceManifest,
  originalFilename: string
): Promise<void> {
  const zip = new JSZip();
  const baseName = originalFilename.replace(/\.pdf$/i, '');

  // 1. Folder: /images
  if (manifest.images.length > 0) {
    const imgFolder = zip.folder('images');
    if (imgFolder) {
      manifest.images.forEach(img => {
        imgFolder.file(img.name, img.blob);
      });
    }
  }

  // 2. Folder: /fonts
  const embeddedFonts = manifest.fonts.filter(f => f.isEmbedded && f.fontData);
  if (embeddedFonts.length > 0) {
    const fontFolder = zip.folder('fonts');
    if (fontFolder) {
      embeddedFonts.forEach(font => {
        const ext = font.fontExtension || 'ttf';
        const filename = `${font.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
        fontFolder.file(filename, font.fontData!);
      });
    }
  }

  // 3. Folder: /attachments
  if (manifest.attachments.length > 0) {
    const attFolder = zip.folder('attachments');
    if (attFolder) {
      manifest.attachments.forEach(att => {
        attFolder.file(att.name, att.data);
      });
    }
  }

  // 4. Folder: /xfa
  if (manifest.xfaPackets.templateXml || manifest.xfaPackets.datasetsXml || manifest.xfaPackets.fullXdpXml) {
    const xfaFolder = zip.folder('xfa');
    if (xfaFolder) {
      if (manifest.xfaPackets.templateXml) {
        xfaFolder.file('template.xml', manifest.xfaPackets.templateXml);
      }
      if (manifest.xfaPackets.datasetsXml) {
        xfaFolder.file('datasets.xml', manifest.xfaPackets.datasetsXml);
      }
      if (manifest.xfaPackets.configXml) {
        xfaFolder.file('config.xml', manifest.xfaPackets.configXml);
      }
      if (manifest.xfaPackets.localeSetXml) {
        xfaFolder.file('localeSet.xml', manifest.xfaPackets.localeSetXml);
      }
      if (manifest.xfaPackets.fullXdpXml) {
        xfaFolder.file('package.xdp', manifest.xfaPackets.fullXdpXml);
      }
    }
  }

  // 5. Folder: /text
  if (manifest.textPages.length > 0) {
    const textFolder = zip.folder('text');
    if (textFolder) {
      let fullText = '';
      manifest.textPages.forEach(p => {
        textFolder.file(`page_${p.pageNumber}.txt`, p.text);
        fullText += `--- Page ${p.pageNumber} ---\n\n${p.text}\n\n`;
      });
      textFolder.file('complete_document_text.txt', fullText);
    }
  }

  // 6. JSON Manifest & README
  const summaryJson = JSON.stringify({
    document: {
      originalFilename,
      metadata: manifest.metadata,
      totalWords: manifest.totalWords,
      totalCharacters: manifest.totalCharacters,
    },
    counts: {
      images: manifest.images.length,
      fonts: manifest.fonts.length,
      embeddedFonts: embeddedFonts.length,
      attachments: manifest.attachments.length,
      textPages: manifest.textPages.length,
      hasXfa: manifest.metadata.hasXfa,
      xfaType: manifest.metadata.xfaType,
    },
    extractedAt: new Date().toISOString(),
  }, null, 2);

  zip.file('manifest.json', summaryJson);
  zip.file('README.txt', `AcroXFA Resource Extraction Archive
Original Document: ${originalFilename}
Extracted on: ${new Date().toLocaleString()}

Archive contents:
- /images/: All raster images extracted from pages and XObjects.
- /fonts/: Embedded TrueType/OpenType font programs.
- /attachments/: File attachments found in the PDF.
- /xfa/: XML Forms Architecture templates, datasets, and configuration.
- /text/: Plain-text extracted per page and combined.
- manifest.json: Complete structured metadata and resource inventory.
`);

  // Generate and download zip
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${baseName}_extracted_resources.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Triggers a download of a single binary or blob resource
 */
export function downloadResource(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
