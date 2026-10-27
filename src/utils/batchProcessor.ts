import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import JSZip from 'jszip';
import { extractXfaPackets, parseXfaTemplate, extractDataValues } from './xfaEngine';
import { XFAField } from '../types/pdf';

export interface BatchFieldRecord {
  id: string;
  name: string;
  caption: string;
  type: string;
  value: string;
  required?: boolean;
  subform?: string;
  page?: number;
}

export interface BatchFileItem {
  id: string;
  filename: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
  fields: BatchFieldRecord[];
  dataMap: Record<string, string>;
  metadata: {
    formTitle: string;
    xfaType: 'Dynamic XFA' | 'Static XFA' | 'AcroForm' | 'Standard PDF';
    pageCount: number;
    subformCount: number;
    packetCount: number;
    completionPercentage: number;
    processedAt: string;
  };
  rawXml?: string;
}

export interface BatchSchemaColumn {
  key: string;
  label: string;
  type: string;
  subform?: string;
  occurrences: number;
  sampleValues: string[];
}

export interface BatchProcessingSummary {
  totalFiles: number;
  completedFiles: number;
  errorFiles: number;
  totalFieldsExtracted: number;
  uniqueSchemaColumns: number;
  avgCompletionRate: number;
}

/**
 * Escapes a cell value for RFC 4180 CSV export
 */
function escapeCsvCell(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Escapes XML strings for OpenXML Excel sheets
 */
function escapeXml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Process a single PDF file (Uint8Array) to extract all XFA / AcroForm data fields.
 */
export async function processPdfForBatch(
  bytes: Uint8Array,
  filename: string
): Promise<BatchFileItem> {
  const fileId = 'file_' + Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();

  try {
    let pdfDoc: PDFDocument | null = null;
    try {
      pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    } catch (e: any) {
      console.warn('PDFDocument load issue:', e);
    }

    const packets = pdfDoc
      ? await extractXfaPackets(pdfDoc, bytes)
      : { otherPackets: {} };

    const pageCount = pdfDoc ? pdfDoc.getPageCount() : 1;
    const packetCount = Object.keys(packets.otherPackets).length +
      (packets.templateXml ? 1 : 0) +
      (packets.datasetsXml ? 1 : 0) +
      (packets.configXml ? 1 : 0);

    const extractedFields: BatchFieldRecord[] = [];
    const dataMap: Record<string, string> = {};
    let subformCount = 0;
    let detectedType: 'Dynamic XFA' | 'Static XFA' | 'AcroForm' | 'Standard PDF' = 'Standard PDF';
    let formTitle = filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

    // 1. Try XFA Extraction first
    if (packets.templateXml || packets.datasetsXml || packets.fullXdpXml) {
      const subforms = parseXfaTemplate(packets.templateXml, packets.datasetsXml);
      subformCount = subforms.length;

      const isDynamic = !!(
        packets.templateXml?.includes('dynamic') ||
        packets.configXml?.includes('dynamic') ||
        packets.templateXml?.includes('flow="table"') ||
        packets.templateXml?.includes('min="0"')
      );
      detectedType = isDynamic ? 'Dynamic XFA' : 'Static XFA';

      // Traverse subforms to collect fields
      const collectFields = (sfList: typeof subforms, parentName = '') => {
        for (const sf of sfList) {
          if (!formTitle || formTitle === filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')) {
            if (sf.title && sf.title.length > 2) formTitle = sf.title;
          }

          for (const f of sf.fields) {
            const key = f.name || f.id;
            const caption = f.caption || f.name || f.id;
            const record: BatchFieldRecord = {
              id: f.id,
              name: key,
              caption: caption,
              type: f.type,
              value: f.value ?? '',
              required: f.required,
              subform: sf.name || sf.title || parentName,
              page: f.bounds?.pageNumber || sf.pageNumber || 1,
            };
            extractedFields.push(record);
            dataMap[key] = f.value ?? '';
            // Also store by caption if distinct
            if (caption && caption !== key && !dataMap[caption]) {
              dataMap[caption] = f.value ?? '';
            }
          }
          if (sf.subforms && sf.subforms.length > 0) {
            collectFields(sf.subforms, sf.name || parentName);
          }
        }
      };
      collectFields(subforms);

      // If datasets XML has additional fields not explicitly declared in template, include them
      if (packets.datasetsXml) {
        const rawMap = extractDataValues(packets.datasetsXml);
        for (const [k, v] of rawMap.entries()) {
          // If not already in dataMap, add it as extra field record
          if (dataMap[k] === undefined && !k.includes('.')) {
            dataMap[k] = v;
            extractedFields.push({
              id: 'ds_' + k,
              name: k,
              caption: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(),
              type: 'text',
              value: v,
              subform: 'Datasets XML',
              page: 1,
            });
          }
        }
      }
    } else if (pdfDoc) {
      // 2. Check for AcroForm fields
      try {
        const form = pdfDoc.getForm();
        const acroFields = form.getFields();
        if (acroFields.length > 0) {
          detectedType = 'AcroForm';
          for (const af of acroFields) {
            const name = af.getName();
            let value = '';
            let fieldType = 'text';

            try {
              const constructorName = af.constructor.name;
              if (constructorName.includes('TextField')) {
                fieldType = 'text';
                value = (af as any).getText() || '';
              } else if (constructorName.includes('CheckBox')) {
                fieldType = 'check';
                value = (af as any).isChecked() ? 'true' : 'false';
              } else if (constructorName.includes('Dropdown')) {
                fieldType = 'choice';
                const sel = (af as any).getSelected();
                value = Array.isArray(sel) ? sel.join(', ') : (sel || '');
              } else if (constructorName.includes('RadioGroup')) {
                fieldType = 'choice';
                value = (af as any).getSelected() || '';
              } else {
                value = (af as any).getText ? (af as any).getText() || '' : '';
              }
            } catch {
              // fallback
            }

            extractedFields.push({
              id: 'acro_' + name,
              name,
              caption: name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(),
              type: fieldType,
              value,
              subform: 'AcroForm',
              page: 1,
            });
            dataMap[name] = value;
          }
        }
      } catch {
        // No AcroForm or empty
      }
    }

    // Compute completion %
    const filledCount = extractedFields.filter(f => f.value && f.value.trim().length > 0 && f.value !== '0' && f.value !== 'false').length;
    const completionPercentage = extractedFields.length > 0
      ? Math.round((filledCount / extractedFields.length) * 100)
      : 0;

    return {
      id: fileId,
      filename,
      fileSize: bytes.byteLength,
      status: 'completed',
      fields: extractedFields,
      dataMap,
      metadata: {
        formTitle,
        xfaType: detectedType,
        pageCount,
        subformCount,
        packetCount,
        completionPercentage,
        processedAt: now,
      },
      rawXml: packets.datasetsXml || packets.fullXdpXml,
    };
  } catch (err: any) {
    return {
      id: fileId,
      filename,
      fileSize: bytes.byteLength,
      status: 'error',
      errorMessage: err.message || 'Failed to process document',
      fields: [],
      dataMap: {},
      metadata: {
        formTitle: filename,
        xfaType: 'Standard PDF',
        pageCount: 1,
        subformCount: 0,
        packetCount: 0,
        completionPercentage: 0,
        processedAt: now,
      },
    };
  }
}

/**
 * Builds the unified schema of all unique fields across all processed files
 */
export function extractBatchSchema(items: BatchFileItem[]): BatchSchemaColumn[] {
  const schemaMap = new Map<string, {
    key: string;
    label: string;
    type: string;
    subform?: string;
    occurrences: number;
    sampleValues: Set<string>;
  }>();

  for (const item of items) {
    if (item.status !== 'completed') continue;

    for (const f of item.fields) {
      const key = f.name || f.caption;
      const existing = schemaMap.get(key);
      if (existing) {
        existing.occurrences += 1;
        if (f.value && existing.sampleValues.size < 5) {
          existing.sampleValues.add(f.value);
        }
        if (!existing.subform && f.subform) existing.subform = f.subform;
      } else {
        const samples = new Set<string>();
        if (f.value) samples.add(f.value);
        schemaMap.set(key, {
          key,
          label: f.caption || key,
          type: f.type || 'text',
          subform: f.subform,
          occurrences: 1,
          sampleValues: samples,
        });
      }
    }
  }

  // Sort schema by occurrences descending, then by name
  return Array.from(schemaMap.values()).map(col => ({
    key: col.key,
    label: col.label,
    type: col.type,
    subform: col.subform,
    occurrences: col.occurrences,
    sampleValues: Array.from(col.sampleValues),
  })).sort((a, b) => b.occurrences - a.occurrences || a.label.localeCompare(b.label));
}

/**
 * Generates Consolidated CSV in either Wide Matrix format or Normalized Long format
 */
export function generateBatchCsv(
  items: BatchFileItem[],
  mode: 'matrix' | 'normalized',
  schema?: BatchSchemaColumn[]
): string {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel
  const activeSchema = schema || extractBatchSchema(items);

  if (mode === 'matrix') {
    // Columns: Document, Form Title, XFA Type, Total Fields, Completion %, [Discovered Fields...]
    const headers = [
      'Document Name',
      'Form Title',
      'XFA Type',
      'Extracted Fields Count',
      'Completion Rate (%)',
      'Processed Timestamp',
      ...activeSchema.map(col => col.label || col.key),
    ];

    const rows: string[] = [headers.map(escapeCsvCell).join(',')];

    for (const item of items) {
      if (item.status !== 'completed') {
        const errRow = [
          item.filename,
          'ERROR: ' + (item.errorMessage || 'Extraction Failed'),
          item.metadata.xfaType,
          0,
          0,
          item.metadata.processedAt,
          ...activeSchema.map(() => ''),
        ];
        rows.push(errRow.map(escapeCsvCell).join(','));
        continue;
      }

      const rowValues = [
        item.filename,
        item.metadata.formTitle,
        item.metadata.xfaType,
        item.fields.length,
        `${item.metadata.completionPercentage}%`,
        item.metadata.processedAt,
      ];

      for (const col of activeSchema) {
        // Look up by key or caption
        const val = item.dataMap[col.key] ??
          item.fields.find(f => f.name === col.key || f.caption === col.label)?.value ??
          '';
        rowValues.push(val);
      }

      rows.push(rowValues.map(escapeCsvCell).join(','));
    }

    return BOM + rows.join('\r\n');
  } else {
    // Normalized Long Format
    const headers = [
      'Document Name',
      'Form Title',
      'XFA Type',
      'Field ID',
      'Field Name',
      'Field Caption / Label',
      'Field Type',
      'Field Value',
      'Required',
      'Subform / Section',
      'Page Number',
    ];

    const rows: string[] = [headers.map(escapeCsvCell).join(',')];

    for (const item of items) {
      if (item.status !== 'completed') continue;
      for (const f of item.fields) {
        const row = [
          item.filename,
          item.metadata.formTitle,
          item.metadata.xfaType,
          f.id,
          f.name,
          f.caption,
          f.type,
          f.value,
          f.required ? 'Yes' : 'No',
          f.subform || '',
          f.page || 1,
        ];
        rows.push(row.map(escapeCsvCell).join(','));
      }
    }

    return BOM + rows.join('\r\n');
  }
}

/**
 * Generates Consolidated JSON export in either nested or flat matrix format
 */
export function generateBatchJson(
  items: BatchFileItem[],
  format: 'nested' | 'flat_matrix',
  schema?: BatchSchemaColumn[]
): string {
  const activeSchema = schema || extractBatchSchema(items);
  const completed = items.filter(i => i.status === 'completed');

  if (format === 'flat_matrix') {
    const flatRecords = completed.map(item => {
      const record: Record<string, any> = {
        _documentName: item.filename,
        _formTitle: item.metadata.formTitle,
        _xfaType: item.metadata.xfaType,
        _completionRate: item.metadata.completionPercentage,
        _fieldCount: item.fields.length,
        _processedAt: item.metadata.processedAt,
      };

      for (const col of activeSchema) {
        const val = item.dataMap[col.key] ??
          item.fields.find(f => f.name === col.key || f.caption === col.label)?.value ??
          '';
        record[col.key] = val;
      }

      return record;
    });

    return JSON.stringify(flatRecords, null, 2);
  }

  // Nested structured JSON with schema definitions and document payloads
  const payload = {
    batchInfo: {
      generatedAt: new Date().toISOString(),
      engine: 'XFA PDF Consolidated Extractor (100% Offline Client)',
      totalFiles: items.length,
      completedFiles: completed.length,
      failedFiles: items.length - completed.length,
      uniqueSchemaFieldsCount: activeSchema.length,
      totalExtractedValues: completed.reduce((sum, item) => sum + item.fields.length, 0),
    },
    schema: activeSchema,
    documents: items.map(item => ({
      filename: item.filename,
      status: item.status,
      error: item.errorMessage,
      metadata: item.metadata,
      dataMap: item.dataMap,
      fields: item.fields,
    })),
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Generates a valid multi-sheet Microsoft Excel (.xlsx) workbook directly in browser via JSZip
 */
export async function generateBatchXlsx(
  items: BatchFileItem[],
  schema?: BatchSchemaColumn[]
): Promise<Blob> {
  const activeSchema = schema || extractBatchSchema(items);
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  // 3. xl/_rels/workbook.xml.rels
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // 4. xl/workbook.xml
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Consolidated Matrix" sheetId="1" r:id="rId1"/>
    <sheet name="Normalized Fields" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`
  );

  // 5. xl/styles.xml
  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0284C7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`
  );

  // Helper to convert column index (0-indexed) to Excel column letters (A, B, ..., Z, AA, AB, ...)
  const getColLetter = (colIdx: number): string => {
    let temp = colIdx;
    let letter = '';
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  // 6. xl/worksheets/sheet1.xml: Consolidated Matrix
  const matrixHeaders = [
    'Document Name',
    'Form Title',
    'XFA Type',
    'Fields Count',
    'Completion %',
    ...activeSchema.map(col => col.label || col.key),
  ];

  let sheet1Rows = `<row r="1">`;
  matrixHeaders.forEach((h, colIdx) => {
    const cellRef = `${getColLetter(colIdx)}1`;
    sheet1Rows += `<c r="${cellRef}" s="1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  sheet1Rows += `</row>`;

  items.forEach((item, rowIdx) => {
    const rNum = rowIdx + 2;
    sheet1Rows += `<row r="${rNum}">`;

    const rowData = [
      item.filename,
      item.metadata.formTitle,
      item.metadata.xfaType,
      item.fields.length.toString(),
      `${item.metadata.completionPercentage}%`,
    ];

    for (const col of activeSchema) {
      const val = item.dataMap[col.key] ??
        item.fields.find(f => f.name === col.key || f.caption === col.label)?.value ??
        '';
      rowData.push(val);
    }

    rowData.forEach((val, colIdx) => {
      const cellRef = `${getColLetter(colIdx)}${rNum}`;
      sheet1Rows += `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`;
    });

    sheet1Rows += `</row>`;
  });

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheet1Rows}</sheetData>
</worksheet>`
  );

  // 7. xl/worksheets/sheet2.xml: Normalized Fields
  const normHeaders = [
    'Document Name',
    'Field ID',
    'Field Name',
    'Field Label / Caption',
    'Field Type',
    'Field Value',
    'Required',
    'Subform',
  ];

  let sheet2Rows = `<row r="1">`;
  normHeaders.forEach((h, colIdx) => {
    const cellRef = `${getColLetter(colIdx)}1`;
    sheet2Rows += `<c r="${cellRef}" s="1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  sheet2Rows += `</row>`;

  let normRowCounter = 2;
  for (const item of items) {
    if (item.status !== 'completed') continue;
    for (const f of item.fields) {
      sheet2Rows += `<row r="${normRowCounter}">`;
      const normValues = [
        item.filename,
        f.id,
        f.name,
        f.caption,
        f.type,
        f.value,
        f.required ? 'Yes' : 'No',
        f.subform || '',
      ];
      normValues.forEach((val, colIdx) => {
        const cellRef = `${getColLetter(colIdx)}${normRowCounter}`;
        sheet2Rows += `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`;
      });
      sheet2Rows += `</row>`;
      normRowCounter++;
    }
  }

  zip.file(
    'xl/worksheets/sheet2.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheet2Rows}</sheetData>
</worksheet>`
  );

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Downloads a complete ZIP bundle with all consolidated formats and individual exports
 */
export async function generateBatchZip(
  items: BatchFileItem[],
  schema?: BatchSchemaColumn[]
): Promise<Blob> {
  const activeSchema = schema || extractBatchSchema(items);
  const zip = new JSZip();

  // 1. Consolidated CSVs
  const wideCsv = generateBatchCsv(items, 'matrix', activeSchema);
  zip.file('consolidated_matrix.csv', wideCsv);

  const normCsv = generateBatchCsv(items, 'normalized', activeSchema);
  zip.file('consolidated_normalized.csv', normCsv);

  // 2. Consolidated JSONs
  const fullJson = generateBatchJson(items, 'nested', activeSchema);
  zip.file('consolidated_complete.json', fullJson);

  const flatJson = generateBatchJson(items, 'flat_matrix', activeSchema);
  zip.file('consolidated_records.json', flatJson);

  // 3. Consolidated Excel
  const xlsxBlob = await generateBatchXlsx(items, activeSchema);
  zip.file('consolidated_workbook.xlsx', xlsxBlob);

  // 4. Subfolder with individual document JSON files
  const indivFolder = zip.folder('individual_documents');
  if (indivFolder) {
    for (const item of items) {
      const sanitizedName = item.filename.replace(/\.pdf$/i, '') + '.json';
      indivFolder.file(sanitizedName, JSON.stringify(item, null, 2));
    }
  }

  // 5. Readme / Manifest
  const manifest = `# Batch XFA Extraction Report
Batch Timestamp: ${new Date().toISOString()}
Total Documents Processed: ${items.length}
Unique Discovered Field Keys: ${activeSchema.length}

Files Included:
- consolidated_matrix.csv: Wide format table (1 row per PDF, columns for each unique field)
- consolidated_normalized.csv: Long format table (1 row per field extracted)
- consolidated_complete.json: Full structured document tree with schema definitions
- consolidated_records.json: Array of flat objects for database ingestion
- consolidated_workbook.xlsx: Microsoft Excel spreadsheet with formatted sheets
- individual_documents/: Detailed JSON extractions for each input PDF
`;
  zip.file('README_BATCH_REPORT.txt', manifest);

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Helper to download a Blob or string in browser
 */
export function downloadBatchFile(content: Blob | string, filename: string, mimeType = 'text/plain') {
  const blob = typeof content === 'string'
    ? new Blob([content], { type: mimeType })
    : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generates 3 realistic synthetic enterprise XFA PDF submissions
 * allowing instant zero-upload demonstration and verification of the batch extractor.
 */
export async function createSampleBatchFiles(): Promise<{ filename: string; bytes: Uint8Array }[]> {
  const sampleData = [
    {
      filename: 'Submission_001_Apex_Dynamics.pdf',
      companyName: 'Apex Dynamics International LLC',
      taxId: '82-9401827',
      incorpDate: '2019-04-12',
      entityType: 'Limited Liability Company (LLC)',
      contactName: 'Jonathan Vance',
      email: 'j.vance@apexdynamics.io',
      phone: '+1 (415) 890-2144',
      budget: '$2,450,000.00',
      status: 'Approved',
      isPublic: '0',
      complianceScore: '98',
      department: 'Enterprise Infrastructure',
      notes: 'Passed ISO-27001 and SOC2 Tier 3 verification with zero deviations.',
    },
    {
      filename: 'Submission_002_Meridian_BioHealth.pdf',
      companyName: 'Meridian BioHealth Therapeutics Corp',
      taxId: '36-7782190',
      incorpDate: '2015-11-03',
      entityType: 'Corporation (C-Corp)',
      contactName: 'Dr. Evelyn Morales',
      email: 'evelyn.morales@meridianbio.med',
      phone: '+1 (617) 555-0198',
      budget: '$5,800,000.00',
      status: 'Under Review',
      isPublic: '1',
      complianceScore: '94',
      department: 'Clinical Therapeutics & Trials',
      notes: 'FDA Phase II audit documentation attached in supplemental packet.',
    },
    {
      filename: 'Submission_003_Kestrel_Aerospace.pdf',
      companyName: 'Kestrel Autonomous Aerospace Systems',
      taxId: '94-3321568',
      incorpDate: '2022-08-20',
      entityType: 'Partnership',
      contactName: 'Marcus Sterling',
      email: 'm.sterling@kestrelaero.tech',
      phone: '+1 (206) 555-8821',
      budget: '$1,120,000.00',
      status: 'Pending Verification',
      isPublic: '0',
      complianceScore: '89',
      department: 'Avionics Guidance Systems',
      notes: 'Dual-use export classification pending regulatory review.',
    },
  ];

  const results: { filename: string; bytes: Uint8Array }[] = [];

  for (const s of sampleData) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    page.drawText(`Enterprise Registry - ${s.companyName}`, { x: 50, y: 740, size: 14 });
    page.drawText(`EIN: ${s.taxId} | Contact: ${s.contactName} (${s.email})`, { x: 50, y: 720, size: 9 });
    page.drawText(`Department: ${s.department} | Budget: ${s.budget} | Status: ${s.status}`, { x: 50, y: 700, size: 9 });

    // Build genuine XFA Template and Datasets XML
    const templateXml = `<template xmlns="http://www.xfa.org/schema/xfa-template/3.3/">
  <subform name="registryForm" layout="tb">
    <subform name="companyProfile">
      <field name="companyLegalName"><caption placement="top"><value><text>Company Legal Name</text></value></caption><ui><textEdit/></ui></field>
      <field name="federalTaxId"><caption placement="top"><value><text>Federal Tax ID / EIN</text></value></caption><ui><textEdit/></ui></field>
      <field name="registrationDate"><caption placement="top"><value><text>Incorporation Date</text></value></caption><ui><dateTimeEdit/></ui></field>
      <field name="businessStructure"><caption placement="top"><value><text>Entity Classification</text></value></caption><ui><choiceList/></ui></field>
      <field name="isPubliclyTraded"><caption placement="top"><value><text>Publicly Traded</text></value></caption><ui><checkButton/></ui></field>
      <field name="department"><caption placement="top"><value><text>Division / Department</text></value></caption><ui><textEdit/></ui></field>
    </subform>
    <subform name="contactInfo">
      <field name="primaryContactName"><caption placement="top"><value><text>Authorized Contact Person</text></value></caption><ui><textEdit/></ui></field>
      <field name="primaryEmailAddress"><caption placement="top"><value><text>Official Contact Email</text></value></caption><ui><textEdit/></ui></field>
      <field name="directPhone"><caption placement="top"><value><text>Direct Contact Phone</text></value></caption><ui><textEdit/></ui></field>
    </subform>
    <subform name="compliance">
      <field name="allocatedBudget"><caption placement="top"><value><text>Allocated Annual Budget</text></value></caption><ui><numericEdit/></ui></field>
      <field name="filingStatus"><caption placement="top"><value><text>Application Filing Status</text></value></caption><ui><choiceList/></ui></field>
      <field name="complianceAuditScore"><caption placement="top"><value><text>Audit Compliance Score</text></value></caption><ui><numericEdit/></ui></field>
      <field name="executiveNotes"><caption placement="top"><value><text>Executive Submission Notes</text></value></caption><ui><textEdit multiLine="1"/></ui></field>
    </subform>
  </subform>
</template>`;

    const datasetsXml = `<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/">
  <xfa:data>
    <registryForm>
      <companyProfile>
        <companyLegalName>${escapeXml(s.companyName)}</companyLegalName>
        <federalTaxId>${escapeXml(s.taxId)}</federalTaxId>
        <registrationDate>${escapeXml(s.incorpDate)}</registrationDate>
        <businessStructure>${escapeXml(s.entityType)}</businessStructure>
        <isPubliclyTraded>${escapeXml(s.isPublic)}</isPubliclyTraded>
        <department>${escapeXml(s.department)}</department>
      </companyProfile>
      <contactInfo>
        <primaryContactName>${escapeXml(s.contactName)}</primaryContactName>
        <primaryEmailAddress>${escapeXml(s.email)}</primaryEmailAddress>
        <directPhone>${escapeXml(s.phone)}</directPhone>
      </contactInfo>
      <compliance>
        <allocatedBudget>${escapeXml(s.budget)}</allocatedBudget>
        <filingStatus>${escapeXml(s.status)}</filingStatus>
        <complianceAuditScore>${escapeXml(s.complianceScore)}</complianceAuditScore>
        <executiveNotes>${escapeXml(s.notes)}</executiveNotes>
      </compliance>
    </registryForm>
  </xfa:data>
</xfa:datasets>`;

    const fullXdp = `<?xml version="1.0" encoding="UTF-8"?>
<xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/">
  ${templateXml}
  ${datasetsXml}
</xdp:xdp>`;

    // Embed XFA stream in PDF AcroForm
    const context = pdfDoc.context;
    const xfaStream = context.flateStream(fullXdp);
    const xfaStreamRef = context.register(xfaStream);

    const xfaArray = context.obj([
      PDFName.of('template'),
      context.register(context.flateStream(templateXml)),
      PDFName.of('datasets'),
      context.register(context.flateStream(datasetsXml)),
      PDFName.of('xdp:xdp'),
      xfaStreamRef,
    ]);

    const acroFormDict = context.obj({
      Fields: [],
      XFA: xfaArray,
      NeedAppearances: true,
    });

    pdfDoc.catalog.set(PDFName.of('AcroForm'), context.register(acroFormDict));

    const bytes = await pdfDoc.save();
    results.push({ filename: s.filename, bytes });
  }

  return results;
}
