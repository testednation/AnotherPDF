import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle,
  FileText,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  PenTool,
  HelpCircle,
  Hash,
  Calendar,
  CheckSquare,
  ListFilter,
} from 'lucide-react';
import { XFASubform, XFAField } from '../types/pdf';

interface XfaFormEditorProps {
  subforms: XFASubform[];
  hasXfa: boolean;
  onFieldValueChange: (fieldId: string, newValue: string) => void;
  onAutofillSample: () => void;
  onResetDefaults: () => void;
  onLoadSampleXfa: () => void;
  onSwitchToResources: () => void;
}

export const XfaFormEditor: React.FC<XfaFormEditorProps> = ({
  subforms,
  hasXfa,
  onFieldValueChange,
  onAutofillSample,
  onResetDefaults,
  onLoadSampleXfa,
  onSwitchToResources,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [activeSignatureField, setActiveSignatureField] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter subforms and fields based on search query
  const filteredSubforms = useMemo(() => {
    if (!searchQuery.trim()) return subforms;
    const q = searchQuery.toLowerCase();

    return subforms
      .map(sf => {
        const matchingFields = sf.fields.filter(
          f =>
            f.name.toLowerCase().includes(q) ||
            f.caption.toLowerCase().includes(q) ||
            f.value.toLowerCase().includes(q) ||
            (f.dataRef && f.dataRef.toLowerCase().includes(q))
        );
        const matchingSubforms = sf.subforms.filter(child =>
          child.fields.some(
            f =>
              f.name.toLowerCase().includes(q) ||
              f.caption.toLowerCase().includes(q) ||
              f.value.toLowerCase().includes(q)
          )
        );

        if (
          matchingFields.length > 0 ||
          matchingSubforms.length > 0 ||
          sf.title.toLowerCase().includes(q)
        ) {
          return {
            ...sf,
            fields: matchingFields.length > 0 ? matchingFields : sf.fields,
            subforms: matchingSubforms,
          };
        }
        return null;
      })
      .filter(Boolean) as XFASubform[];
  }, [subforms, searchQuery]);

  // Total fields counter
  const totalFields = useMemo(() => {
    let count = 0;
    const countFields = (sfList: XFASubform[]) => {
      sfList.forEach(sf => {
        count += sf.fields.length;
        if (sf.subforms.length > 0) countFields(sf.subforms);
      });
    };
    countFields(subforms);
    return count;
  }, [subforms]);

  const filledFields = useMemo(() => {
    let count = 0;
    const countFilled = (sfList: XFASubform[]) => {
      sfList.forEach(sf => {
        sf.fields.forEach(f => {
          if (f.value && f.value.trim().length > 0 && f.value !== '0') count++;
        });
        if (sf.subforms.length > 0) countFilled(sf.subforms);
      });
    };
    countFilled(subforms);
    return count;
  }, [subforms]);

  if (!hasXfa || subforms.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-lg font-semibold text-slate-100">
              No Dynamic XFA Form Architecture Detected
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              This file is a standard PDF without embedded XML Forms Architecture (<code className="text-slate-300 font-mono text-xs">/XFA</code>) packets.
              You can explore the PDF pages, or extract all embedded resources (images, fonts, attachments, and text).
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onLoadSampleXfa}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors shadow-sm"
            >
              Load Sample Dynamic XFA Form
            </button>
            <button
              onClick={onSwitchToResources}
              className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              Extract Resources from this PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-100">
              XFA Interactive Form Editor
            </h1>
            <span className="text-xs text-sky-400 font-mono bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-sm">
              Live Two-Way Sync
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Form modifications update the XML <code className="font-mono text-slate-300">&lt;datasets&gt;</code> packet and will be saved directly into the PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={onAutofillSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
            title="Autofill form with realistic compliance test values"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Autofill Sample</span>
          </button>
          <button
            onClick={onResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors"
            title="Reset all fields to their original values"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-lg px-3.5 py-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search fields by title, variable name, or XML binding..."
            className="w-full bg-slate-950/60 border border-slate-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono shrink-0">
          <span>
            <strong className="text-slate-200 font-semibold">{filledFields}</strong> / {totalFields} fields filled
          </span>
        </div>
      </div>

      {/* Subform Sections */}
      <div className="space-y-4">
        {filteredSubforms.map(subform => (
          <SubformSection
            key={subform.id}
            subform={subform}
            isCollapsed={Boolean(collapsedSections[subform.id])}
            onToggle={() => toggleSection(subform.id)}
            onFieldValueChange={onFieldValueChange}
            activeSignatureField={activeSignatureField}
            setActiveSignatureField={setActiveSignatureField}
          />
        ))}

        {filteredSubforms.length === 0 && (
          <div className="text-center py-10 bg-slate-900/40 border border-slate-800 rounded-xl">
            <p className="text-sm text-slate-400">No form fields matched "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs text-sky-400 hover:underline"
            >
              Clear search filter
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface SubformSectionProps {
  subform: XFASubform;
  isCollapsed: boolean;
  onToggle: () => void;
  onFieldValueChange: (fieldId: string, newValue: string) => void;
  activeSignatureField: string | null;
  setActiveSignatureField: (fieldId: string | null) => void;
}

const SubformSection: React.FC<SubformSectionProps> = ({
  subform,
  isCollapsed,
  onToggle,
  onFieldValueChange,
  activeSignatureField,
  setActiveSignatureField,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all">
      {/* Section Header */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between px-5 py-3.5 bg-slate-900/80 hover:bg-slate-800/50 cursor-pointer border-b border-slate-800/80 select-none"
      >
        <div className="flex items-center gap-3">
          <button className="text-slate-400 hover:text-slate-200 transition-colors">
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{subform.title}</h2>
            <span className="text-[11px] font-mono text-slate-400">
              subform: {subform.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span>{subform.fields.length} {subform.fields.length === 1 ? 'field' : 'fields'}</span>
        </div>
      </div>

      {/* Section Content */}
      {!isCollapsed && (
        <div className="p-5 space-y-5">
          {subform.fields.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subform.fields.map(field => (
                <FieldInputControl
                  key={field.id}
                  field={field}
                  onChange={val => onFieldValueChange(field.id, val)}
                  isSignatureActive={activeSignatureField === field.id}
                  onActivateSignature={() => setActiveSignatureField(field.id)}
                  onDeactivateSignature={() => setActiveSignatureField(null)}
                />
              ))}
            </div>
          )}

          {/* Child Subforms */}
          {subform.subforms.map(childSf => (
            <div key={childSf.id} className="pt-2">
              <SubformSection
                subform={childSf}
                isCollapsed={false}
                onToggle={() => {}}
                onFieldValueChange={onFieldValueChange}
                activeSignatureField={activeSignatureField}
                setActiveSignatureField={setActiveSignatureField}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface FieldInputControlProps {
  field: XFAField;
  onChange: (value: string) => void;
  isSignatureActive: boolean;
  onActivateSignature: () => void;
  onDeactivateSignature: () => void;
}

const FieldInputControl: React.FC<FieldInputControlProps> = ({
  field,
  onChange,
  isSignatureActive,
  onActivateSignature,
  onDeactivateSignature,
}) => {
  const isFullWidth = field.type === 'multiline' || field.type === 'signature';

  return (
    <div className={`space-y-1.5 ${isFullWidth ? 'md:col-span-2' : ''}`}>
      {/* Label and bindings */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
          <span>{field.caption}</span>
          {field.required && <span className="text-rose-400 text-xs">*</span>}
          {field.tooltip && (
            <span title={field.tooltip} className="text-slate-500 hover:text-slate-300 cursor-help">
              <HelpCircle className="w-3 h-3" />
            </span>
          )}
        </label>
        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[160px]" title={field.dataRef || field.name}>
          {field.name}
        </span>
      </div>

      {/* Control Type Rendering */}
      {field.type === 'check' ? (
        <label className="flex items-center gap-2.5 p-2.5 bg-slate-950/40 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition-colors">
          <input
            type="checkbox"
            checked={field.value === '1' || field.value.toLowerCase() === 'true' || field.value.toLowerCase() === 'yes'}
            onChange={e => onChange(e.target.checked ? '1' : '0')}
            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
          />
          <span className="text-xs text-slate-300">
            {field.value === '1' || field.value.toLowerCase() === 'true' ? 'Enabled / Affirmed' : 'Disabled / No'}
          </span>
        </label>
      ) : field.type === 'choice' ? (
        <select
          value={field.value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
        >
          <option value="">-- Select an option --</option>
          {field.options?.map((opt, i) => (
            <option key={i} value={opt} className="bg-slate-900 text-slate-200">
              {opt}
            </option>
          ))}
          {/* If current value is not in options, show it */}
          {field.value && !field.options?.includes(field.value) && (
            <option value={field.value} className="bg-slate-900 text-slate-200">
              {field.value}
            </option>
          )}
        </select>
      ) : field.type === 'multiline' ? (
        <textarea
          rows={3}
          value={field.value}
          onChange={e => onChange(e.target.value)}
          placeholder="Enter detailed notes or disclosures..."
          className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
        />
      ) : field.type === 'date' ? (
        <div className="relative">
          <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="date"
            value={field.value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>
      ) : field.type === 'numeric' ? (
        <div className="relative">
          <Hash className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="number"
            value={field.value}
            onChange={e => onChange(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 font-mono tabular-nums focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>
      ) : field.type === 'signature' ? (
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <PenTool className="w-3.5 h-3.5 text-sky-400" />
              <span>Digital Electronic Signature Block</span>
            </div>
            {field.value && (
              <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                <span>Signed</span>
              </span>
            )}
          </div>
          <input
            type="text"
            value={field.value}
            onChange={e => onChange(e.target.value)}
            placeholder="Type legal signatory name (e.g. John Doe / Digital ID)..."
            className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-xs font-serif text-sky-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
          />
        </div>
      ) : (
        <input
          type="text"
          value={field.value}
          onChange={e => onChange(e.target.value)}
          placeholder={`Enter ${field.caption.toLowerCase()}...`}
          className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
        />
      )}
    </div>
  );
};
