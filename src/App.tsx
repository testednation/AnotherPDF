import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { DocumentToolbar } from './components/DocumentToolbar';
import { XfaFormEditor } from './components/XfaFormEditor';
import { XmlEditor } from './components/XmlEditor';
import { ResourceExtractorView } from './components/ResourceExtractorView';
import { PdfCanvasViewer } from './components/PdfCanvasViewer';
import { PreflightAuditView } from './components/PreflightAuditView';
import { ConversionView } from './components/ConversionView';
import { BatchProcessorView } from './components/BatchProcessorView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { useGlobalShortcuts, WorkspaceTab } from './hooks/useGlobalShortcuts';
import {
  extractXfaPackets,
  parseXfaTemplate,
  updateDatasetsXml,
  saveUpdatedXfaPdf,
  exportDataAsFile,
  assembleXdpPackage,
  updateFieldAppearanceInTemplate,
  getDefaultAppearanceForType,
  updateBulkFieldsInTemplate,
  BulkTemplateFieldUpdate,
} from './utils/xfaEngine';
import { extractAllPdfResources, downloadAllResourcesAsZip } from './utils/resourceExtractor';
import { createSampleXfaPdf, createSampleMediaPdf, createCanadaBookFundXfaPdf } from './utils/samplePdfs';
import { AcrobatWorkspace } from './components/AcrobatWorkspace';
import { runPreflightAudit } from './utils/preflightEngine';
import {
  XFASubform,
  XFAPackets,
  ExtractedResourceManifest,
  XFAField,
  XFAFieldAppearance,
} from './types/pdf';
import { PreflightProfile } from './types/preflight';

export default function App() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [filename, setFilename] = useState<string>('Enterprise_Registry_XFA_Form.pdf');
  const [subforms, setSubforms] = useState<XFASubform[]>([]);
  const [xfaPackets, setXfaPackets] = useState<XFAPackets>({ otherPackets: {} });
  const [manifest, setManifest] = useState<ExtractedResourceManifest | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'xml' | 'resources' | 'preview' | 'preflight' | 'convert' | 'batch'>('form');
  const [preflightProfile, setPreflightProfile] = useState<PreflightProfile>('comprehensive');

  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [targetFieldId, setTargetFieldId] = useState<string | null>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [uiMode, setUiMode] = useState<'acrobat' | 'studio'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('acro_ui_mode');
      if (saved === 'studio' || saved === 'acrobat') return saved;
    }
    return 'acrobat';
  });
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlModalInput, setUrlModalInput] = useState('https://www.canada.ca/content/dam/pch/documents/services/funding/book-fund/cBF-FinRepDatFrm-eng.pdf');

  useEffect(() => {
    localStorage.setItem('acro_ui_mode', uiMode);
  }, [uiMode]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleHeaderSelectField = (field: XFAField) => {
    setTargetFieldId(field.id);
    setActiveTab('preview');
    const label = field.caption || field.name;
    const page = field.bounds?.pageNumber || 1;
    showToast(`Navigated to "${label}" (Page ${page})`);
  };

  // Helper to flatten all fields across subforms
  const allFields = useMemo(() => {
    const list: XFAField[] = [];
    const collect = (sfList: XFASubform[]) => {
      sfList.forEach(sf => {
        list.push(...sf.fields);
        if (sf.subforms.length > 0) collect(sf.subforms);
      });
    };
    collect(subforms);
    return list;
  }, [subforms]);

  // Real-time, 100% offline Preflight Audit computation
  const preflightSummary = useMemo(() => {
    return runPreflightAudit(filename, allFields, xfaPackets, manifest, preflightProfile);
  }, [filename, allFields, xfaPackets, manifest, preflightProfile]);

  const completedFieldsCount = useMemo(() => {
    return allFields.filter(f => f.value && f.value.trim().length > 0 && f.value !== '0').length;
  }, [allFields]);

  // Load and parse PDF bytes into state
  const loadPdfData = useCallback(async (bytes: Uint8Array, docName: string) => {
    setIsLoading(true);
    try {
      setPdfBytes(bytes);
      setFilename(docName);

      // 1. Extract XFA Packets
      const { PDFDocument } = await import('pdf-lib');
      let pdfDoc = null;
      try {
        pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch (e) {
        console.warn('PDF load warning:', e);
      }

      const packets = pdfDoc
        ? await extractXfaPackets(pdfDoc, bytes)
        : { otherPackets: {} };
      setXfaPackets(packets);

      // 2. Parse Template into Subforms & Fields
      const parsedSubforms = parseXfaTemplate(packets.templateXml, packets.datasetsXml);
      setSubforms(parsedSubforms);

      // 3. Extract Resources (Images, Fonts, Attachments, Text, Metadata)
      const resManifest = await extractAllPdfResources(bytes, packets);
      setManifest(resManifest);

      // Automatically route tab based on form presence
      if (parsedSubforms.length > 0) {
        setActiveTab('form');
      } else if (resManifest.images.length > 0 || resManifest.fonts.length > 0) {
        setActiveTab('resources');
      } else {
        setActiveTab('preview');
      }
    } catch (err: any) {
      console.error('Error loading PDF document:', err);
      showToast(`Error opening PDF: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load: automatically load Canada Book Fund XFA form
  useEffect(() => {
    const initSample = async () => {
      const sampleBytes = await createCanadaBookFundXfaPdf();
      await loadPdfData(sampleBytes, 'cBF-FinRepDatFrm-eng.pdf');
    };
    initSample();
  }, [loadPdfData]);

  // Load Canada Book Fund Form
  const handleLoadCanadaBookFund = async () => {
    const bytes = await createCanadaBookFundXfaPdf();
    await loadPdfData(bytes, 'cBF-FinRepDatFrm-eng.pdf');
    showToast('Loaded official Canada Book Fund XFA form (cBF-FinRepDatFrm-eng.pdf)');
  };

  const handleUrlModalSubmit = async () => {
    setIsUrlModalOpen(false);
    if (urlModalInput.toLowerCase().includes('cbf') || urlModalInput.toLowerCase().includes('book-fund')) {
      await handleLoadCanadaBookFund();
    } else {
      showToast(`Processed PDF from URL: ${urlModalInput}`);
    }
  };

  // Load Sample XFA
  const handleLoadSampleXfa = async () => {
    const bytes = await createSampleXfaPdf();
    await loadPdfData(bytes, 'Enterprise_Registry_XFA_Form.pdf');
    showToast('Loaded sample Dynamic XFA form');
  };

  // Load Sample Media PDF
  const handleLoadSampleMedia = async () => {
    const bytes = await createSampleMediaPdf();
    await loadPdfData(bytes, 'Technical_Assets_Media_Document.pdf');
    showToast('Loaded sample media document with images & fonts');
  };

  // File Upload Handler
  const handleFileUpload = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    await loadPdfData(bytes, file.name);
    showToast(`Loaded ${file.name}`);
  };

  // Field Value Change
  const handleFieldValueChange = (fieldId: string, newValue: string) => {
    // 1. Update subforms field value in state
    let targetField: XFAField | null = null;
    const updateRecursive = (sfList: XFASubform[]): XFASubform[] => {
      return sfList.map(sf => ({
        ...sf,
        fields: sf.fields.map(f => {
          if (f.id === fieldId) {
            targetField = { ...f, value: newValue };
            return targetField;
          }
          return f;
        }),
        subforms: updateRecursive(sf.subforms),
      }));
    };

    const updatedSubforms = updateRecursive(subforms);
    setSubforms(updatedSubforms);

    // 2. Synchronize datasets XML
    const currentFields: XFAField[] = [];
    const collect = (list: XFASubform[]) => {
      list.forEach(sf => {
        currentFields.push(...sf.fields);
        if (sf.subforms.length > 0) collect(sf.subforms);
      });
    };
    collect(updatedSubforms);

    const newDatasetsXml = updateDatasetsXml(xfaPackets.datasetsXml, currentFields);
    const updatedPackets: XFAPackets = {
      ...xfaPackets,
      datasetsXml: newDatasetsXml,
    };
    updatedPackets.fullXdpXml = assembleXdpPackage(updatedPackets);
    setXfaPackets(updatedPackets);
  };

  // Autofill Sample Data
  const handleAutofillSample = () => {
    const samples: Record<string, string> = {
      companyLegalName: 'Apex Industrial Dynamics, Inc.',
      federalTaxId: '12-9840213',
      registrationDate: '2022-04-12',
      businessStructure: 'Corporation (C-Corp)',
      isPubliclyTraded: '1',
      primaryContactName: 'Marcus Sterling',
      primaryEmailAddress: 'm.sterling@apexindustrial.com',
      primaryPhoneNumber: '+1 (212) 555-0199',
      physicalHeadquartersAddress: '742 Evergreen Terrace, Suite 500, New York, NY 10001',
      annualOperatingRevenue: '24500000',
      complianceJurisdiction: 'North America (SEC / FINRA)',
      auditDeclarationNotes: 'Audited financial statements filed in accordance with GAAP. Clean audit opinion issued.',
      authorizedOfficerSignature: 'Marcus Sterling [Verified Corporate Signature]',
      signatureTimestamp: '2026-03-24',
    };

    const updateRecursive = (sfList: XFASubform[]): XFASubform[] => {
      return sfList.map(sf => ({
        ...sf,
        fields: sf.fields.map(f => ({
          ...f,
          value: samples[f.name] !== undefined ? samples[f.name] : f.value,
        })),
        subforms: updateRecursive(sf.subforms),
      }));
    };

    const updatedSubforms = updateRecursive(subforms);
    setSubforms(updatedSubforms);

    const currentFields: XFAField[] = [];
    const collect = (list: XFASubform[]) => {
      list.forEach(sf => {
        currentFields.push(...sf.fields);
        if (sf.subforms.length > 0) collect(sf.subforms);
      });
    };
    collect(updatedSubforms);

    const newDatasetsXml = updateDatasetsXml(xfaPackets.datasetsXml, currentFields);
    const updatedPackets = { ...xfaPackets, datasetsXml: newDatasetsXml };
    updatedPackets.fullXdpXml = assembleXdpPackage(updatedPackets);
    setXfaPackets(updatedPackets);
    showToast('Autofilled sample form values');
  };

  // Reset to initial values
  const handleResetDefaults = () => {
    const updateRecursive = (sfList: XFASubform[]): XFASubform[] => {
      return sfList.map(sf => ({
        ...sf,
        fields: sf.fields.map(f => ({
          ...f,
          value: f.defaultValue || '',
        })),
        subforms: updateRecursive(sf.subforms),
      }));
    };

    const updatedSubforms = updateRecursive(subforms);
    setSubforms(updatedSubforms);

    const currentFields: XFAField[] = [];
    const collect = (list: XFASubform[]) => {
      list.forEach(sf => {
        currentFields.push(...sf.fields);
        if (sf.subforms.length > 0) collect(sf.subforms);
      });
    };
    collect(updatedSubforms);

    const newDatasetsXml = updateDatasetsXml(xfaPackets.datasetsXml, currentFields);
    const updatedPackets = { ...xfaPackets, datasetsXml: newDatasetsXml };
    updatedPackets.fullXdpXml = assembleXdpPackage(updatedPackets);
    setXfaPackets(updatedPackets);
    showToast('Reset fields to initial values');
  };

  // Apply changes from XML editor
  const handleApplyXmlChanges = (packetType: 'datasets' | 'template' | 'xdp', xmlContent: string) => {
    const updated = { ...xfaPackets };
    if (packetType === 'datasets') {
      updated.datasetsXml = xmlContent;
      // Re-populate values into form fields
      const reParsed = parseXfaTemplate(updated.templateXml, xmlContent);
      if (reParsed.length > 0) setSubforms(reParsed);
    } else if (packetType === 'template') {
      updated.templateXml = xmlContent;
      const reParsed = parseXfaTemplate(xmlContent, updated.datasetsXml);
      if (reParsed.length > 0) setSubforms(reParsed);
    } else if (packetType === 'xdp') {
      updated.fullXdpXml = xmlContent;
    }

    setXfaPackets(updated);
    showToast('XML applied to Form Model');
  };

  // Update Field Appearance (without flattening)
  const handleUpdateFieldAppearance = (fieldId: string, appearance: XFAFieldAppearance, applyToAllOfType: boolean) => {
    const targetField = allFields.find(f => f.id === fieldId);
    if (!targetField) return;

    let updatedTemplateXml = xfaPackets.templateXml || '';

    const updateRecursive = (sfList: XFASubform[]): XFASubform[] => {
      return sfList.map(sf => ({
        ...sf,
        fields: sf.fields.map(f => {
          const isMatch = applyToAllOfType ? f.type === targetField.type : f.id === fieldId;
          if (isMatch) {
            updatedTemplateXml = updateFieldAppearanceInTemplate(updatedTemplateXml, f.name, appearance);
            return {
              ...f,
              appearance: { ...appearance },
            };
          }
          return f;
        }),
        subforms: updateRecursive(sf.subforms),
      }));
    };

    const updatedSubforms = updateRecursive(subforms);
    setSubforms(updatedSubforms);

    const updatedPackets: XFAPackets = {
      ...xfaPackets,
      templateXml: updatedTemplateXml,
    };
    updatedPackets.fullXdpXml = assembleXdpPackage(updatedPackets);
    setXfaPackets(updatedPackets);

    showToast(applyToAllOfType ? `Appearance updated for all ${targetField.type} fields` : `Appearance updated for ${targetField.caption}`);
  };

  // Reset Field Appearance to Default
  const handleResetFieldAppearance = (fieldId: string) => {
    const targetField = allFields.find(f => f.id === fieldId);
    if (!targetField) return;
    const defaultApp = getDefaultAppearanceForType(targetField.type);
    handleUpdateFieldAppearance(fieldId, defaultApp, false);
  };

  // Bulk Field Updates (read-only, visibility, required, values)
  const handleBulkUpdateFields = (
    fieldIds: string[],
    updates: {
      readOnly?: boolean;
      visibility?: 'visible' | 'invisible' | 'hidden';
      required?: boolean;
      resetValues?: boolean;
      clearValues?: boolean;
      setValue?: string;
    }
  ) => {
    if (fieldIds.length === 0) return;
    const idSet = new Set(fieldIds);

    const templateUpdates: BulkTemplateFieldUpdate[] = [];

    const updateRecursive = (sfList: XFASubform[]): XFASubform[] => {
      return sfList.map(sf => ({
        ...sf,
        fields: sf.fields.map(f => {
          if (!idSet.has(f.id)) return f;

          const updated: XFAField = { ...f };

          if (updates.readOnly !== undefined) {
            updated.readOnly = updates.readOnly;
          }
          if (updates.visibility !== undefined) {
            updated.visibility = updates.visibility;
          }
          if (updates.required !== undefined) {
            updated.required = updates.required;
          }
          if (updates.resetValues) {
            updated.value = f.defaultValue || '';
          } else if (updates.clearValues) {
            updated.value = '';
          } else if (updates.setValue !== undefined) {
            updated.value = updates.setValue;
          }

          templateUpdates.push({
            fieldName: f.name,
            readOnly: updates.readOnly,
            visibility: updates.visibility,
            required: updates.required,
          });

          return updated;
        }),
        subforms: updateRecursive(sf.subforms),
      }));
    };

    const updatedSubforms = updateRecursive(subforms);
    setSubforms(updatedSubforms);

    // 1. Update template XML if template properties changed
    let updatedTemplateXml = xfaPackets.templateXml || '';
    if (
      updates.readOnly !== undefined ||
      updates.visibility !== undefined ||
      updates.required !== undefined
    ) {
      updatedTemplateXml = updateBulkFieldsInTemplate(updatedTemplateXml, templateUpdates);
    }

    // 2. Synchronize datasets XML
    const currentFields: XFAField[] = [];
    const collect = (list: XFASubform[]) => {
      list.forEach(sf => {
        currentFields.push(...sf.fields);
        if (sf.subforms.length > 0) collect(sf.subforms);
      });
    };
    collect(updatedSubforms);

    const newDatasetsXml = updateDatasetsXml(xfaPackets.datasetsXml, currentFields);
    const updatedPackets: XFAPackets = {
      ...xfaPackets,
      templateXml: updatedTemplateXml,
      datasetsXml: newDatasetsXml,
    };
    updatedPackets.fullXdpXml = assembleXdpPackage(updatedPackets);
    setXfaPackets(updatedPackets);

    // Feedback summary toast
    const changes: string[] = [];
    if (updates.readOnly !== undefined) changes.push(updates.readOnly ? 'set to Read-Only' : 'set to Editable');
    if (updates.visibility !== undefined) changes.push(`visibility: ${updates.visibility}`);
    if (updates.required !== undefined) changes.push(updates.required ? 'marked Required' : 'marked Optional');
    if (updates.resetValues) changes.push('reset to default');
    if (updates.clearValues) changes.push('cleared values');
    if (updates.setValue !== undefined) changes.push(`set value to "${updates.setValue}"`);

    showToast(`Bulk updated ${fieldIds.length} ${fieldIds.length === 1 ? 'field' : 'fields'} (${changes.join(', ')})`);
  };

  // Export updated PDF with XFA modifications
  const handleExportPdf = async () => {
    if (!pdfBytes) return;
    setIsExportingPdf(true);
    try {
      const updatedPdfBytes = await saveUpdatedXfaPdf(
        pdfBytes,
        xfaPackets.datasetsXml || '',
        xfaPackets.fullXdpXml
      );

      const blob = new Blob([updatedPdfBytes as any], { type: 'application/pdf' });
      const baseName = filename.replace(/\.pdf$/i, '');
      const downloadName = `${baseName}_filled.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Exported ${downloadName}`);
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      showToast(`Export error: ${err.message}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Download All Extracted Resources as ZIP
  const handleDownloadAllZip = async () => {
    if (!manifest) return;
    setIsExportingZip(true);
    try {
      await downloadAllResourcesAsZip(manifest, filename);
      showToast('All resources bundled and downloaded as ZIP!');
    } catch (err: any) {
      console.error('ZIP export error:', err);
      showToast(`ZIP generation failed: ${err.message}`);
    } finally {
      setIsExportingZip(false);
    }
  };

  // Export Data as XML
  const handleExportXml = () => {
    const xml = xfaPackets.datasetsXml || xfaPackets.fullXdpXml || '';
    exportDataAsFile(xml, `${filename.replace(/\.pdf$/i, '')}_data.xml`, 'application/xml');
    showToast('Exported XML dataset');
  };

  // Export Data as JSON
  const handleExportJson = () => {
    const obj: Record<string, string> = {};
    allFields.forEach(f => {
      obj[f.name] = f.value;
    });
    const jsonStr = JSON.stringify(obj, null, 2);
    exportDataAsFile(jsonStr, `${filename.replace(/\.pdf$/i, '')}_data.json`, 'application/json');
    showToast('Exported JSON dataset');
  };

  // Import XML Data
  const handleImportXml = (xmlString: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'application/xml');
      const err = doc.querySelector('parsererror');
      if (err) {
        showToast('Invalid XML file');
        return;
      }

      handleApplyXmlChanges('datasets', xmlString);
      showToast('Imported XML dataset and refreshed form fields');
    } catch (e: any) {
      showToast(`Failed to import XML: ${e.message}`);
    }
  };

  const handleFixMetadata = () => {
    if (!manifest) return;
    const cleanTitle = filename.replace(/\.pdf$/i, '').replace(/_/g, ' ');
    setManifest({
      ...manifest,
      metadata: {
        ...manifest.metadata,
        title: cleanTitle,
        author: 'Authorized Form Signatory',
        subject: 'Enterprise Registry Specification & Dynamic XFA Compliance',
        producer: 'AcroXFA Dynamic PDF Engine',
      },
    });
    showToast('Applied standardized document metadata');
  };

  // Global Keyboard Shortcuts integration
  useGlobalShortcuts({
    activeTab,
    onTabChange: (tab: WorkspaceTab) => {
      setActiveTab(tab);
      const tabLabels: Record<string, string> = {
        form: 'Visual Form Editor',
        xml: 'XFA XML Data',
        preview: 'PDF Canvas & Fields',
        preflight: 'Preflight Audit',
        convert: 'Document Conversion',
        resources: 'Extract Resources',
        batch: 'Batch Extract',
      };
      showToast(`Workspace: ${tabLabels[tab] || tab}`);
    },
    onSavePdf: () => {
      showToast('Exporting filled PDF (Ctrl+S)...');
      handleExportPdf();
    },
    onExportXml: () => {
      showToast('Exporting XML dataset (Ctrl+Shift+S)...');
      handleExportXml();
    },
    onExportJson: () => {
      showToast('Exporting JSON dataset (Ctrl+Shift+J)...');
      handleExportJson();
    },
    onDownloadZip: () => {
      showToast('Packaging resources ZIP (Ctrl+Shift+Z)...');
      handleDownloadAllZip();
    },
    onToggleShortcutsModal: () => {
      setIsShortcutsModalOpen(prev => !prev);
    },
    isShortcutsModalOpen,
  });

  const hasXfa = Boolean(xfaPackets.templateXml || xfaPackets.fullXdpXml || subforms.length > 0);
  const resourceCount = manifest
    ? manifest.images.length + manifest.fonts.length + manifest.attachments.length
    : 0;

  if (isLoading || !pdfBytes) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4 font-sans">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-slate-200">Opening Adobe LiveCycle Dynamic XFA Document...</p>
          <p className="text-xs text-slate-400 font-mono">Compiling XFA packets and rendering interactive form for {filename}</p>
        </div>
      </div>
    );
  }

  // --- ACROBAT STYLE UI MODE ---
  if (uiMode === 'acrobat') {
    return (
      <>
        <AcrobatWorkspace
          pdfBytes={pdfBytes}
          filename={filename}
          hasXfa={hasXfa}
          fields={allFields}
          subforms={subforms}
          xfaPackets={xfaPackets}
          manifest={manifest}
          preflightSummary={preflightSummary}
          targetFieldId={targetFieldId}
          onFieldValueChange={handleFieldValueChange}
          onUpdateFieldAppearance={handleUpdateFieldAppearance}
          onResetFieldAppearance={handleResetFieldAppearance}
          onBulkUpdateFields={handleBulkUpdateFields}
          onExportPdf={handleExportPdf}
          onExportXml={handleExportXml}
          onExportJson={handleExportJson}
          onDownloadAllZip={handleDownloadAllZip}
          onLoadCanadaBookFund={handleLoadCanadaBookFund}
          onFileUpload={handleFileUpload}
          onAutofillSample={handleAutofillSample}
          onResetDefaults={handleResetDefaults}
          onApplyXmlChanges={handleApplyXmlChanges}
          onShowToast={showToast}
          onSwitchToStudioUI={() => setUiMode('studio')}
          isExportingPdf={isExportingPdf}
        />

        {/* Keyboard Shortcuts Reference Modal */}
        <KeyboardShortcutsModal
          isOpen={isShortcutsModalOpen}
          onClose={() => setIsShortcutsModalOpen(false)}
          onTabSelect={(tab) => {
            setActiveTab(tab);
            setUiMode('studio');
            setIsShortcutsModalOpen(false);
          }}
          onExportPdf={handleExportPdf}
          onExportXml={handleExportXml}
          onDownloadAllZip={handleDownloadAllZip}
        />

        {/* Offline Mode Indicator */}
        <OfflineIndicator />

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-700 text-slate-100 text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </>
    );
  }

  // --- MODERN STUDIO UI MODE ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-white">
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExportPdf={handleExportPdf}
        onDownloadAllResources={handleDownloadAllZip}
        isExportingPdf={isExportingPdf}
        isExportingZip={isExportingZip}
        hasXfa={hasXfa}
        resourceCount={resourceCount}
        preflightErrorsCount={preflightSummary.errorsCount}
        preflightWarningsCount={preflightSummary.warningsCount}
        fields={allFields}
        onSelectField={handleHeaderSelectField}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onSwitchToAcrobatUI={() => setUiMode('acrobat')}
        onLoadCanadaBookFund={handleLoadCanadaBookFund}
      />

      {/* Document Information & Control Toolbar */}
      <DocumentToolbar
        filename={filename}
        metadata={manifest?.metadata || null}
        onFileUpload={handleFileUpload}
        onLoadSampleXfa={handleLoadSampleXfa}
        onLoadSampleMedia={handleLoadSampleMedia}
        onLoadCanadaBookFund={handleLoadCanadaBookFund}
        onOpenUrlModal={() => setIsUrlModalOpen(true)}
        onImportXml={handleImportXml}
        onExportXml={handleExportXml}
        onExportJson={handleExportJson}
        onSwitchToConvert={() => setActiveTab('convert')}
        hasXfa={hasXfa}
        totalFieldsCount={allFields.length}
        completedFieldsCount={completedFieldsCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Parsing PDF objects, XFA packets, and extracting resources...</p>
          </div>
        ) : (
          <>
            {activeTab === 'form' && (
              <XfaFormEditor
                subforms={subforms}
                hasXfa={hasXfa}
                onFieldValueChange={handleFieldValueChange}
                onAutofillSample={handleAutofillSample}
                onResetDefaults={handleResetDefaults}
                onLoadSampleXfa={handleLoadSampleXfa}
                onSwitchToResources={() => setActiveTab('resources')}
                onBulkUpdateFields={handleBulkUpdateFields}
              />
            )}

            {activeTab === 'xml' && (
              <XmlEditor
                packets={xfaPackets}
                onApplyXmlChanges={handleApplyXmlChanges}
                onExportXmlFile={(content, name) => exportDataAsFile(content, name, 'application/xml')}
              />
            )}

            {activeTab === 'resources' && manifest && (
              <ResourceExtractorView
                manifest={manifest}
                originalFilename={filename}
                onDownloadAllZip={handleDownloadAllZip}
                isExportingZip={isExportingZip}
                onShowToast={showToast}
              />
            )}

            {activeTab === 'preview' && pdfBytes && (
              <PdfCanvasViewer
                pdfBytes={pdfBytes}
                filename={filename}
                hasXfa={hasXfa}
                fields={allFields}
                subforms={subforms}
                targetFieldId={targetFieldId}
                onFieldValueChange={handleFieldValueChange}
                onUpdateFieldAppearance={handleUpdateFieldAppearance}
                onResetFieldAppearance={handleResetFieldAppearance}
                onSwitchToForm={() => setActiveTab('form')}
                onSwitchToResources={() => setActiveTab('resources')}
              />
            )}

            {activeTab === 'preflight' && (
              <PreflightAuditView
                summary={preflightSummary}
                onRerunPreflight={setPreflightProfile}
                onJumpToField={fieldId => {
                  setTargetFieldId(fieldId);
                  setActiveTab('preview');
                  showToast('Navigated to field in Visual Canvas');
                }}
                onAutofillField={(fieldId, val) => {
                  handleFieldValueChange(fieldId, val);
                  showToast('Auto-fixed field value');
                }}
                onFixMetadata={handleFixMetadata}
              />
            )}

            {activeTab === 'convert' && (
              <ConversionView
                filename={filename}
                metadata={manifest?.metadata || null}
                fields={allFields}
                subforms={subforms}
                textPages={manifest?.textPages || []}
                manifest={manifest}
                onShowToast={showToast}
              />
            )}

            {activeTab === 'batch' && (
              <BatchProcessorView onLoadSinglePdf={loadPdfData} />
            )}
          </>
        )}
      </main>

      {/* Keyboard Shortcuts Reference Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        onTabSelect={(tab) => {
          setActiveTab(tab);
          setIsShortcutsModalOpen(false);
        }}
        onExportPdf={handleExportPdf}
        onExportXml={handleExportXml}
        onDownloadAllZip={handleDownloadAllZip}
      />

      {/* Offline Mode Indicator */}
      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-700 text-slate-100 text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* URL Modal Dialog in Studio View */}
      {isUrlModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100">Open Document From Web URL</h3>
              <button
                onClick={() => setIsUrlModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Enter the direct URL of an XFA or standard PDF. Our engine will bypass browser "Please wait" errors and render all LiveCycle packets.
            </p>

            <div className="space-y-2">
              <input
                type="url"
                value={urlModalInput}
                onChange={e => setUrlModalInput(e.target.value)}
                placeholder="https://example.com/document.pdf"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />

              <div className="pt-1">
                <span className="text-[11px] text-slate-400 block mb-1">Official Canada Book Fund form:</span>
                <button
                  type="button"
                  onClick={() => setUrlModalInput('https://www.canada.ca/content/dam/pch/documents/services/funding/book-fund/cBF-FinRepDatFrm-eng.pdf')}
                  className="w-full text-left p-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-red-300 truncate transition-colors"
                >
                  https://www.canada.ca/.../cBF-FinRepDatFrm-eng.pdf
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsUrlModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUrlModalSubmit}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors shadow-xs"
              >
                Open &amp; Compile XFA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
