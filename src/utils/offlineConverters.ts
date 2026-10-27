import JSZip from 'jszip';
import {
  XFAField,
  XFASubform,
  PdfDocumentMetadata,
  ExtractedTextPage,
  ExtractedResourceManifest,
} from '../types/pdf';

export interface ConversionOptions {
  includeMetadata: boolean;
  includeEmptyFields: boolean;
  includePageText: boolean;
  includeFieldProperties: boolean;
  theme: 'executive' | 'slate' | 'classic';
  documentTitle?: string;
  customNotes?: string;
}

export interface ConversionParams {
  filename: string;
  metadata?: PdfDocumentMetadata | null;
  fields: XFAField[];
  subforms: XFASubform[];
  textPages: ExtractedTextPage[];
  manifest?: ExtractedResourceManifest | null;
  options: ConversionOptions;
}

/**
 * Escapes XML special characters for OpenXML (.docx / .xlsx)
 */
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a valid Microsoft Word (.docx) document 100% offline using OpenXML & JSZip.
 */
export async function generateDocx(params: ConversionParams): Promise<Blob> {
  const { filename, metadata, fields, subforms, textPages, options } = params;
  const zip = new JSZip();

  const title = options.documentTitle || metadata?.title || filename.replace(/\.pdf$/i, '').replace(/_/g, ' ');
  const themeColors = {
    executive: { primary: '0284C7', text: '0F172A', light: 'F0F9FF', border: 'BAE6FD' },
    slate: { primary: '334155', text: '0F172A', light: 'F8FAFC', border: 'CBD5E1' },
    classic: { primary: '1E3A8A', text: '172554', light: 'EFF6FF', border: 'BFDBFE' },
  }[options.theme || 'executive'];

  // Filter fields based on options
  const targetFields = options.includeEmptyFields
    ? fields
    : fields.filter(f => f.value && f.value.trim().length > 0);

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // 3. word/_rels/document.xml.rels
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // 4. word/styles.xml
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="${themeColors.text}"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="276" w:lineRule="auto" w:after="160"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr>
      <w:spacing w:before="240" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:b/>
      <w:color w:val="${themeColors.primary}"/>
      <w:sz w:val="48"/>
      <w:szCs w:val="48"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr>
      <w:spacing w:before="360" w:after="140"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:color w:val="${themeColors.primary}"/>
      <w:sz w:val="32"/>
      <w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr>
      <w:spacing w:before="240" w:after="100"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:color w:val="${themeColors.primary}"/>
      <w:sz w:val="26"/>
      <w:szCs w:val="26"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="SubTitle">
    <w:name w:val="SubTitle"/>
    <w:pPr>
      <w:spacing w:after="240"/>
    </w:pPr>
    <w:rPr>
      <w:color w:val="64748B"/>
      <w:sz w:val="22"/>
      <w:szCs w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="${themeColors.border}"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="${themeColors.border}"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="${themeColors.border}"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="${themeColors.border}"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="${themeColors.border}"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="${themeColors.border}"/>
      </w:tblBorders>
    </w:tblPr>
  </w:style>
</w:styles>`
  );

  // 5. word/document.xml building
  let bodyContent = '';

  // Document Title Header
  bodyContent += `
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:t>${escapeXml(title)}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="SubTitle"/></w:pPr>
      <w:r><w:t>Converted from PDF / XFA Archive (${escapeXml(filename)}) · ${escapeXml(new Date().toLocaleDateString())}</w:t></w:r>
    </w:p>
  `;

  // Custom Notes if provided
  if (options.customNotes && options.customNotes.trim()) {
    bodyContent += `
      <w:p>
        <w:pPr>
          <w:pBdr>
            <w:left w:val="single" w:sz="18" w:space="15" w:color="${themeColors.primary}"/>
          </w:pBdr>
          <w:shd w:val="clear" w:color="auto" w:fill="${themeColors.light}"/>
          <w:spacing w:before="120" w:after="160"/>
          <w:ind w:left="240" w:right="240"/>
        </w:pPr>
        <w:r><w:rPr><w:i/></w:rPr><w:t>${escapeXml(options.customNotes)}</w:t></w:r>
      </w:p>
    `;
  }

  // Document Metadata Table (Optional)
  if (options.includeMetadata && metadata) {
    bodyContent += `
      <w:p>
        <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
        <w:r><w:t>Document Attributes &amp; Catalog</w:t></w:r>
      </w:p>
      <w:tbl>
        <w:tblPr>
          <w:tblStyle w:val="TableGrid"/>
          <w:tblW w:w="9360" w:type="dxa"/>
          <w:tblCellMar>
            <w:top w:w="120" w:type="dxa"/>
            <w:left w:w="160" w:type="dxa"/>
            <w:bottom w:w="120" w:type="dxa"/>
            <w:right w:w="160" w:type="dxa"/>
          </w:tblCellMar>
        </w:tblPr>
        <w:tblGrid>
          <w:gridCol w:w="3120"/>
          <w:gridCol w:w="6240"/>
        </w:tblGrid>
    `;

    const metaRows: [string, string][] = [
      ['Source File', filename],
      ['Document Title', metadata.title || 'Untitled'],
      ['Author / Originator', metadata.author || 'N/A'],
      ['Subject Matter', metadata.subject || 'N/A'],
      ['PDF Engine / Producer', metadata.producer || 'N/A'],
      ['XFA Architecture', metadata.hasXfa ? `${metadata.xfaType?.toUpperCase()} XFA` : 'Standard PDF'],
      ['Page Count', `${metadata.pageCount || 1} pages`],
    ];

    metaRows.forEach(([lbl, val]) => {
      bodyContent += `
        <w:tr>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="3120" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${themeColors.light}"/>
            </w:tcPr>
            <w:p><w:r><w:rPr><w:b/><w:color w:val="${themeColors.primary}"/></w:rPr><w:t>${escapeXml(lbl)}</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:tcW w:w="6240" w:type="dxa"/></w:tcPr>
            <w:p><w:r><w:t>${escapeXml(val)}</w:t></w:r></w:p>
          </w:tc>
        </w:tr>
      `;
    });

    bodyContent += `</w:tbl><w:p><w:pPr><w:spacing w:after="240"/></w:pPr></w:p>`;
  }

  // XFA Form Fields & Data Table
  if (targetFields.length > 0) {
    bodyContent += `
      <w:p>
        <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
        <w:r><w:t>XFA Form Records &amp; Field Data</w:t></w:r>
      </w:p>
      <w:p>
        <w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="20"/></w:rPr><w:t>Structured data entries extracted from interactive XFA template and datasets payload.</w:t></w:r>
      </w:p>
      <w:tbl>
        <w:tblPr>
          <w:tblStyle w:val="TableGrid"/>
          <w:tblW w:w="9360" w:type="dxa"/>
          <w:tblCellMar>
            <w:top w:w="120" w:type="dxa"/>
            <w:left w:w="160" w:type="dxa"/>
            <w:bottom w:w="120" w:type="dxa"/>
            <w:right w:w="160" w:type="dxa"/>
          </w:tblCellMar>
        </w:tblPr>
        <w:tblGrid>
          <w:gridCol w:w="3200"/>
          <w:gridCol w:w="1360"/>
          <w:gridCol w:w="4800"/>
        </w:tblGrid>
        <w:tr>
          <w:trPr><w:tblHeader/></w:trPr>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="3200" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${themeColors.primary}"/>
            </w:tcPr>
            <w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Field Caption</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="1360" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${themeColors.primary}"/>
            </w:tcPr>
            <w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Type</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="4800" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${themeColors.primary}"/>
            </w:tcPr>
            <w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Assigned Value</w:t></w:r></w:p>
          </w:tc>
        </w:tr>
    `;

    targetFields.forEach((f, idx) => {
      const bg = idx % 2 === 1 ? ` w:fill="${themeColors.light}"` : '';
      const displayVal = f.value
        ? f.type === 'check'
          ? f.value === '1' || f.value.toLowerCase() === 'true'
            ? '☑ Checked / Yes'
            : '☐ Unchecked / No'
          : f.value
        : '(empty)';

      bodyContent += `
        <w:tr>
          <w:tc>
            <w:tcPr><w:tcW w:w="3200" w:type="dxa"/><w:shd w:val="clear" w:color="auto"${bg}/></w:tcPr>
            <w:p>
              <w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(f.caption || f.name)}</w:t></w:r>
              ${
                options.includeFieldProperties
                  ? `<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t xml:space="preserve"> (${escapeXml(f.name)})</w:t></w:r>`
                  : ''
              }
            </w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:tcW w:w="1360" w:type="dxa"/><w:shd w:val="clear" w:color="auto"${bg}/></w:tcPr>
            <w:p><w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="18"/></w:rPr><w:t>${escapeXml(f.type.toUpperCase())}</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:shd w:val="clear" w:color="auto"${bg}/></w:tcPr>
            <w:p><w:r><w:t>${escapeXml(displayVal)}</w:t></w:r></w:p>
          </w:tc>
        </w:tr>
      `;
    });

    bodyContent += `</w:tbl><w:p><w:pPr><w:spacing w:after="240"/></w:pPr></w:p>`;
  }

  // Document Page Text Section (Optional)
  if (options.includePageText && textPages.length > 0) {
    bodyContent += `
      <w:p>
        <w:pPr>
          <w:pStyle w:val="Heading1"/>
          <w:pageBreakBefore/>
        </w:pPr>
        <w:r><w:t>Document Text Content (Page by Page)</w:t></w:r>
      </w:p>
    `;

    textPages.forEach(p => {
      bodyContent += `
        <w:p>
          <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
          <w:r><w:t>Page ${p.pageNumber}</w:t></w:r>
          <w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve"> · ${p.wordCount} words, ${p.lineCount} lines</w:t></w:r>
        </w:p>
      `;

      const lines = p.text.split('\n');
      lines.forEach(line => {
        if (line.trim().length > 0) {
          bodyContent += `
            <w:p>
              <w:pPr><w:spacing w:after="80"/></w:pPr>
              <w:r><w:t>${escapeXml(line)}</w:t></w:r>
            </w:p>
          `;
        }
      });
    });
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Generates a valid Microsoft Excel (.xlsx) workbook 100% offline using OpenXML & JSZip.
 */
export async function generateXlsx(params: ConversionParams): Promise<Blob> {
  const { filename, metadata, fields, options } = params;
  const zip = new JSZip();

  const targetFields = options.includeEmptyFields
    ? fields
    : fields.filter(f => f.value && f.value.trim().length > 0);

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
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
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // 4. xl/workbook.xml
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="XFA Form Fields" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
  );

  // 5. xl/styles.xml
  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
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

  // 6. xl/worksheets/sheet1.xml
  let sheetRows = '';
  // Header row
  sheetRows += `
    <row r="1" ht="24" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>Field Name</t></is></c>
      <c r="B1" s="1" t="inlineStr"><is><t>Caption / Label</t></is></c>
      <c r="C1" s="1" t="inlineStr"><is><t>Type</t></is></c>
      <c r="D1" s="1" t="inlineStr"><is><t>Assigned Value</t></is></c>
      <c r="E1" s="1" t="inlineStr"><is><t>Subform Parent</t></is></c>
      <c r="F1" s="1" t="inlineStr"><is><t>Data Path Binding</t></is></c>
      <c r="G1" s="1" t="inlineStr"><is><t>Page</t></is></c>
    </row>
  `;

  targetFields.forEach((f, idx) => {
    const rowNum = idx + 2;
    const pageNum = f.bounds?.pageNumber ? String(f.bounds.pageNumber) : '1';
    sheetRows += `
      <row r="${rowNum}">
        <c r="A${rowNum}" t="inlineStr"><is><t>${escapeXml(f.name)}</t></is></c>
        <c r="B${rowNum}" t="inlineStr"><is><t>${escapeXml(f.caption || f.name)}</t></is></c>
        <c r="C${rowNum}" t="inlineStr"><is><t>${escapeXml(f.type.toUpperCase())}</t></is></c>
        <c r="D${rowNum}" t="inlineStr"><is><t>${escapeXml(f.value || '')}</t></is></c>
        <c r="E${rowNum}" t="inlineStr"><is><t>${escapeXml(f.parentSubform || 'form1')}</t></is></c>
        <c r="F${rowNum}" t="inlineStr"><is><t>${escapeXml(f.dataRef || f.name)}</t></is></c>
        <c r="G${rowNum}" t="inlineStr"><is><t>${escapeXml(pageNum)}</t></is></c>
      </row>
    `;
  });

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="28" customWidth="1"/>
    <col min="2" max="2" width="34" customWidth="1"/>
    <col min="3" max="3" width="14" customWidth="1"/>
    <col min="4" max="4" width="40" customWidth="1"/>
    <col min="5" max="5" width="22" customWidth="1"/>
    <col min="6" max="6" width="30" customWidth="1"/>
    <col min="7" max="7" width="10" customWidth="1"/>
  </cols>
  <sheetData>
    ${sheetRows}
  </sheetData>
</worksheet>`
  );

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generates an Excel-ready UTF-8 CSV string (with BOM).
 */
export function generateCsv(params: ConversionParams): string {
  const { fields, options } = params;
  const targetFields = options.includeEmptyFields
    ? fields
    : fields.filter(f => f.value && f.value.trim().length > 0);

  const escapeCsv = (val: string) => {
    if (val === undefined || val === null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const headers = ['Field Name', 'Caption', 'Type', 'Value', 'Parent Subform', 'Data Path', 'Page'];
  const lines: string[] = [headers.map(escapeCsv).join(',')];

  targetFields.forEach(f => {
    lines.push([
      f.name,
      f.caption || f.name,
      f.type,
      f.value || '',
      f.parentSubform || '',
      f.dataRef || '',
      f.bounds?.pageNumber ? String(f.bounds.pageNumber) : '1',
    ].map(escapeCsv).join(','));
  });

  // Prepend UTF-8 Byte Order Mark (\uFEFF) for Microsoft Excel compatibility
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Generates a self-contained, responsive, printable HTML5 document.
 */
export function generateHtml(params: ConversionParams): string {
  const { filename, metadata, fields, textPages, options } = params;
  const title = options.documentTitle || metadata?.title || filename.replace(/\.pdf$/i, '').replace(/_/g, ' ');

  const targetFields = options.includeEmptyFields
    ? fields
    : fields.filter(f => f.value && f.value.trim().length > 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(title)}</title>
  <style>
    :root {
      --primary: #0284c7;
      --primary-dark: #0369a1;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--card-bg);
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05);
      border: 1px solid var(--border);
    }
    header {
      border-bottom: 2px solid var(--primary);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      color: var(--primary-dark);
      letter-spacing: -0.02em;
    }
    .subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 6px;
    }
    .notes-box {
      background: #f0f9ff;
      border-left: 4px solid var(--primary);
      padding: 14px 18px;
      border-radius: 4px;
      font-size: 14px;
      margin-bottom: 30px;
      color: #0369a1;
    }
    h2 {
      font-size: 18px;
      font-weight: 600;
      margin: 30px 0 14px 0;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 30px;
    }
    th {
      background-color: var(--primary);
      color: #ffffff;
      text-align: left;
      padding: 10px 14px;
      font-weight: 600;
    }
    td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .badge {
      display: inline-block;
      font-size: 10px;
      font-family: monospace;
      padding: 2px 6px;
      border-radius: 4px;
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 600;
    }
    .page-card {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .page-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 8px;
      font-family: monospace;
    }
    .page-text {
      font-size: 13px;
      white-space: pre-wrap;
      font-family: inherit;
    }
    footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .container { box-shadow: none; border: none; padding: 0; }
      footer { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${escapeXml(title)}</h1>
      <div class="subtitle">
        Converted from PDF / XFA Archive (${escapeXml(filename)}) · Extracted on ${escapeXml(new Date().toLocaleDateString())}
      </div>
    </header>

    ${
      options.customNotes
        ? `<div class="notes-box">${escapeXml(options.customNotes)}</div>`
        : ''
    }

    ${
      options.includeMetadata && metadata
        ? `
      <h2>Document Catalog Attributes</h2>
      <table>
        <tbody>
          <tr><td style="width:30%; font-weight:600; color:var(--text-muted);">Document Title</td><td>${escapeXml(metadata.title || 'Untitled')}</td></tr>
          <tr><td style="font-weight:600; color:var(--text-muted);">Author / Creator</td><td>${escapeXml(metadata.author || 'N/A')}</td></tr>
          <tr><td style="font-weight:600; color:var(--text-muted);">Subject Matter</td><td>${escapeXml(metadata.subject || 'N/A')}</td></tr>
          <tr><td style="font-weight:600; color:var(--text-muted);">PDF Producer</td><td>${escapeXml(metadata.producer || 'N/A')}</td></tr>
          <tr><td style="font-weight:600; color:var(--text-muted);">XFA Architecture</td><td><span class="badge">${metadata.hasXfa ? `${metadata.xfaType?.toUpperCase()} XFA` : 'Standard PDF'}</span></td></tr>
        </tbody>
      </table>
    `
        : ''
    }

    <h2>XFA Form Fields &amp; Values (${targetFields.length})</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 35%;">Field Caption</th>
          <th style="width: 15%;">Type</th>
          <th style="width: 50%;">Assigned Value</th>
        </tr>
      </thead>
      <tbody>
        ${targetFields
          .map(
            f => `
          <tr>
            <td>
              <strong>${escapeXml(f.caption || f.name)}</strong>
              ${options.includeFieldProperties ? `<br><small style="color:var(--text-muted); font-family:monospace;">${escapeXml(f.name)}</small>` : ''}
            </td>
            <td><span class="badge">${escapeXml(f.type.toUpperCase())}</span></td>
            <td>${escapeXml(f.value || '(empty)')}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    ${
      options.includePageText && textPages.length > 0
        ? `
      <h2>Document Text (Page by Page)</h2>
      ${textPages
        .map(
          p => `
        <div class="page-card">
          <div class="page-title">PAGE ${p.pageNumber} · ${p.wordCount} WORDS · ${p.lineCount} LINES</div>
          <div class="page-text">${escapeXml(p.text || '(No text content)')}</div>
        </div>
      `
        )
        .join('')}
    `
        : ''
    }

    <footer>
      <span>AcroXFA Universal Offline Document Converter</span>
      <span>Generated Client-Side in Browser</span>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Generates a clean Markdown (.md) representation.
 */
export function generateMarkdown(params: ConversionParams): string {
  const { filename, metadata, fields, textPages, options } = params;
  const title = options.documentTitle || metadata?.title || filename.replace(/\.pdf$/i, '').replace(/_/g, ' ');

  const targetFields = options.includeEmptyFields
    ? fields
    : fields.filter(f => f.value && f.value.trim().length > 0);

  let md = '';

  // YAML Frontmatter
  md += `---\n`;
  md += `title: "${title.replace(/"/g, '\\"')}"\n`;
  md += `source_pdf: "${filename}"\n`;
  md += `converted_at: "${new Date().toISOString()}"\n`;
  if (metadata?.author) md += `author: "${metadata.author.replace(/"/g, '\\"')}"\n`;
  md += `---\n\n`;

  // Title
  md += `# ${title}\n\n`;
  md += `*Converted from PDF / XFA Archive (${filename}) on ${new Date().toLocaleDateString()}*\n\n`;

  if (options.customNotes) {
    md += `> **Notes:** ${options.customNotes}\n\n`;
  }

  // Metadata Table
  if (options.includeMetadata && metadata) {
    md += `## Document Attributes\n\n`;
    md += `| Attribute | Value |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Title** | ${metadata.title || 'Untitled'} |\n`;
    md += `| **Author** | ${metadata.author || 'N/A'} |\n`;
    md += `| **Subject** | ${metadata.subject || 'N/A'} |\n`;
    md += `| **Producer** | ${metadata.producer || 'N/A'} |\n`;
    md += `| **XFA Architecture** | ${metadata.hasXfa ? `${metadata.xfaType?.toUpperCase()} XFA` : 'Standard PDF'} |\n\n`;
  }

  // Fields Table
  md += `## XFA Form Records (${targetFields.length})\n\n`;
  md += `| Field Caption | Type | Value |\n`;
  md += `| :--- | :---: | :--- |\n`;
  targetFields.forEach(f => {
    const val = f.value
      ? f.type === 'check'
        ? f.value === '1' || f.value.toLowerCase() === 'true'
          ? '[x] Yes'
          : '[ ] No'
        : f.value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
      : '*(empty)*';
    const caption = (f.caption || f.name).replace(/\|/g, '\\|');
    md += `| **${caption}** | \`${f.type}\` | ${val} |\n`;
  });
  md += `\n`;

  // Page Text
  if (options.includePageText && textPages.length > 0) {
    md += `## Document Text Content\n\n`;
    textPages.forEach(p => {
      md += `### Page ${p.pageNumber} (${p.wordCount} words)\n\n`;
      md += `${p.text || '*(No text on this page)*'}\n\n`;
    });
  }

  return md;
}

/**
 * Generates formatted JSON data export.
 */
export function generateJson(params: ConversionParams): string {
  const { filename, metadata, fields, textPages, options } = params;
  const targetFields = options.includeEmptyFields
    ? fields
    : fields.filter(f => f.value && f.value.trim().length > 0);

  const data = {
    document: {
      originalFilename: filename,
      convertedAt: new Date().toISOString(),
      metadata: options.includeMetadata ? metadata : undefined,
      notes: options.customNotes || undefined,
    },
    fields: targetFields.map(f => ({
      name: f.name,
      caption: f.caption,
      type: f.type,
      value: f.value,
      parentSubform: f.parentSubform,
      dataRef: f.dataRef,
      page: f.bounds?.pageNumber || 1,
      required: f.required,
      readOnly: f.readOnly,
    })),
    fieldValuesMap: Object.fromEntries(targetFields.map(f => [f.name, f.value])),
    textPages: options.includePageText
      ? textPages.map(p => ({
          pageNumber: p.pageNumber,
          wordCount: p.wordCount,
          lineCount: p.lineCount,
          text: p.text,
        }))
      : undefined,
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Generates formatted plain text (.txt).
 */
export function generatePlainText(params: ConversionParams): string {
  const { filename, metadata, fields, textPages, options } = params;
  const title = options.documentTitle || metadata?.title || filename.replace(/\.pdf$/i, '').replace(/_/g, ' ');
  const targetFields = options.includeEmptyFields
    ? fields
    : fields.filter(f => f.value && f.value.trim().length > 0);

  let out = '';
  out += `======================================================================\n`;
  out += `  ${title.toUpperCase()}\n`;
  out += `  Converted from: ${filename}\n`;
  out += `  Timestamp: ${new Date().toLocaleString()}\n`;
  out += `======================================================================\n\n`;

  if (options.customNotes) {
    out += `NOTES:\n${options.customNotes}\n\n`;
  }

  if (options.includeMetadata && metadata) {
    out += `--- DOCUMENT CATALOG ATTRIBUTES ---\n`;
    out += `Title:       ${metadata.title || 'Untitled'}\n`;
    out += `Author:      ${metadata.author || 'N/A'}\n`;
    out += `Subject:     ${metadata.subject || 'N/A'}\n`;
    out += `Producer:    ${metadata.producer || 'N/A'}\n`;
    out += `Architecture:${metadata.hasXfa ? ` ${metadata.xfaType?.toUpperCase()} XFA` : ' Standard PDF'}\n\n`;
  }

  out += `--- XFA FORM FIELDS & VALUES (${targetFields.length}) ---\n`;
  targetFields.forEach((f, i) => {
    const num = String(i + 1).padStart(2, '0');
    const label = f.caption || f.name;
    const val = f.value || '(empty)';
    out += `[${num}] ${label} [${f.type.toUpperCase()}]:\n     -> ${val}\n`;
  });
  out += `\n`;

  if (options.includePageText && textPages.length > 0) {
    out += `--- DOCUMENT TEXT BY PAGE ---\n`;
    textPages.forEach(p => {
      out += `\n=== PAGE ${p.pageNumber} (${p.wordCount} words) ===\n\n`;
      out += `${p.text || '(no text)'}\n`;
    });
  }

  return out;
}

/**
 * Bundles all offline converted formats into a single complete ZIP archive.
 */
export async function generateAllConvertedBundleZip(params: ConversionParams): Promise<Blob> {
  const zip = new JSZip();
  const baseName = params.filename.replace(/\.pdf$/i, '');

  // 1. Word (.docx)
  const docxBlob = await generateDocx(params);
  zip.file(`${baseName}.docx`, docxBlob);

  // 2. Excel (.xlsx)
  const xlsxBlob = await generateXlsx(params);
  zip.file(`${baseName}.xlsx`, xlsxBlob);

  // 3. Excel-compatible CSV (.csv)
  const csvStr = generateCsv(params);
  zip.file(`${baseName}_fields.csv`, csvStr);

  // 4. HTML5 Standalone Document (.html)
  const htmlStr = generateHtml(params);
  zip.file(`${baseName}.html`, htmlStr);

  // 5. Markdown (.md)
  const mdStr = generateMarkdown(params);
  zip.file(`${baseName}.md`, mdStr);

  // 6. JSON (.json)
  const jsonStr = generateJson(params);
  zip.file(`${baseName}.json`, jsonStr);

  // 7. Plain Text (.txt)
  const txtStr = generatePlainText(params);
  zip.file(`${baseName}.txt`, txtStr);

  // 8. Bundle Manifest & README
  zip.file(
    'CONVERSION_README.txt',
    `AcroXFA Universal Offline Conversion Bundle
===========================================
Source Document: ${params.filename}
Generated: ${new Date().toLocaleString()}
Mode: 100% Client-Side In-Browser Conversion

Included formats:
- ${baseName}.docx    : Microsoft Word document with formatted headers, XFA fields table, and page text.
- ${baseName}.xlsx    : Microsoft Excel workbook with styled table of all form fields, types, and values.
- ${baseName}_fields.csv : UTF-8 CSV with Excel Byte Order Mark (BOM).
- ${baseName}.html    : Standalone responsive and printable HTML5 document.
- ${baseName}.md      : Markdown document with tables and YAML frontmatter.
- ${baseName}.json    : Complete structured JSON schema and key-value mapping.
- ${baseName}.txt     : Clean plain text document.
`
  );

  return await zip.generateAsync({ type: 'blob' });
}
