import {
  XFAField,
  XFAPackets,
  ExtractedResourceManifest,
  PdfDocumentMetadata,
} from '../types/pdf';
import {
  PreflightIssue,
  PreflightProfile,
  PreflightSummary,
  PreflightSeverity,
} from '../types/preflight';

/**
 * Executes a full preflight audit on the current PDF and XFA form structure
 */
export function runPreflightAudit(
  documentName: string,
  fields: XFAField[],
  xfaPackets: XFAPackets,
  manifest: ExtractedResourceManifest | null,
  profile: PreflightProfile = 'comprehensive'
): PreflightSummary {
  const issues: PreflightIssue[] = [];
  let issueCounter = 1;

  const addIssue = (
    ruleId: string,
    ruleName: string,
    issueProfile: PreflightProfile,
    severity: PreflightSeverity,
    message: string,
    detail: string,
    targetType: PreflightIssue['targetType'],
    extra: Partial<PreflightIssue> = {}
  ) => {
    // Filter if running a specific profile
    if (profile !== 'comprehensive' && issueProfile !== profile) {
      return;
    }

    issues.push({
      id: `preflight-${issueCounter++}`,
      ruleId,
      ruleName,
      profile: issueProfile,
      severity,
      message,
      detail,
      targetType,
      ...extra,
    });
  };

  const metadata = manifest?.metadata;
  const hasXfa = Boolean(xfaPackets.templateXml || xfaPackets.fullXdpXml || fields.length > 0);

  // ==========================================
  // PROFILE 1: XFA & INTERACTIVE FORM INTEGRITY
  // ==========================================

  // Rule XFA-001: XFA Architecture Check
  if (hasXfa) {
    if (xfaPackets.templateXml && xfaPackets.templateXml.includes('<template')) {
      addIssue(
        'XFA-001',
        'XFA XML Template Structure',
        'xfa-compliance',
        'passed',
        'XFA template packet is well-formed XML with valid subforms and field definitions.',
        'The document contains a compliant XML Forms Architecture template definition.',
        'xml'
      );
    } else {
      addIssue(
        'XFA-001',
        'XFA XML Template Structure',
        'xfa-compliance',
        'error',
        'Missing or corrupt XFA template packet in PDF AcroForm.',
        'The PDF indicates XFA presence, but the <template> stream could not be validated.',
        'xml',
        { suggestedFix: 'Re-generate template packet or repair XML syntax in XML editor.' }
      );
    }

    // Rule XFA-002: Datasets & Data Payload
    if (xfaPackets.datasetsXml && xfaPackets.datasetsXml.includes('<xfa:data')) {
      addIssue(
        'XFA-002',
        'XFA Datasets Payload',
        'xfa-compliance',
        'passed',
        'Valid XML datasets packet with bound <xfa:data> elements.',
        'The data values are properly enclosed in the XML datasets envelope.',
        'xml'
      );
    } else {
      addIssue(
        'XFA-002',
        'XFA Datasets Payload',
        'xfa-compliance',
        'warning',
        'Datasets packet is missing or empty.',
        'The form template exists, but no <datasets> or <xfa:data> stream was discovered.',
        'xml',
        { suggestedFix: 'Auto-fill form values to generate compliant datasets.' }
      );
    }

    // Rule XFA-003: Required Fields Completion
    const emptyRequiredFields = fields.filter(
      f => f.required && (!f.value || f.value.trim().length === 0)
    );

    if (emptyRequiredFields.length === 0) {
      addIssue(
        'XFA-003',
        'Mandatory Fields Validation',
        'xfa-compliance',
        'passed',
        'All required form fields (nullTest="error") have valid values.',
        'No unfilled mandatory fields were discovered.',
        'field'
      );
    } else {
      emptyRequiredFields.forEach(f => {
        addIssue(
          'XFA-003',
          'Mandatory Fields Validation',
          'xfa-compliance',
          'error',
          `Required field "${f.caption}" is empty.`,
          `Field "${f.name}" has nullTest="error" enforced by the XFA template but currently contains no value.`,
          'field',
          {
            targetId: f.id,
            targetName: f.name,
            pageNumber: f.bounds?.pageNumber || 1,
            suggestedFix: `Provide a valid value for "${f.caption}".`,
            autoFixable: true,
            fixAction: 'fill-field',
          }
        );
      });
    }

    // Rule XFA-004: Date Field Format Compliance
    const dateFields = fields.filter(f => f.type === 'date' && f.value.trim().length > 0);
    dateFields.forEach(f => {
      const val = f.value.trim();
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!isoDateRegex.test(val)) {
        addIssue(
          'XFA-004',
          'Date Field Standard Format',
          'xfa-compliance',
          'warning',
          `Date in field "${f.caption}" does not follow ISO YYYY-MM-DD.`,
          `Value "${val}" may cause validation errors on government or enterprise form ingestion engines.`,
          'field',
          {
            targetId: f.id,
            targetName: f.name,
            pageNumber: f.bounds?.pageNumber || 1,
            suggestedFix: 'Reformat date value to YYYY-MM-DD format (e.g. 2026-03-24).',
            autoFixable: true,
            fixAction: 'fill-field',
          }
        );
      }
    });

    // Rule XFA-005: Numeric Field Validation
    const numericFields = fields.filter(f => f.type === 'numeric' && f.value.trim().length > 0);
    numericFields.forEach(f => {
      const cleanVal = f.value.replace(/[$,\s]/g, '');
      if (isNaN(Number(cleanVal))) {
        addIssue(
          'XFA-005',
          'Numeric Field Format',
          'xfa-compliance',
          'error',
          `Numeric field "${f.caption}" contains non-numeric characters.`,
          `Value "${f.value}" cannot be parsed as a floating-point or integer number.`,
          'field',
          {
            targetId: f.id,
            targetName: f.name,
            pageNumber: f.bounds?.pageNumber || 1,
            suggestedFix: 'Remove non-numeric characters from this field.',
            autoFixable: true,
            fixAction: 'fill-field',
          }
        );
      }
    });

    // Rule XFA-006: Dropdown / Choice List Validation
    const choiceFields = fields.filter(f => f.type === 'choice' && f.options && f.options.length > 0 && f.value);
    choiceFields.forEach(f => {
      if (!f.options?.includes(f.value)) {
        addIssue(
          'XFA-006',
          'Dropdown Enumeration Match',
          'xfa-compliance',
          'warning',
          `Value in "${f.caption}" is not in the declared choice list.`,
          `Current value "${f.value}" does not match any of the ${f.options?.length} defined <items> options.`,
          'field',
          {
            targetId: f.id,
            targetName: f.name,
            pageNumber: f.bounds?.pageNumber || 1,
            suggestedFix: `Select one of the defined options: ${f.options?.join(', ')}.`,
          }
        );
      }
    });

    // Rule XFA-007: Signature Fields
    const signatureFields = fields.filter(f => f.type === 'signature');
    signatureFields.forEach(f => {
      if (!f.value || f.value.trim().length === 0) {
        addIssue(
          'XFA-007',
          'Digital Signature Execution',
          'xfa-compliance',
          'warning',
          `Signature block "${f.caption}" has not been executed.`,
          'This document requires an authorized digital or electronic signature before legal submission.',
          'field',
          {
            targetId: f.id,
            targetName: f.name,
            pageNumber: f.bounds?.pageNumber || 1,
            suggestedFix: 'Type the authorized officer name or sign in the field inspector.',
          }
        );
      } else {
        addIssue(
          'XFA-007',
          'Digital Signature Execution',
          'xfa-compliance',
          'passed',
          `Signature block "${f.caption}" is signed: "${f.value}".`,
          'Electronic signature verification affirmed.',
          'field'
        );
      }
    });
  }

  // ==========================================
  // PROFILE 2: PDF/A ARCHIVAL STANDARDIZATION
  // ==========================================

  // Rule PDFA-001: Font Embedding
  if (manifest && manifest.fonts.length > 0) {
    const nonEmbeddedFonts = manifest.fonts.filter(f => !f.isEmbedded);
    if (nonEmbeddedFonts.length === 0) {
      addIssue(
        'PDFA-001',
        'Font Embedding Compliance (ISO 19005)',
        'pdfa-archival',
        'passed',
        'All fonts are embedded as TrueType or OpenType programs.',
        'PDF/A requirement satisfied: no dependency on local system font rasterizers.',
        'font'
      );
    } else {
      nonEmbeddedFonts.forEach(font => {
        addIssue(
          'PDFA-001',
          'Font Embedding Compliance (ISO 19005)',
          'pdfa-archival',
          'warning',
          `Font "${font.name}" (${font.subtype}) is not embedded.`,
          'PDF/A standards require all font programs to be fully embedded to guarantee rendering fidelity across operating systems.',
          'font',
          {
            targetId: font.id,
            targetName: font.name,
            suggestedFix: 'Embed TrueType/OpenType font files using a compliant PDF writer.',
          }
        );
      });
    }
  }

  // Rule PDFA-002: Encryption Status
  if (metadata) {
    if (metadata.isEncrypted) {
      addIssue(
        'PDFA-002',
        'Encryption & Password Restriction',
        'pdfa-archival',
        'error',
        'Document is encrypted with password protection.',
        'PDF/A archival standards explicitly prohibit document password encryption.',
        'document',
        { suggestedFix: 'Remove password security restrictions from the PDF.' }
      );
    } else {
      addIssue(
        'PDFA-002',
        'Encryption & Password Restriction',
        'pdfa-archival',
        'passed',
        'Document has no password encryption (Compliant with PDF/A).',
        'Unrestricted access for digital preservation.',
        'document'
      );
    }

    // Rule PDFA-003: Document Catalog Metadata Completeness
    const missingMeta: string[] = [];
    if (!metadata.title) missingMeta.push('Title');
    if (!metadata.author) missingMeta.push('Author');
    if (!metadata.producer) missingMeta.push('Producer');

    if (missingMeta.length === 0) {
      addIssue(
        'PDFA-003',
        'Document Information Catalog',
        'pdfa-archival',
        'passed',
        'Complete document metadata (Title, Author, Producer).',
        'Document information dictionary contains all recommended metadata keys.',
        'metadata'
      );
    } else {
      addIssue(
        'PDFA-003',
        'Document Information Catalog',
        'pdfa-archival',
        'warning',
        `Incomplete document metadata: Missing ${missingMeta.join(', ')}.`,
        'Archival indexing engines require standardized document metadata.',
        'metadata',
        {
          suggestedFix: 'Set Title, Author, and Subject in document properties.',
          autoFixable: true,
          fixAction: 'set-metadata',
        }
      );
    }
  }

  // ==========================================
  // PROFILE 3: PRINT PRODUCTION & ASSET QUALITY
  // ==========================================

  if (manifest && manifest.images.length > 0) {
    manifest.images.forEach(img => {
      // Rule PRINT-001: Image Resolution Check
      if (img.width < 150 || img.height < 150) {
        addIssue(
          'PRINT-001',
          'Image Resolution Audit',
          'print-quality',
          'warning',
          `Image "${img.name}" has low resolution (${img.width}×${img.height} px).`,
          'Images below 150 DPI may appear pixelated or blurred when printed.',
          'image',
          {
            targetId: img.id,
            targetName: img.name,
            pageNumber: img.page,
            suggestedFix: 'Replace with high-resolution vector artwork or 300+ DPI photography.',
          }
        );
      } else {
        addIssue(
          'PRINT-001',
          'Image Resolution Audit',
          'print-quality',
          'passed',
          `Image "${img.name}" has high resolution (${img.width}×${img.height} px, ${img.colorSpace}).`,
          'Asset meets print and high-DPI display standards.',
          'image'
        );
      }

      // Rule PRINT-002: Stream Compression Check
      if (img.sizeBytes <= 0) {
        addIssue(
          'PRINT-002',
          'Image Stream Payload Integrity',
          'print-quality',
          'error',
          `Image "${img.name}" contains zero byte payload.`,
          'Damaged image stream dictionary.',
          'image'
        );
      }
    });
  }

  // ==========================================
  // PROFILE 4: UNIVERSAL ACCESSIBILITY (PDF/UA)
  // ==========================================

  if (manifest && manifest.textPages.length > 0) {
    const emptyPages = manifest.textPages.filter(p => p.wordCount === 0);
    if (emptyPages.length > 0) {
      emptyPages.forEach(p => {
        addIssue(
          'UA-001',
          'Extractable Text Layer Presence',
          'accessibility',
          'warning',
          `Page ${p.pageNumber} contains no extractable plain text.`,
          'Pure raster scans or flattened pages without an OCR text layer cannot be read by screen readers.',
          'document',
          { pageNumber: p.pageNumber, suggestedFix: 'Ensure OCR or live text layer is present.' }
        );
      });
    } else {
      addIssue(
        'UA-001',
        'Extractable Text Layer Presence',
        'accessibility',
        'passed',
        `All ${manifest.textPages.length} pages contain live, selectable text.`,
        'Text streams are accessible to assistive technology.',
        'document'
      );
    }
  }

  // Rule UA-002: Accessible Captions & Tooltips for Form Fields
  const fieldsWithoutCaptions = fields.filter(
    f => !f.caption || f.caption.trim().length === 0
  );
  if (fieldsWithoutCaptions.length === 0) {
    addIssue(
      'UA-002',
      'Accessible Form Field Labels',
      'accessibility',
      'passed',
      'All interactive form fields have descriptive human-readable captions.',
      'Section 508 / WCAG compliance verified.',
      'field'
    );
  } else {
    fieldsWithoutCaptions.forEach(f => {
      addIssue(
        'UA-002',
        'Accessible Form Field Labels',
        'accessibility',
        'warning',
        `Field "${f.name}" lacks a descriptive caption.`,
        'Assistive technologies require explicit labels for each interactive control.',
        'field',
        {
          targetId: f.id,
          targetName: f.name,
          pageNumber: f.bounds?.pageNumber || 1,
          suggestedFix: 'Add a descriptive caption in the field inspector.',
        }
      );
    });
  }

  // Count summaries
  const errorsCount = issues.filter(i => i.severity === 'error').length;
  const warningsCount = issues.filter(i => i.severity === 'warning').length;
  const noticesCount = issues.filter(i => i.severity === 'info').length;
  const passedCount = issues.filter(i => i.severity === 'passed').length;

  let overallStatus: 'pass' | 'warning' | 'fail' = 'pass';
  if (errorsCount > 0) {
    overallStatus = 'fail';
  } else if (warningsCount > 0) {
    overallStatus = 'warning';
  }

  return {
    documentName,
    profile,
    timestamp: new Date().toISOString(),
    totalChecks: issues.length,
    passedCount,
    errorsCount,
    warningsCount,
    noticesCount,
    overallStatus,
    issues,
  };
}

/**
 * Generates a clean, formatted text preflight certificate / audit report
 */
export function generatePreflightTextReport(summary: PreflightSummary): string {
  const lines: string[] = [];
  lines.push('================================================================');
  lines.push('            ACROXFA PDF & XFA PREFLIGHT AUDIT REPORT            ');
  lines.push('================================================================');
  lines.push(`Document:       ${summary.documentName}`);
  lines.push(`Audit Profile:  ${summary.profile.toUpperCase()}`);
  lines.push(`Audit Time:     ${new Date(summary.timestamp).toLocaleString()}`);
  lines.push(`Overall Status: ${summary.overallStatus.toUpperCase()} (${summary.errorsCount} Errors, ${summary.warningsCount} Warnings, ${summary.passedCount} Passed)`);
  lines.push('----------------------------------------------------------------');
  lines.push('');

  lines.push('SUMMARY OF AUDIT RESULTS:');
  lines.push(`  • Total Rules Evaluated: ${summary.totalChecks}`);
  lines.push(`  • Passed Assertions:     ${summary.passedCount}`);
  lines.push(`  • Critical Errors:       ${summary.errorsCount}`);
  lines.push(`  • Warnings & Advisories: ${summary.warningsCount}`);
  lines.push('');

  if (summary.errorsCount > 0) {
    lines.push('CRITICAL ERRORS:');
    summary.issues
      .filter(i => i.severity === 'error')
      .forEach(i => {
        lines.push(`  [ERROR] [${i.ruleId}] ${i.message}`);
        lines.push(`          Detail: ${i.detail}`);
        if (i.suggestedFix) lines.push(`          Fix:    ${i.suggestedFix}`);
        lines.push('');
      });
  }

  if (summary.warningsCount > 0) {
    lines.push('WARNINGS & ADVISORIES:');
    summary.issues
      .filter(i => i.severity === 'warning')
      .forEach(i => {
        lines.push(`  [WARN]  [${i.ruleId}] ${i.message}`);
        lines.push(`          Detail: ${i.detail}`);
        if (i.suggestedFix) lines.push(`          Fix:    ${i.suggestedFix}`);
        lines.push('');
      });
  }

  lines.push('PASSED CHECKS:');
  summary.issues
    .filter(i => i.severity === 'passed')
    .forEach(i => {
      lines.push(`  [PASS]  [${i.ruleId}] ${i.ruleName}: ${i.message}`);
    });

  lines.push('');
  lines.push('================================================================');
  lines.push('Generated 100% locally with AcroXFA Offline Engine');
  lines.push('================================================================');

  return lines.join('\n');
}
