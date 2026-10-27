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
import {
  extractXfaPackets,
  parseXfaTemplate,
  updateDatasetsXml,
  saveUpdatedXfaPdf,
  exportDataAsFile,
  assembleXdpPackage,
  updateFieldAppearanceInTemplate,
  getDefaultAppearanceForType,
} from './utils/xfaEngine';
import { extractAllPdfResources, downloadAllResourcesAsZip } from './utils/resourceExtractor';
import { createSampleXfaPdf, createSampleMediaPdf } from './utils/samplePdfs';
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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

  // Initial load: automatically load dynamic XFA sample
  useEffect(() => {
    const initSample = async () => {
      const sampleBytes = await createSampleXfaPdf();
      await loadPdfData(sampleBytes, 'Enterprise_Registry_XFA_Form.pdf');
    };
    initSample();
  }, [loadPdfData]);

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

  const hasXfa = Boolean(xfaPackets.templateXml || xfaPackets.fullXdpXml || subforms.length > 0);
  const resourceCount = manifest
    ? manifest.images.length + manifest.fonts.length + manifest.attachments.length
    : 0;

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
      />

      {/* Document Information & Control Toolbar */}
      <DocumentToolbar
        filename={filename}
        metadata={manifest?.metadata || null}
        onFileUpload={handleFileUpload}
        onLoadSampleXfa={handleLoadSampleXfa}
        onLoadSampleMedia={handleLoadSampleMedia}
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
                hasXfa={hasXfa}
                fields={allFields}
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

      {/* Offline Mode Indicator */}
      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-700 text-slate-100 text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
