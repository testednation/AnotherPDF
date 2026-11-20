import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  FileText,
  ExternalLink,
  Search,
  Power,
  Code2,
  FlaskConical,
  X,
} from 'lucide-react';
import { XFAField, XFASubform } from '../types/pdf';
import {
  CustomFieldRegexRule,
  CUSTOM_REGEX_PRESETS,
  compileCustomRegex,
  evaluateCustomRegexRule,
} from '../utils/customValidationRules';

interface CustomValidationRulesPanelProps {
  subforms: XFASubform[];
  allFields: XFAField[];
  customRules: Record<string, CustomFieldRegexRule>;
  initialFieldId?: string | null;
  onSaveRule: (rule: CustomFieldRegexRule) => void;
  onDeleteRule: (fieldId: string) => void;
  onToggleRuleEnabled: (fieldId: string, enabled: boolean) => void;
  onNavigateToField?: (fieldId: string) => void;
  onNavigateToFormEditor?: (fieldId: string) => void;
}

export const CustomValidationRulesPanel: React.FC<CustomValidationRulesPanelProps> = ({
  subforms,
  allFields,
  customRules,
  initialFieldId = null,
  onSaveRule,
  onDeleteRule,
  onToggleRuleEnabled,
  onNavigateToField,
  onNavigateToFormEditor,
}) => {
  const selectableFields = useMemo(
    () => allFields.filter(f => f.visibility !== 'hidden' && f.type !== 'check'),
    [allFields]
  );

  const [selectedFieldId, setSelectedFieldId] = useState<string>(() => {
    if (initialFieldId && allFields.some(f => f.id === initialFieldId)) return initialFieldId;
    return selectableFields[0]?.id || allFields[0]?.id || '';
  });

  const [fieldFilter, setFieldFilter] = useState('');
  const [pattern, setPattern] = useState('');
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [sandboxTestInput, setSandboxTestInput] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Sync if parent jumps to a specific field from the graph inspector
  useEffect(() => {
    if (initialFieldId && allFields.some(f => f.id === initialFieldId)) {
      setSelectedFieldId(initialFieldId);
    }
  }, [initialFieldId, allFields]);

  // Populate editor form whenever selectedFieldId changes
  useEffect(() => {
    const existing = selectedFieldId ? customRules[selectedFieldId] : undefined;
    const field = allFields.find(f => f.id === selectedFieldId);
    if (existing) {
      setPattern(existing.pattern);
      setCaseInsensitive(existing.flags.includes('i'));
      setWarningMessage(existing.message);
      setActivePresetId(null);
    } else {
      setPattern('');
      setCaseInsensitive(false);
      setWarningMessage('');
      setActivePresetId(null);
    }
    setSandboxTestInput(field?.value || '');
  }, [selectedFieldId, customRules, allFields]);

  const selectedField = useMemo(
    () => allFields.find(f => f.id === selectedFieldId) || null,
    [allFields, selectedFieldId]
  );

  const existingRule = selectedFieldId ? customRules[selectedFieldId] : undefined;
  const activeFlags = caseInsensitive ? 'i' : '';
  const syntaxCheck = useMemo(
    () => compileCustomRegex(pattern, activeFlags),
    [pattern, activeFlags]
  );

  const sandboxEvaluation = useMemo(() => {
    if (!pattern.trim() || !syntaxCheck.valid || !syntaxCheck.regex) return null;
    if (!sandboxTestInput.trim()) return { status: 'empty' as const };
    const matched = syntaxCheck.regex.test(sandboxTestInput.trim());
    return { status: matched ? ('pass' as const) : ('violation' as const) };
  }, [pattern, syntaxCheck, sandboxTestInput]);

  const currentFieldEvaluation = useMemo(() => {
    if (!selectedField || !pattern.trim() || !syntaxCheck.valid || !syntaxCheck.regex) return null;
    const val = (selectedField.value || '').trim();
    if (!val) return { status: 'empty' as const };
    const matched = syntaxCheck.regex.test(val);
    return { status: matched ? ('pass' as const) : ('violation' as const), val };
  }, [selectedField, pattern, syntaxCheck]);

  const filteredFields = useMemo(() => {
    const q = fieldFilter.trim().toLowerCase();
    const list = selectableFields.length > 0 ? selectableFields : allFields;
    if (!q) return list;
    return list.filter(
      f =>
        (f.caption || '').toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        (f.parentSubform || '').toLowerCase().includes(q)
    );
  }, [selectableFields, allFields, fieldFilter]);

  const rulesList = useMemo(() => {
    return Object.values(customRules).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [customRules]);

  const ruleStats = useMemo(() => {
    let activeCount = 0;
    let passingCount = 0;
    let violationCount = 0;

    for (const rule of rulesList) {
      if (!rule.enabled) continue;
      activeCount++;
      const field = allFields.find(f => f.id === rule.fieldId);
      const evalRes = evaluateCustomRegexRule(rule, field?.value || '');
      if (evalRes.status === 'pass') passingCount++;
      if (evalRes.status === 'violation') violationCount++;
    }

    return { activeCount, passingCount, violationCount };
  }, [rulesList, allFields]);

  const handleApplyPreset = (presetId: string) => {
    const preset = CUSTOM_REGEX_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setPattern(preset.pattern);
    setCaseInsensitive(preset.flags.includes('i'));
    setWarningMessage(preset.defaultMessage);
    setActivePresetId(preset.id);
    if (!sandboxTestInput.trim()) {
      setSandboxTestInput(preset.exampleValid);
    }
  };

  const handleSubmitRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedField || !syntaxCheck.valid) return;

    const finalMessage =
      warningMessage.trim() ||
      `${selectedField.caption || selectedField.name} must match pattern /${pattern.trim()}/${activeFlags}`;

    onSaveRule({
      fieldId: selectedField.id,
      fieldName: selectedField.name,
      fieldCaption: selectedField.caption || selectedField.name,
      subformName: selectedField.parentSubform,
      pattern: pattern.trim(),
      flags: activeFlags,
      message: finalMessage,
      enabled: true,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 select-text">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Panel Intro Banner */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-amber-400" />
              <h2 className="text-sm font-bold text-slate-100">
                Custom XFA Field Regex Validation Rules
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-700/60">
                Live Warning Toast Guard
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              Define custom regular expression patterns for any XFA field. Whenever a user enters data into the PDF canvas or Form Editor that violates an active rule, a warning toast is triggered immediately and the field is flagged in real-time validation.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-500 uppercase">Active</div>
              <div className="text-sm font-bold text-sky-300">{ruleStats.activeCount}</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-800/50 text-center">
              <div className="text-[10px] text-emerald-400/80 uppercase">Passing</div>
              <div className="text-sm font-bold text-emerald-300">{ruleStats.passingCount}</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-800/50 text-center">
              <div className="text-[10px] text-amber-400/80 uppercase">Violations</div>
              <div className="text-sm font-bold text-amber-300">{ruleStats.violationCount}</div>
            </div>
          </div>
        </div>

        {/* Main 2-Column Builder & Active Registry */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: Rule Builder & Live Regex Sandbox */}
          <form
            onSubmit={handleSubmitRule}
            className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  {existingRule ? 'Edit Custom Regex Rule' : 'Create Custom Regex Rule'}
                </h3>
              </div>
              {existingRule && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
                  Editing Existing Rule
                </span>
              )}
            </div>

            {/* 1. Target XFA Field Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  1. Target XFA Field
                </label>
                <span className="text-[10px] font-mono text-slate-500">
                  {filteredFields.length} of {allFields.length} fields
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={fieldFilter}
                  onChange={e => setFieldFilter(e.target.value)}
                  placeholder="Filter fields by caption, XFA name, or subform..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {fieldFilter && (
                  <button
                    type="button"
                    onClick={() => setFieldFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={selectedFieldId}
                onChange={e => setSelectedFieldId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {subforms.length > 0 && !fieldFilter ? (
                  subforms.map(sf => {
                    const sfFields = sf.fields.filter(
                      f => f.visibility !== 'hidden' && f.type !== 'check'
                    );
                    if (sfFields.length === 0) return null;
                    return (
                      <optgroup key={sf.id} label={sf.title || sf.name}>
                        {sfFields.map(f => (
                          <option key={f.id} value={f.id}>
                            {customRules[f.id] ? '★ ' : ''}
                            {f.caption || f.name} ({f.name})
                          </option>
                        ))}
                      </optgroup>
                    );
                  })
                ) : (
                  filteredFields.map(f => (
                    <option key={f.id} value={f.id}>
                      {customRules[f.id] ? '★ ' : ''}
                      {f.caption || f.name} ({f.name})
                    </option>
                  ))
                )}
              </select>

              {selectedField && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px] font-mono">
                  <span className="text-slate-400 truncate">
                    Current value:{' '}
                    <strong className="text-sky-300">
                      {selectedField.value?.trim() ? `"${selectedField.value}"` : '(empty)'}
                    </strong>
                  </span>
                  {currentFieldEvaluation && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        currentFieldEvaluation.status === 'pass'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                          : currentFieldEvaluation.status === 'violation'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {currentFieldEvaluation.status === 'pass'
                        ? 'Current Value Passes'
                        : currentFieldEvaluation.status === 'violation'
                        ? 'Current Value Violates Rule'
                        : 'Field Currently Empty'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 2. Quick Regex Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Quick Regex Presets</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CUSTOM_REGEX_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.id)}
                    className={`px-2 py-1 rounded-md text-[11px] border transition-colors cursor-pointer ${
                      activePresetId === preset.id
                        ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Custom Regular Expression Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  2. Regular Expression Pattern
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={caseInsensitive}
                    onChange={e => setCaseInsensitive(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-950 text-indigo-500"
                  />
                  <span>Case-insensitive (/i)</span>
                </label>
              </div>

              <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg focus-within:border-indigo-500 overflow-hidden">
                <span className="px-2.5 text-slate-500 font-mono text-xs select-none">/</span>
                <input
                  type="text"
                  value={pattern}
                  onChange={e => {
                    setPattern(e.target.value);
                    setActivePresetId(null);
                  }}
                  placeholder="e.g. ^\d{2}-\d{7}$ or ^[A-Z]{3}-\d{4}$"
                  className="flex-1 bg-transparent py-2 text-xs font-mono text-sky-200 placeholder:text-slate-600 focus:outline-none"
                />
                <span className="px-2.5 text-slate-500 font-mono text-xs select-none">
                  /{activeFlags}
                </span>
              </div>

              {pattern.trim() && (
                <div
                  className={`text-[11px] flex items-center gap-1.5 ${
                    syntaxCheck.valid ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {syntaxCheck.valid ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Valid JavaScript RegExp syntax</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono">{syntaxCheck.error}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 4. Warning Toast Message */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                3. Warning Toast Message (shown on violation)
              </label>
              <input
                type="text"
                value={warningMessage}
                onChange={e => setWarningMessage(e.target.value)}
                placeholder="e.g. Please enter a valid Tax ID in XX-XXXXXXX format"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* 5. Live Pattern Test Sandbox */}
            <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <FlaskConical className="w-3.5 h-3.5 text-sky-400" />
                  <span>Live Pattern Test Sandbox</span>
                </span>
                {sandboxEvaluation && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                      sandboxEvaluation.status === 'pass'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : sandboxEvaluation.status === 'violation'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {sandboxEvaluation.status === 'pass'
                      ? '✓ Matches Pattern'
                      : sandboxEvaluation.status === 'violation'
                      ? '⚠ Triggers Warning Toast'
                      : 'Enter test value'}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={sandboxTestInput}
                onChange={e => setSandboxTestInput(e.target.value)}
                placeholder="Type any sample text here to test your regex..."
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              {existingRule ? (
                <button
                  type="button"
                  onClick={() => onDeleteRule(selectedFieldId)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/70 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Rule</span>
                </button>
              ) : (
                <span className="text-[11px] text-slate-500">
                  Saved rules take effect immediately on all form inputs.
                </span>
              )}

              <button
                type="submit"
                disabled={!selectedField || !syntaxCheck.valid}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-sm transition-colors disabled:opacity-45 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{existingRule ? 'Update Validation Rule' : 'Add Validation Rule'}</span>
              </button>
            </div>
          </form>

          {/* RIGHT: Configured Custom Rules Registry */}
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Configured Field Rules ({rulesList.length})
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Click any rule to edit
              </span>
            </div>

            {rulesList.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="space-y-1 max-w-sm mx-auto">
                  <p className="text-xs font-semibold text-slate-300">
                    No custom regex validation rules defined yet
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Choose an XFA field on the left, enter a regex pattern (or pick a preset), and click{' '}
                    <strong className="text-indigo-300">Add Validation Rule</strong>. Entering invalid data into that field anywhere in the app will immediately display a warning toast.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                {rulesList.map(rule => {
                  const field = allFields.find(f => f.id === rule.fieldId);
                  const currentVal = field?.value || '';
                  const evalResult = evaluateCustomRegexRule(rule, currentVal);
                  const isSelected = rule.fieldId === selectedFieldId;

                  return (
                    <div
                      key={rule.fieldId}
                      onClick={() => setSelectedFieldId(rule.fieldId)}
                      className={`rounded-xl border p-3.5 space-y-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-950/30 border-indigo-500/70 ring-1 ring-indigo-500/30'
                          : evalResult.status === 'violation'
                          ? 'bg-amber-950/20 border-amber-600/50 hover:border-amber-500/70'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      } ${!rule.enabled ? 'opacity-65' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-100 truncate">
                              {rule.fieldCaption}
                            </span>
                            {evalResult.status === 'pass' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Valid</span>
                              </span>
                            )}
                            {evalResult.status === 'violation' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/50">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>Violated</span>
                              </span>
                            )}
                            {evalResult.status === 'empty' && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                                Empty
                              </span>
                            )}
                            {!rule.enabled && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-500 border border-slate-700">
                                Paused
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {rule.fieldName}
                            {rule.subformName ? ` · ${rule.subformName}` : ''}
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onToggleRuleEnabled(rule.fieldId, !rule.enabled)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              rule.enabled
                                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/70'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                            title={rule.enabled ? 'Pause validation rule' : 'Enable validation rule'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRule(rule.fieldId)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-700 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                            title="Delete rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-sky-300 break-all">
                        /{rule.pattern}/{rule.flags}
                      </div>

                      <div className="text-[11px] text-amber-200/90 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{rule.message}</span>
                      </div>

                      <div
                        className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[10px]"
                        onClick={e => e.stopPropagation()}
                      >
                        <span className="font-mono text-slate-400 truncate max-w-[200px]">
                          Val: <strong className="text-slate-200">{currentVal || '(empty)'}</strong>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {onNavigateToFormEditor && (
                            <button
                              type="button"
                              onClick={() => onNavigateToFormEditor(rule.fieldId)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-700/60 text-indigo-200 font-medium cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Edit Value</span>
                            </button>
                          )}
                          {onNavigateToField && (
                            <button
                              type="button"
                              onClick={() => onNavigateToField(rule.fieldId)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-medium cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Canvas</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
