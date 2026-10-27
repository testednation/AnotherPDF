import { PDFDocument, PDFName, rgb, StandardFonts } from 'pdf-lib';

/**
 * Creates a genuine, valid Dynamic XFA PDF containing realistic enterprise form fields,
 * nested subforms, XML template, and XML datasets.
 */
export async function createSampleXfaPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Add standard fallback page (standard in all Adobe XFA forms)
  const page = pdfDoc.addPage([612, 792]); // Standard US Letter
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('Global Commerce & Trade Registry', {
    x: 50,
    y: 740,
    size: 18,
    font,
    color: rgb(0.08, 0.12, 0.22),
  });

  page.drawText('Dynamic XFA Form - Form 842-XFA (Adobe LiveCycle Architecture)', {
    x: 50,
    y: 720,
    size: 10,
    font: regularFont,
    color: rgb(0.3, 0.4, 0.5),
  });

  page.drawLine({
    start: { x: 50, y: 705 },
    end: { x: 562, y: 705 },
    thickness: 1,
    color: rgb(0.8, 0.85, 0.9),
  });

  // Section 1 Header: Organization Profile
  page.drawText('1. Organization Profile & Entity Verification', {
    x: 50,
    y: 675,
    size: 12,
    font,
    color: rgb(0.12, 0.2, 0.35),
  });

  // Field: companyLegalName
  page.drawText('Company Legal Business Name', { x: 50, y: 645, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawRectangle({ x: 50, y: 615, width: 340, height: 26, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page.drawText('Vanguard Meridian Global Technologies, LLC', { x: 56, y: 624, size: 9, font: regularFont, color: rgb(0.1, 0.15, 0.25) });

  // Field: federalTaxId
  page.drawText('Federal Tax ID / EIN', { x: 50, y: 595, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawRectangle({ x: 50, y: 565, width: 160, height: 26, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page.drawText('47-8921402', { x: 56, y: 574, size: 9, font: regularFont, color: rgb(0.1, 0.15, 0.25) });

  // Field: registrationDate
  page.drawText('Incorporation Date', { x: 225, y: 595, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawRectangle({ x: 225, y: 565, width: 165, height: 26, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page.drawText('2021-06-18', { x: 231, y: 574, size: 9, font: regularFont, color: rgb(0.1, 0.15, 0.25) });

  // Field: businessStructure
  page.drawText('Entity Classification', { x: 50, y: 545, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawRectangle({ x: 50, y: 515, width: 220, height: 26, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page.drawText('Limited Liability Company (LLC)', { x: 56, y: 524, size: 9, font: regularFont, color: rgb(0.1, 0.15, 0.25) });

  // Field: isPubliclyTraded
  page.drawText('Publicly Traded', { x: 285, y: 545, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawRectangle({ x: 285, y: 515, width: 105, height: 26, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page.drawText('[  ] No (Private)', { x: 295, y: 524, size: 9, font: regularFont, color: rgb(0.3, 0.35, 0.45) });

  // Section 2 Header: Contact Information
  page.drawText('2. Executive & Regulatory Contact Information', {
    x: 50,
    y: 465,
    size: 12,
    font,
    color: rgb(0.12, 0.2, 0.35),
  });

  // Field: primaryContactName
  page.drawText('Primary Authorized Contact', { x: 50, y: 450, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawRectangle({ x: 50, y: 420, width: 340, height: 26, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page.drawText('Eleanor Vance', { x: 56, y: 429, size: 9, font: regularFont, color: rgb(0.1, 0.15, 0.25) });

  // Field: primaryEmailAddress
  page.drawText('Official Executive Email', { x: 50, y: 400, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawRectangle({ x: 50, y: 370, width: 200, height: 26, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page.drawText('e.vance@vanguardmeridian.corp', { x: 56, y: 379, size: 8.5, font: regularFont, color: rgb(0.1, 0.15, 0.25) });

  // Field: primaryPhoneNumber
  page.drawText('Telephone Direct', { x: 265, y: 400, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawRectangle({ x: 265, y: 370, width: 125, height: 26, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page.drawText('+1 (415) 890-4420', { x: 271, y: 379, size: 8.5, font: regularFont, color: rgb(0.1, 0.15, 0.25) });

  // Field: physicalHeadquartersAddress
  page.drawText('Headquarters Physical Address', { x: 50, y: 350, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page.drawRectangle({ x: 50, y: 295, width: 340, height: 50, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page.drawText('450 Mission Street, Suite 2200, San Francisco, CA 94105', { x: 56, y: 324, size: 9, font: regularFont, color: rgb(0.1, 0.15, 0.25) });

  // Draw embedded emblem image
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 300;
  sampleCanvas.height = 300;
  const ctx = sampleCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 300, 300);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 280, 280);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OFFICIAL REGISTRY', 150, 130);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('VERIFIED XFA FORM', 150, 165);
    ctx.fillText('SEC / FINRA CERTIFIED', 150, 195);
  }

  const pngDataUrl = sampleCanvas.toDataURL('image/png');
  const pngBytes = Uint8Array.from(atob(pngDataUrl.split(',')[1]), c => c.charCodeAt(0));
  const embeddedPng = await pdfDoc.embedPng(pngBytes);

  page.drawImage(embeddedPng, {
    x: 410,
    y: 350,
    width: 150,
    height: 150,
  });

  // Second page: Financial and Compliance Section
  const page2 = pdfDoc.addPage([612, 792]);
  page2.drawText('3. Financial & Compliance Schedules', {
    x: 50,
    y: 720,
    size: 14,
    font,
    color: rgb(0.1, 0.15, 0.25),
  });

  page2.drawText('Page 2 - Dynamic XFA Datasets Bound Across Pages', {
    x: 50,
    y: 700,
    size: 10,
    font: regularFont,
    color: rgb(0.4, 0.45, 0.55),
  });

  page2.drawLine({
    start: { x: 50, y: 685 },
    end: { x: 562, y: 685 },
    thickness: 1,
    color: rgb(0.8, 0.85, 0.9),
  });

  // Field: annualOperatingRevenue
  page2.drawText('Annual Operating Revenue (USD)', { x: 50, y: 675, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page2.drawRectangle({ x: 50, y: 650, width: 180, height: 26, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page2.drawText('$18,450,000.00', { x: 56, y: 659, size: 9, font: regularFont, color: rgb(0.1, 0.15, 0.25) });

  // Field: complianceJurisdiction
  page2.drawText('Primary Regulatory Jurisdiction', { x: 245, y: 675, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page2.drawRectangle({ x: 245, y: 650, width: 250, height: 26, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page2.drawText('North America (SEC / FINRA)', { x: 251, y: 659, size: 9, font: regularFont, color: rgb(0.1, 0.15, 0.25) });

  // Field: auditDeclarationNotes
  page2.drawText('Compliance Disclosures & Exceptions', { x: 50, y: 630, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page2.drawRectangle({ x: 50, y: 550, width: 445, height: 75, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page2.drawText('Full external audit completed by Deloitte & Touche LLP on January 15, 2026.\nNo material deficiencies or internal control weaknesses noted in financial reporting.', {
    x: 56,
    y: 595,
    size: 8.5,
    font: regularFont,
    color: rgb(0.1, 0.15, 0.25),
    lineHeight: 13,
  });

  // Field: authorizedOfficerSignature
  page2.drawText('Authorized Officer Digital Signature', { x: 50, y: 515, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page2.drawRectangle({ x: 50, y: 470, width: 280, height: 40, borderColor: rgb(0.85, 0.6, 0.65), borderWidth: 1.5, color: rgb(1, 0.98, 0.98) });
  page2.drawText('Eleanor Vance [Verified Electronic Signature]', { x: 56, y: 485, size: 9.5, font, color: rgb(0.5, 0.1, 0.2) });

  // Field: signatureTimestamp
  page2.drawText('Execution Date', { x: 345, y: 515, size: 8.5, font, color: rgb(0.3, 0.35, 0.45) });
  page2.drawRectangle({ x: 345, y: 470, width: 150, height: 40, borderColor: rgb(0.7, 0.78, 0.88), borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  page2.drawText('2026-03-24', { x: 351, y: 485, size: 9, font: regularFont, color: rgb(0.1, 0.15, 0.25) });

  // 2. Build the genuine XFA Template XML
  const templateXml = `<?xml version="1.0" encoding="UTF-8"?>
<template xmlns="http://www.xfa.org/schema/xfa-template/3.3/">
  <subform name="form1" layout="tb" locale="en_US">
    <pageSet>
      <pageArea name="Page1" id="Page1">
        <contentArea x="0.5in" y="0.5in" w="7.5in" h="10in"/>
      </pageArea>
    </pageSet>
    
    <subform name="OrganizationProfile" layout="tb">
      <field name="companyLegalName" y="10mm" x="10mm" w="120mm" h="9mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Company Legal Business Name</text></value>
        </caption>
        <ui><textEdit/></ui>
        <validate nullTest="error"/>
        <bind match="dataRef" ref="companyLegalName"/>
      </field>

      <field name="federalTaxId" y="22mm" x="10mm" w="60mm" h="9mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Federal Tax ID / EIN</text></value>
        </caption>
        <ui><textEdit/></ui>
        <bind match="dataRef" ref="federalTaxId"/>
      </field>

      <field name="registrationDate" y="22mm" x="75mm" w="55mm" h="9mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Original Incorporation Date</text></value>
        </caption>
        <ui><dateTimeEdit/></ui>
        <bind match="dataRef" ref="registrationDate"/>
      </field>

      <field name="businessStructure" y="34mm" x="10mm" w="80mm" h="9mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Entity Classification</text></value>
        </caption>
        <ui>
          <choiceList open="userControl">
            <items>
              <text>Corporation (C-Corp)</text>
              <text>S-Corporation</text>
              <text>Limited Liability Company (LLC)</text>
              <text>General Partnership</text>
              <text>Non-Profit Foundation</text>
            </items>
          </choiceList>
        </ui>
        <bind match="dataRef" ref="businessStructure"/>
      </field>

      <field name="isPubliclyTraded" y="34mm" x="95mm" w="35mm" h="9mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Publicly Traded Entity</text></value>
        </caption>
        <ui><checkButton shape="round"/></ui>
        <bind match="dataRef" ref="isPubliclyTraded"/>
      </field>
    </subform>

    <subform name="ContactInformation" layout="tb">
      <field name="primaryContactName" y="10mm" x="10mm" w="100mm" h="9mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Primary Authorized Contact</text></value>
        </caption>
        <ui><textEdit/></ui>
        <bind match="dataRef" ref="primaryContactName"/>
      </field>

      <field name="primaryEmailAddress" y="22mm" x="10mm" w="75mm" h="9mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Official Executive Email</text></value>
        </caption>
        <ui><textEdit/></ui>
        <bind match="dataRef" ref="primaryEmailAddress"/>
      </field>

      <field name="primaryPhoneNumber" y="22mm" x="90mm" w="45mm" h="9mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Telephone Direct</text></value>
        </caption>
        <ui><textEdit/></ui>
        <bind match="dataRef" ref="primaryPhoneNumber"/>
      </field>

      <field name="physicalHeadquartersAddress" y="34mm" x="10mm" w="125mm" h="18mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Headquarters Physical Address</text></value>
        </caption>
        <ui><textEdit multiLine="1"/></ui>
        <bind match="dataRef" ref="physicalHeadquartersAddress"/>
      </field>
    </subform>

    <subform name="FinancialAndCompliance" layout="tb">
      <field name="annualOperatingRevenue" y="10mm" x="10mm" w="60mm" h="9mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Annual Operating Revenue (USD)</text></value>
        </caption>
        <ui><numericEdit/></ui>
        <bind match="dataRef" ref="annualOperatingRevenue"/>
      </field>

      <field name="complianceJurisdiction" y="10mm" x="75mm" w="55mm" h="9mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Primary Regulatory Jurisdiction</text></value>
        </caption>
        <ui>
          <choiceList>
            <items>
              <text>North America (SEC / FINRA)</text>
              <text>European Union (ESMA)</text>
              <text>United Kingdom (FCA)</text>
              <text>Asia-Pacific (MAS / HKMA)</text>
            </items>
          </choiceList>
        </ui>
        <bind match="dataRef" ref="complianceJurisdiction"/>
      </field>

      <field name="auditDeclarationNotes" y="22mm" x="10mm" w="125mm" h="20mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Compliance Disclosures &amp; Exceptions</text></value>
        </caption>
        <ui><textEdit multiLine="1"/></ui>
        <bind match="dataRef" ref="auditDeclarationNotes"/>
      </field>

      <field name="authorizedOfficerSignature" y="44mm" x="10mm" w="80mm" h="12mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Authorized Officer Digital Signature</text></value>
        </caption>
        <ui><signature/></ui>
        <bind match="dataRef" ref="authorizedOfficerSignature"/>
      </field>

      <field name="signatureTimestamp" y="44mm" x="95mm" w="35mm" h="9mm">
        <caption font="Helvetica" size="9pt">
          <value><text>Execution Date</text></value>
        </caption>
        <ui><dateTimeEdit/></ui>
        <bind match="dataRef" ref="signatureTimestamp"/>
      </field>
    </subform>
  </subform>
</template>`;

  // 3. Build genuine XFA Datasets XML
  const datasetsXml = `<?xml version="1.0" encoding="UTF-8"?>
<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/">
  <xfa:data>
    <form1>
      <OrganizationProfile>
        <companyLegalName>Vanguard Meridian Global Technologies, LLC</companyLegalName>
        <federalTaxId>47-8921402</federalTaxId>
        <registrationDate>2021-06-18</registrationDate>
        <businessStructure>Limited Liability Company (LLC)</businessStructure>
        <isPubliclyTraded>0</isPubliclyTraded>
      </OrganizationProfile>
      <ContactInformation>
        <primaryContactName>Eleanor Vance</primaryContactName>
        <primaryEmailAddress>e.vance@vanguardmeridian.corp</primaryEmailAddress>
        <primaryPhoneNumber>+1 (415) 890-4420</primaryPhoneNumber>
        <physicalHeadquartersAddress>450 Mission Street, Suite 2200, San Francisco, CA 94105</physicalHeadquartersAddress>
      </ContactInformation>
      <FinancialAndCompliance>
        <annualOperatingRevenue>18450000</annualOperatingRevenue>
        <complianceJurisdiction>North America (SEC / FINRA)</complianceJurisdiction>
        <auditDeclarationNotes>Full external audit completed by Deloitte &amp; Touche LLP on January 15, 2026. No material deficiencies or internal control weaknesses noted in financial reporting.</auditDeclarationNotes>
        <authorizedOfficerSignature>Eleanor Vance [Verified Electronic Signature]</authorizedOfficerSignature>
        <signatureTimestamp>2026-03-24</signatureTimestamp>
      </FinancialAndCompliance>
    </form1>
  </xfa:data>
</xfa:datasets>`;

  const configXml = `<?xml version="1.0" encoding="UTF-8"?>
<config xmlns="http://www.xfa.org/schema/xci/3.0/">
  <present>
    <pdf>
      <interactive>1</interactive>
      <version>1.7</version>
    </pdf>
  </present>
</config>`;

  const localeSetXml = `<?xml version="1.0" encoding="UTF-8"?>
<localeSet xmlns="http://www.xfa.org/schema/xfa-locale-set/2.7/">
  <locale name="en_US" desc="English (United States)">
    <calendarSymbols name="gregorian">
      <monthNames>
        <month>January</month><month>February</month><month>March</month><month>April</month>
        <month>May</month><month>June</month><month>July</month><month>August</month>
        <month>September</month><month>October</month><month>November</month><month>December</month>
      </monthNames>
    </calendarSymbols>
  </locale>
</localeSet>`;

  // 4. Assemble in PDF Catalog /AcroForm /XFA
  const catalog = pdfDoc.catalog;
  const context = pdfDoc.context;
  const encoder = new TextEncoder();

  const templateStreamRef = context.register(context.stream(encoder.encode(templateXml)));
  const datasetsStreamRef = context.register(context.stream(encoder.encode(datasetsXml)));
  const configStreamRef = context.register(context.stream(encoder.encode(configXml)));
  const localeSetStreamRef = context.register(context.stream(encoder.encode(localeSetXml)));

  const xfaArray = context.obj([
    PDFName.of('config'), configStreamRef,
    PDFName.of('template'), templateStreamRef,
    PDFName.of('datasets'), datasetsStreamRef,
    PDFName.of('localeSet'), localeSetStreamRef,
  ]);

  const acroFormDict = context.obj({
    Fields: context.obj([]),
    XFA: xfaArray,
    NeedAppearances: true,
  });

  catalog.set(PDFName.of('AcroForm'), acroFormDict);

  // Set document title and metadata
  pdfDoc.setTitle('Global Commerce Enterprise Registry - Form 842-XFA');
  pdfDoc.setAuthor('International Commerce Regulatory Authority');
  pdfDoc.setSubject('Dynamic XFA Filing Specification & Compliance Record');
  pdfDoc.setCreator('Adobe LiveCycle Designer 11.0 / AcroXFA Enterprise');
  pdfDoc.setProducer('AcroXFA Dynamic PDF Engine');

  return await pdfDoc.save();
}

/**
 * Creates a sample PDF with embedded attachments and multiple images
 * for testing resource extraction
 */
export async function createSampleMediaPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([612, 792]);
  page.drawText('Technical Asset & Specification Brief', {
    x: 50,
    y: 720,
    size: 20,
    font,
    color: rgb(0.1, 0.15, 0.25),
  });

  page.drawText('Demonstration Document with Embedded Resources for Extractor Testing', {
    x: 50,
    y: 695,
    size: 11,
    font: regularFont,
    color: rgb(0.35, 0.45, 0.55),
  });

  // Create Image 1 (Infographic banner)
  const c1 = document.createElement('canvas');
  c1.width = 600;
  c1.height = 200;
  const ctx1 = c1.getContext('2d');
  if (ctx1) {
    const g = ctx1.createLinearGradient(0, 0, 600, 200);
    g.addColorStop(0, '#0284c7');
    g.addColorStop(1, '#0f172a');
    ctx1.fillStyle = g;
    ctx1.fillRect(0, 0, 600, 200);
    ctx1.fillStyle = '#ffffff';
    ctx1.font = 'bold 24px sans-serif';
    ctx1.fillText('Infographic Asset: Data Distribution', 40, 70);
    ctx1.fillStyle = '#38bdf8';
    ctx1.fillRect(40, 95, 200, 16);
    ctx1.fillStyle = '#f43f5e';
    ctx1.fillRect(250, 95, 140, 16);
    ctx1.fillStyle = '#10b981';
    ctx1.fillRect(400, 95, 120, 16);
  }
  const img1Bytes = Uint8Array.from(atob(c1.toDataURL('image/png').split(',')[1]), c => c.charCodeAt(0));
  const embeddedImg1 = await pdfDoc.embedPng(img1Bytes);

  page.drawImage(embeddedImg1, {
    x: 50,
    y: 470,
    width: 300,
    height: 100,
  });

  // Create Image 2 (Square badge)
  const c2 = document.createElement('canvas');
  c2.width = 240;
  c2.height = 240;
  const ctx2 = c2.getContext('2d');
  if (ctx2) {
    ctx2.fillStyle = '#1e1b4b';
    ctx2.fillRect(0, 0, 240, 240);
    ctx2.strokeStyle = '#6366f1';
    ctx2.lineWidth = 8;
    ctx2.strokeRect(10, 10, 220, 220);
    ctx2.fillStyle = '#818cf8';
    ctx2.font = 'bold 22px sans-serif';
    ctx2.textAlign = 'center';
    ctx2.fillText('CERTIFIED', 120, 115);
    ctx2.fillStyle = '#e0e7ff';
    ctx2.font = '14px sans-serif';
    ctx2.fillText('XFA & PDF 2.0', 120, 145);
  }
  const img2Bytes = Uint8Array.from(atob(c2.toDataURL('image/png').split(',')[1]), c => c.charCodeAt(0));
  const embeddedImg2 = await pdfDoc.embedPng(img2Bytes);

  page.drawImage(embeddedImg2, {
    x: 380,
    y: 470,
    width: 100,
    height: 100,
  });

  page.drawText(
    'This test document contains 2 embedded raster PNG images, multiple font descriptors,\nplain-text paragraphs across pages, and metadata for full resource extraction auditing.',
    {
      x: 50,
      y: 410,
      size: 10,
      font: regularFont,
      color: rgb(0.2, 0.25, 0.35),
      lineHeight: 15,
    }
  );

  pdfDoc.setTitle('Technical Asset & Specification Brief');
  pdfDoc.setAuthor('Engineering Systems Architecture');
  pdfDoc.setProducer('AcroXFA Resource Compiler');

  return await pdfDoc.save();
}
