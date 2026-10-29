import React, { useState, useMemo } from 'react';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RotateCcw,
  Undo2,
  Redo2,
  HelpCircle,
  Check,
  Building,
  DollarSign,
  FileText,
  Calendar,
  PenTool,
  Info,
  Lightbulb,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { XFAField, XFASubform } from '../types/pdf';
import { validateAllFields, quickFixFieldValue } from '../utils/validationEngine';
import { HistoryEntry } from '../hooks/useFormHistory';
import { getFieldTooltipGuide } from '../utils/xfaTooltipHelper';
import { FieldTooltipPopover } from './FieldTooltipPopover';

export interface BeginnerStep {
  id: string;
  title: string;
  description: string;
  icon: 'organization' | 'project' | 'revenues' | 'expenses' | 'signature' | 'general';
  fields: XFAField[];
}

interface BeginnerFormWizardProps {
  subforms: XFASubform[];
  allFields: XFAField[];
  onFieldValueChange: (fieldId: string, newValue: string) => void;
  onAutofillSample: () => void;
  onResetDefaults: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  history: HistoryEntry[];
  currentIndex: number;
  onExportPdf?: () => void;
  onSwitchToAdvanced?: () => void;
}

export const BeginnerFormWizard: React.FC<BeginnerFormWizardProps> = ({
  subforms,
  allFields,
  onFieldValueChange,
  onAutofillSample,
  onResetDefaults,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  history,
  currentIndex,
  onExportPdf,
  onSwitchToAdvanced,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);

  // Run validation engine
  const validationReport = useMemo(() => {
    return validateAllFields(allFields);
  }, [allFields]);

  // Group fields into 4-5 friendly beginner steps
  const steps: BeginnerStep[] = useMemo(() => {
    if (allFields.length === 0) return [];

    // Helper matchers
    const isOrgField = (f: XFAField) => {
      const lower = (f.name + ' ' + f.caption + ' ' + (f.dataRef || '')).toLowerCase();
      return (
        lower.includes('org') ||
        lower.includes('company') ||
        lower.includes('applicant') ||
        lower.includes('recipient') ||
        lower.includes('legal') ||
        lower.includes('tax') ||
        lower.includes('address') ||
        lower.includes('phone') ||
        lower.includes('email') ||
        lower.includes('contact') ||
        lower.includes('business_num')
      );
    };

    const isProjectField = (f: XFAField) => {
      const lower = (f.name + ' ' + f.caption + ' ' + (f.dataRef || '')).toLowerCase();
      return (
        lower.includes('project') ||
        lower.includes('title') ||
        lower.includes('fiscal') ||
        lower.includes('year') ||
        lower.includes('period') ||
        lower.includes('date') && !lower.includes('sign') ||
        lower.includes('jurisdiction') ||
        lower.includes('activity')
      );
    };

    const isRevenueField = (f: XFAField) => {
      const lower = (f.name + ' ' + f.caption + ' ' + (f.dataRef || '')).toLowerCase();
      return (
        lower.includes('rev') ||
        lower.includes('fund') ||
        lower.includes('grant') ||
        lower.includes('contribution') ||
        lower.includes('sales') ||
        lower.includes('income')
      );
    };

    const isExpenseField = (f: XFAField) => {
      const lower = (f.name + ' ' + f.caption + ' ' + (f.dataRef || '')).toLowerCase();
      return (
        lower.includes('exp') ||
        lower.includes('cost') ||
        lower.includes('spend') ||
        lower.includes('fee') ||
        lower.includes('salary') ||
        lower.includes('admin') ||
        lower.includes('marketing') ||
        lower.includes('print') ||
        lower.includes('balance') ||
        lower.includes('surplus') ||
        lower.includes('deficit')
      );
    };

    const isSignatureField = (f: XFAField) => {
      const lower = (f.name + ' ' + f.caption + ' ' + (f.dataRef || '')).toLowerCase();
      return (
        f.type === 'signature' ||
        lower.includes('sign') ||
        lower.includes('officer') ||
        lower.includes('certif') ||
        lower.includes('declar') ||
        lower.includes('authoriz') ||
        lower.includes('witness')
      );
    };

    // Partition
    const orgFields: XFAField[] = [];
    const projFields: XFAField[] = [];
    const revFields: XFAField[] = [];
    const expFields: XFAField[] = [];
    const sigFields: XFAField[] = [];
    const remainingFields: XFAField[] = [];

    allFields.forEach(f => {
      if (isSignatureField(f)) {
        sigFields.push(f);
      } else if (isOrgField(f)) {
        orgFields.push(f);
      } else if (isRevenueField(f)) {
        revFields.push(f);
      } else if (isExpenseField(f)) {
        expFields.push(f);
      } else if (isProjectField(f)) {
        projFields.push(f);
      } else {
        remainingFields.push(f);
      }
    });

    // If partitioned well, construct steps
    const builtSteps: BeginnerStep[] = [];

    if (orgFields.length > 0) {
      builtSteps.push({
        id: 'step_org',
        title: 'Organization & Contact',
        description: 'Basic identifying information about your organization and primary contact person.',
        icon: 'organization',
        fields: orgFields,
      });
    }

    if (projFields.length > 0) {
      builtSteps.push({
        id: 'step_proj',
        title: 'Project Information',
        description: 'Details about the funded project, activity timelines, and reporting period.',
        icon: 'project',
        fields: projFields,
      });
    }

    if (revFields.length > 0) {
      builtSteps.push({
        id: 'step_rev',
        title: 'Revenues & Funding',
        description: 'All received contributions, grants, public funding, and earned revenues.',
        icon: 'revenues',
        fields: revFields,
      });
    }

    if (expFields.length > 0) {
      builtSteps.push({
        id: 'step_exp',
        title: 'Project Expenditures',
        description: 'Breakdown of actual project costs, operating expenditures, and financial balance.',
        icon: 'expenses',
        fields: expFields,
      });
    }

    if (sigFields.length > 0) {
      builtSteps.push({
        id: 'step_sig',
        title: 'Certification & Signature',
        description: 'Authorized officer declaration verifying the accuracy of the financial information.',
        icon: 'signature',
        fields: sigFields,
      });
    }

    // If remaining fields exist, append to either project or an additional step
    if (remainingFields.length > 0) {
      if (builtSteps.length === 0) {
        // Fallback: chunk into blocks of 8 fields
        const chunkSize = 8;
        for (let i = 0; i < remainingFields.length; i += chunkSize) {
          const chunk = remainingFields.slice(i, i + chunkSize);
          builtSteps.push({
            id: `step_${i / chunkSize + 1}`,
            title: `Part ${i / chunkSize + 1}: Form Details`,
            description: `Review and complete fields ${i + 1} to ${Math.min(i + chunkSize, remainingFields.length)}.`,
            icon: 'general',
            fields: chunk,
          });
        }
      } else {
        // Append remaining to the first or second step
        builtSteps[0].fields.push(...remainingFields);
      }
    }

    return builtSteps;
  }, [allFields]);

  // Current active step
  const activeStep = steps[currentStepIndex] || steps[0];

  // Helper stats for current step
  const stepStats = useMemo(() => {
    if (!activeStep) return { total: 0, completed: 0, requiredCount: 0, requiredCompleted: 0 };
    const total = activeStep.fields.length;
    const completed = activeStep.fields.filter(
      f => f.value && f.value.trim().length > 0 && f.value !== '0'
    ).length;
    const required = activeStep.fields.filter(f => f.required);
    const requiredCompleted = required.filter(
      f => f.value && f.value.trim().length > 0 && f.value !== '0'
    ).length;

    return {
      total,
      completed,
      requiredCount: required.length,
      requiredCompleted,
      pct: total > 0 ? Math.round((completed / total) * 100) : 100,
    };
  }, [activeStep]);

  // Overall form stats
  const overallStats = useMemo(() => {
    const total = allFields.length;
    const completed = allFields.filter(
      f => f.value && f.value.trim().length > 0 && f.value !== '0'
    ).length;
    const required = allFields.filter(f => f.required);
    const requiredCompleted = required.filter(
      f => f.value && f.value.trim().length > 0 && f.value !== '0'
    ).length;

    return {
      total,
      completed,
      requiredCount: required.length,
      requiredCompleted,
      pct: total > 0 ? Math.round((completed / total) * 100) : 100,
      isFullyCompleted: required.length > 0 ? requiredCompleted >= required.length : completed > 0,
    };
  }, [allFields]);

  // Step Icon renderer
  const renderStepIcon = (icon: BeginnerStep['icon'], active: boolean) => {
    const className = `w-4 h-4 ${active ? 'text-sky-400' : 'text-slate-400'}`;
    switch (icon) {
      case 'organization':
        return <Building className={className} />;
      case 'project':
        return <Calendar className={className} />;
      case 'revenues':
        return <DollarSign className={className} />;
      case 'expenses':
        return <FileText className={className} />;
      case 'signature':
        return <PenTool className={className} />;
      default:
        return <FileText className={className} />;
    }
  };

  // Helper text mapping directly leveraging XFA assist / tooltip properties with semantic fallback
  const getPlainEnglishGuidance = (field: XFAField): string => {
    return getFieldTooltipGuide(field).guidance;
  };

  return (
    <div className="space-y-6">
      {/* 1. Beginner Mode Top Welcoming Ribbon */}
      <div className="bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/30 border border-sky-800/40 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
                <span>Simple Beginner Mode</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>{activeStep?.title || 'Form Filling Assistant'}</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {activeStep?.description}
            </p>
          </div>

          {/* Quick Action Buttons for Beginners */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Undo Button with Last 10 history count */}
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                canUndo
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-xs'
                  : 'bg-slate-900/60 text-slate-500 border border-slate-800 cursor-not-allowed'
              }`}
              title="Undo last field change (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Undo</span>
              {canUndo && (
                <span className="text-[10px] bg-sky-950 text-sky-300 px-1.5 py-0.2 rounded font-mono font-bold">
                  {currentIndex + 1}
                </span>
              )}
            </button>

            {/* Redo Button */}
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                canRedo
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-xs'
                  : 'bg-slate-900/60 text-slate-500 border border-slate-800 cursor-not-allowed'
              }`}
              title="Redo previous change (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Redo</span>
              {canRedo && (
                <span className="text-[10px] bg-sky-950 text-sky-300 px-1.5 py-0.2 rounded font-mono font-bold">
                  {history.length - currentIndex - 1}
                </span>
              )}
            </button>

            {/* Beginner Prefill Button */}
            <button
              onClick={onAutofillSample}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-900 bg-sky-400 hover:bg-sky-300 rounded-lg transition-all shadow-sm font-semibold"
              title="Fill this form with realistic sample data to see how it works"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Prefill Example</span>
            </button>

            {/* Reset Defaults */}
            <button
              onClick={onResetDefaults}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="Reset form"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Switch to Advanced Mode */}
            {onSwitchToAdvanced && (
              <button
                onClick={onSwitchToAdvanced}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700/80 transition-colors"
                title="Switch to full power editor with XML and raw field controls"
              >
                <span>Advanced View</span>
              </button>
            )}
          </div>
        </div>

        {/* Overall Completion Stepper Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {steps.map((st, idx) => {
              const isCurrent = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;
              const stepErrors = st.fields.filter(f => validationReport.fieldErrorMap.has(f.id)).length;
              const stepCompleted = st.fields.filter(
                f => f.value && f.value.trim().length > 0 && f.value !== '0'
              ).length;
              const isAllDone = stepCompleted === st.fields.length && st.fields.length > 0;

              return (
                <button
                  key={st.id}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`text-left p-2.5 rounded-xl border transition-all text-xs flex flex-col justify-between gap-1.5 relative overflow-hidden ${
                    isCurrent
                      ? 'bg-sky-500/10 border-sky-400 text-slate-100 shadow-md ring-1 ring-sky-400/40'
                      : isPast
                      ? 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-slate-600'
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono text-[10px] text-slate-400">0{idx + 1}</span>
                    {stepErrors > 0 ? (
                      <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[10px] font-bold">
                        !
                      </span>
                    ) : isAllDone ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      renderStepIcon(st.icon, isCurrent)
                    )}
                  </div>
                  <div>
                    <div className="font-semibold truncate text-[11px]">{st.title}</div>
                    <div className="text-[10px] text-slate-400">
                      {stepCompleted}/{st.fields.length} filled
                    </div>
                  </div>
                  {/* Step progress bar */}
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all ${isCurrent ? 'bg-sky-400' : 'bg-emerald-400'}`}
                      style={{
                        width: `${st.fields.length > 0 ? Math.round((stepCompleted / st.fields.length) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Beginner Friendly 30-Second Guide (Collapsible) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden text-xs">
        <button
          onClick={() => setShowGuide(prev => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between text-slate-300 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-medium text-slate-200">
              New to this form? Click to read the 30-Second Quick Start Guide
            </span>
          </div>
          {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showGuide && (
          <div className="px-5 pb-4 pt-1 border-t border-slate-800/80 space-y-3 bg-slate-900/40 text-slate-300 leading-relaxed">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-1">
                <div className="font-semibold text-sky-300 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>Required Fields</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Boxes with a blue <strong className="text-sky-300">Required</strong> badge must be completed before official government filing.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-1">
                <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>Automatic Math</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Total Revenues, Total Expenditures, and Net Variances recalculate dynamically as you enter numbers.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-1">
                <div className="font-semibold text-purple-300 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>Instant 1-Click Auto-Fix</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  If you enter phone or postal codes without spaces, click the <strong className="text-amber-300">Auto-Fix</strong> button to format them.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Main Step Fields Card Deck */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-200">
              {activeStep?.title} Fields
            </h3>
            <span className="text-[11px] text-slate-400">
              ({stepStats.completed} of {stepStats.total} completed)
            </span>
          </div>

          {/* Step Progress Pill */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-sky-400">
              {stepStats.pct}% Complete
            </span>
            <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
              <div
                className="bg-sky-400 h-full transition-all duration-300"
                style={{ width: `${stepStats.pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Fields list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeStep?.fields.map(field => {
            const hasError = validationReport.fieldErrorMap.has(field.id);
            const errorList = validationReport.fieldErrorMap.get(field.id);
            const firstError = errorList?.[0];
            const isFilled = field.value && field.value.trim().length > 0 && field.value !== '0';
            const isFocused = focusedFieldId === field.id;

            return (
              <div
                key={field.id}
                className={`p-4 rounded-xl border transition-all ${
                  hasError
                    ? 'bg-rose-950/20 border-rose-700/80 shadow-md ring-1 ring-rose-500/20'
                    : isFocused
                    ? 'bg-slate-900 border-sky-500 shadow-md ring-1 ring-sky-500/30'
                    : isFilled
                    ? 'bg-slate-900/90 border-slate-700/80'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Field Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="space-y-0.5">
                    <label
                      htmlFor={`input_${field.id}`}
                      className="text-xs font-bold text-slate-100 flex items-center gap-1.5 cursor-pointer flex-wrap"
                    >
                      <span>{field.caption || field.name}</span>
                      {field.required && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800">
                          Required
                        </span>
                      )}
                      <FieldTooltipPopover field={field} variant="badge" />
                    </label>
                    <p className="text-[11px] text-slate-400">
                      {getPlainEnglishGuidance(field)}
                    </p>
                  </div>

                  {/* Status Indicator Icon */}
                  <div className="shrink-0 mt-0.5">
                    {hasError ? (
                      <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-bold" title={firstError?.message}>
                        !
                      </span>
                    ) : isFilled ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-700 inline-block" />
                    )}
                  </div>
                </div>

                {/* Field Input Control */}
                <div className="mt-2.5">
                  {field.type === 'check' ? (
                    <label className="flex items-center gap-3 p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        id={`input_${field.id}`}
                        checked={field.value === '1' || field.value.toLowerCase() === 'true' || field.value.toLowerCase() === 'yes'}
                        onChange={e => onFieldValueChange(field.id, e.target.checked ? '1' : '0')}
                        disabled={field.readOnly}
                        className="w-4 h-4 rounded text-sky-500 focus:ring-sky-400 focus:ring-offset-slate-900 bg-slate-900 border-slate-600"
                      />
                      <span className="text-xs font-medium text-slate-200">
                        Yes, I confirm and accept this declaration
                      </span>
                    </label>
                  ) : field.type === 'choice' && field.options && field.options.length > 0 ? (
                    <select
                      id={`input_${field.id}`}
                      value={field.value || ''}
                      onChange={e => onFieldValueChange(field.id, e.target.value)}
                      onFocus={() => setFocusedFieldId(field.id)}
                      onBlur={() => setFocusedFieldId(null)}
                      disabled={field.readOnly}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">-- Select an option --</option>
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'signature' ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        id={`input_${field.id}`}
                        value={field.value || ''}
                        onChange={e => onFieldValueChange(field.id, e.target.value)}
                        onFocus={() => setFocusedFieldId(field.id)}
                        onBlur={() => setFocusedFieldId(null)}
                        placeholder="Type full legal name to apply electronic signature..."
                        disabled={field.readOnly}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-serif italic text-sky-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      />
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Applying your full name electronically certifies this document under Canadian Uniform Electronic Commerce standards.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type={field.type === 'numeric' ? 'text' : 'text'}
                        id={`input_${field.id}`}
                        value={field.value || ''}
                        onChange={e => onFieldValueChange(field.id, e.target.value)}
                        onFocus={() => setFocusedFieldId(field.id)}
                        onBlur={() => setFocusedFieldId(null)}
                        placeholder={`e.g. ${field.type === 'numeric' ? '125,000' : 'Enter here...'}`}
                        disabled={field.readOnly}
                        className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none transition-colors ${
                          hasError
                            ? 'border-rose-600 focus:ring-1 focus:ring-rose-500'
                            : 'border-slate-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                        } ${field.readOnly ? 'bg-slate-900/60 text-slate-500 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  )}
                </div>

                {/* Friendly Inline Error / Quick Fix */}
                {hasError && firstError && (
                  <div className="mt-2.5 p-2 rounded-lg bg-rose-950/40 border border-rose-800/60 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-rose-300 text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>{firstError.message}</span>
                    </div>

                    {/* Auto-Fix button */}
                    <button
                      type="button"
                      onClick={() => {
                        const fixed = quickFixFieldValue(field, firstError);
                        if (fixed) onFieldValueChange(field.id, fixed);
                      }}
                      className="px-2 py-0.5 rounded bg-rose-900/70 hover:bg-rose-800 text-rose-200 text-[10px] font-semibold flex items-center gap-1 border border-rose-700 shrink-0 transition-colors"
                      title="Automatically fix this formatting issue"
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>Auto-Fix</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Bottom Stepper Navigation & Form Finish Action */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        {/* Previous Step Button */}
        <button
          onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
          disabled={currentStepIndex === 0}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            currentStepIndex === 0
              ? 'bg-slate-950 text-slate-600 cursor-not-allowed border border-slate-800'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Previous Step</span>
        </button>

        {/* Center Progress summary */}
        <div className="text-center space-y-1">
          <div className="text-xs font-semibold text-slate-200">
            Form Progress: {overallStats.completed} of {overallStats.total} fields filled ({overallStats.pct}%)
          </div>
          <div className="text-[11px] text-slate-400">
            {validationReport.errorCount === 0 ? (
              <span className="text-emerald-400 flex items-center justify-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>All validation checks passed</span>
              </span>
            ) : (
              <span className="text-rose-400">
                {validationReport.errorCount} {validationReport.errorCount === 1 ? 'issue needs' : 'issues need'} correction
              </span>
            )}
          </div>
        </div>

        {/* Next Step OR Final Export Button */}
        <div className="flex items-center gap-2">
          {currentStepIndex < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStepIndex(prev => Math.min(steps.length - 1, prev + 1))}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-xl transition-all shadow-md"
            >
              <span>Next: {steps[currentStepIndex + 1]?.title}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onExportPdf}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md"
              title="Download your completed and signed PDF ready for submission"
            >
              <Check className="w-4 h-4" />
              <span>Download Finished PDF</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
