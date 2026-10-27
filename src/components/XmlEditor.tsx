import React, { useState, useEffect } from 'react';
import {
  FileCode,
  Copy,
  Check,
  Download,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Save,
} from 'lucide-react';
import { XFAPackets } from '../types/pdf';

interface XmlEditorProps {
  packets: XFAPackets;
  onApplyXmlChanges: (packetType: 'datasets' | 'template' | 'xdp', xmlContent: string) => void;
  onExportXmlFile: (content: string, filename: string) => void;
}

export const XmlEditor: React.FC<XmlEditorProps> = ({
  packets,
  onApplyXmlChanges,
  onExportXmlFile,
}) => {
  const [activePacket, setActivePacket] = useState<'datasets' | 'template' | 'config' | 'xdp'>('datasets');
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [xmlError, setXmlError] = useState<string | null>(null);

  // Load content when packet changes
  useEffect(() => {
    let raw = '';
    if (activePacket === 'datasets') {
      raw = packets.datasetsXml || '<xfa:datasets><xfa:data></xfa:data></xfa:datasets>';
    } else if (activePacket === 'template') {
      raw = packets.templateXml || '<template></template>';
    } else if (activePacket === 'config') {
      raw = packets.configXml || '<config></config>';
    } else if (activePacket === 'xdp') {
      raw = packets.fullXdpXml || '';
    }
    setContent(prettifyXml(raw));
    setXmlError(null);
    setSaveStatus(null);
  }, [activePacket, packets]);

  const handlePrettify = () => {
    try {
      setContent(prettifyXml(content));
      setXmlError(null);
    } catch (e: any) {
      setXmlError(`XML formatting error: ${e.message}`);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    try {
      // Validate XML syntax with DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'application/xml');
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        setXmlError(`Invalid XML Syntax: ${parserError.textContent?.slice(0, 150)}...`);
        return;
      }

      setXmlError(null);
      if (activePacket === 'datasets' || activePacket === 'template' || activePacket === 'xdp') {
        onApplyXmlChanges(activePacket, content);
      }
      setSaveStatus('Changes successfully applied to Form & PDF buffer!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setXmlError(`Parse failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-4">
      {/* Top packet selector bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/60 border border-slate-800 rounded-lg">
          <button
            onClick={() => setActivePacket('datasets')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activePacket === 'datasets'
                ? 'bg-slate-800 text-sky-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            datasets.xml (Data Values)
          </button>
          <button
            onClick={() => setActivePacket('template')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activePacket === 'template'
                ? 'bg-slate-800 text-sky-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            template.xml (Layout &amp; Fields)
          </button>
          <button
            onClick={() => setActivePacket('config')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activePacket === 'config'
                ? 'bg-slate-800 text-sky-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            config.xml
          </button>
          <button
            onClick={() => setActivePacket('xdp')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activePacket === 'xdp'
                ? 'bg-slate-800 text-sky-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            package.xdp (Complete Bundle)
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrettify}
            className="px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors inline-flex items-center gap-1.5"
            title="Format and indent XML"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Format</span>
          </button>

          <button
            onClick={handleCopy}
            className="px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors inline-flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={() => onExportXmlFile(content, `${activePacket}.xml`)}
            className="px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          {(activePacket === 'datasets' || activePacket === 'template' || activePacket === 'xdp') && (
            <button
              onClick={handleApply}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors inline-flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Apply to Form</span>
            </button>
          )}
        </div>
      </div>

      {/* Error / Status notification */}
      {xmlError && (
        <div className="flex items-center gap-2 p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{xmlError}</span>
        </div>
      )}

      {saveStatus && (
        <div className="flex items-center gap-2 p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-lg text-emerald-300 text-xs">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Code Editor Container */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 font-mono">
          <span>{activePacket}.xml</span>
          <span>{content.length.toLocaleString()} characters · {content.split('\n').length} lines</span>
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          spellCheck={false}
          className="w-full h-[520px] p-4 bg-transparent text-slate-200 font-mono text-xs leading-relaxed resize-none focus:outline-none selection:bg-sky-500/30"
          placeholder="XML content will appear here..."
        />
      </div>
    </div>
  );
};

function prettifyXml(sourceXml: string): string {
  const xmlDoc = new DOMParser().parseFromString(sourceXml, 'application/xml');
  const xsltDoc = new DOMParser().parseFromString(
    [
      '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
      '  <xsl:strip-space elements="*"/>',
      '  <xsl:template match="para[content-style][not(text())]">',
      '    <xsl:value-of select="normalize-space(.)"/>',
      '  </xsl:template>',
      '  <xsl:template match="node()|@*">',
      '    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
      '  </xsl:template>',
      '  <xsl:output indent="yes"/>',
      '</xsl:stylesheet>',
    ].join('\n'),
    'application/xml'
  );

  const xsltProcessor = new XSLTProcessor();
  xsltProcessor.importStylesheet(xsltDoc);
  const resultDoc = xsltProcessor.transformToDocument(xmlDoc);
  const resultXml = new XMLSerializer().serializeToString(resultDoc);
  return resultXml || sourceXml;
}
