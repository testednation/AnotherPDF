import React, { useState } from 'react';
import {
  PreflightSummary,
  PreflightIssue,
  PreflightProfile,
  PreflightSeverity,
} from '../types/preflight';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Download,
  FileText,
  FileCode,
  Filter,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Layers,
  Sliders,
  Check,
} from 'lucide-react';
import { generatePreflightTextReport } from '../utils/preflightEngine';
import { exportDataAsFile } from '../utils/xfaEngine';

interface PreflightAuditViewProps {
  summary: PreflightSummary;
  onRerunPreflight: (profile: PreflightProfile) => void;
  onJumpToField: (fieldId: string) => void;
  onAutofillField: (fieldId: string, suggestedValue: string) => void;
  onFixMetadata: () => void;
}

export const PreflightAuditView: React.FC<PreflightAuditViewProps> = ({
  summary,
  onRerunPreflight,
  onJumpToField,
  onAutofillField,
  onFixMetadata,
}) => {
  const [selectedProfile, setSelectedProfile] = useState<PreflightProfile>(summary.profile || 'comprehensive');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning' | 'passed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFixedMap, setQuickFixedMap] = useState<Record<string, boolean>>({});

  const handleProfileChange = (newProfile: PreflightProfile) => {
    setSelectedProfile(newProfile);
    onRerunPreflight(newProfile);
  };

  const filteredIssues = summary.issues.filter(issue => {
    if (severityFilter !== 'all' && issue.severity !== severityFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        issue.message.toLowerCase().includes(q) ||
        issue.ruleId.toLowerCase().includes(q) ||
        issue.ruleName.toLowerCase().includes(q) ||
        (issue.targetName && issue.targetName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleDownloadTextReport = () => {
    const report = generatePreflightTextReport(summary);
    exportDataAsFile(
      report,
      `${summary.documentName.replace(/\.pdf$/i, '')}_preflight_report.txt`,
      'text/plain;charset=utf-8'
    );
  };

  const handleDownloadJsonReport = () => {
    const jsonStr = JSON.stringify(summary, null, 2);
    exportDataAsFile(
      jsonStr,
      `${summary.documentName.replace(/\.pdf$/i, '')}_preflight_audit.json`,
      'application/json'
    );
  };

  const handleQuickFill = (issue: PreflightIssue) => {
    if (!issue.targetId) return;
    let sampleVal = 'Verified Entry';
    if (issue.ruleId === 'XFA-004') sampleVal = '2026-03-24';
    if (issue.ruleId === 'XFA-005') sampleVal = '1000';
    if (issue.targetName?.toLowerCase().includes('email')) sampleVal = 'admin@example.com';
    if (issue.targetName?.toLowerCase().includes('name')) sampleVal = 'Authorized Signatory';

    onAutofillField(issue.targetId, sampleVal);
    setQuickFixedMap(prev => ({ ...prev, [issue.id]: true }));
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Top Banner & Audit Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-100">
              PDF &amp; XFA Preflight Audit Engine
            </h1>
            <span className="text-xs text-sky-400 font-mono bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-sm">
              100% Offline
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated compliance verification across XFA form architecture, PDF/A archival standards, image resolution, and universal accessibility.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onRerunPreflight(selectedProfile)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
            <span>Re-run Audit</span>
          </button>

          <button
            onClick={handleDownloadTextReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Preflight Certificate (.txt)</span>
          </button>
        </div>
      </div>

      {/* KPI Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Overall Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Overall Compliance</span>
          <div className="flex items-center gap-2 pt-0.5">
            {summary.overallStatus === 'pass' ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400">PASSED</span>
              </>
            ) : summary.overallStatus === 'warning' ? (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-bold text-amber-400">WARNINGS</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-rose-400" />
                <span className="text-sm font-bold text-rose-400">FAILED</span>
              </>
            )}
          </div>
        </div>

        {/* Critical Errors */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Critical Errors</span>
          <div className="flex items-center gap-2 pt-0.5">
            <span className={`text-xl font-bold font-mono tabular-nums ${summary.errorsCount > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {summary.errorsCount}
            </span>
            <span className="text-xs text-slate-500">must resolve</span>
          </div>
        </div>

        {/* Warnings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Warnings &amp; Advisories</span>
          <div className="flex items-center gap-2 pt-0.5">
            <span className={`text-xl font-bold font-mono tabular-nums ${summary.warningsCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
              {summary.warningsCount}
            </span>
            <span className="text-xs text-slate-500">recommended</span>
          </div>
        </div>

        {/* Passed Checks */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Passed Assertions</span>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-xl font-bold font-mono tabular-nums text-emerald-400">
              {summary.passedCount}
            </span>
            <span className="text-xs text-slate-500">of {summary.totalChecks}</span>
          </div>
        </div>
      </div>

      {/* Profile & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
        {/* Row 1: Profile Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/60 border border-slate-800 rounded-lg">
          <button
            onClick={() => handleProfileChange('comprehensive')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              selectedProfile === 'comprehensive'
                ? 'bg-slate-800 text-sky-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Comprehensive Audit (All Rules)
          </button>
          <button
            onClick={() => handleProfileChange('xfa-compliance')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              selectedProfile === 'xfa-compliance'
                ? 'bg-slate-800 text-sky-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            XFA Form &amp; Data Submission
          </button>
          <button
            onClick={() => handleProfileChange('pdfa-archival')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              selectedProfile === 'pdfa-archival'
                ? 'bg-slate-800 text-sky-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PDF/A Archival (ISO 19005)
          </button>
          <button
            onClick={() => handleProfileChange('print-quality')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              selectedProfile === 'print-quality'
                ? 'bg-slate-800 text-sky-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Print &amp; Asset Resolution
          </button>
          <button
            onClick={() => handleProfileChange('accessibility')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              selectedProfile === 'accessibility'
                ? 'bg-slate-800 text-sky-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Accessibility (PDF/UA)
          </button>
        </div>

        {/* Row 2: Severity filter and search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSeverityFilter('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                severityFilter === 'all'
                  ? 'bg-slate-800 border-slate-600 text-slate-100'
                  : 'border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({summary.issues.length})
            </button>
            <button
              onClick={() => setSeverityFilter('error')}
              className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                severityFilter === 'error'
                  ? 'bg-rose-950/80 border-rose-700 text-rose-300'
                  : 'border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Errors ({summary.errorsCount})
            </button>
            <button
              onClick={() => setSeverityFilter('warning')}
              className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                severityFilter === 'warning'
                  ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                  : 'border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Warnings ({summary.warningsCount})
            </button>
            <button
              onClick={() => setSeverityFilter('passed')}
              className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                severityFilter === 'passed'
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                  : 'border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Passed ({summary.passedCount})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search rule ID or target..."
              className="bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-full sm:w-48"
            />
            <button
              onClick={handleDownloadJsonReport}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded border border-slate-800 shrink-0"
              title="Export Full Preflight Report JSON"
            >
              <FileCode className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {filteredIssues.map(issue => {
          const isFixed = quickFixedMap[issue.id];

          return (
            <div
              key={issue.id}
              className={`bg-slate-900 border rounded-xl p-4 transition-colors space-y-3 ${
                issue.severity === 'error'
                  ? 'border-rose-900/60 bg-rose-950/10'
                  : issue.severity === 'warning'
                  ? 'border-amber-900/60 bg-amber-950/10'
                  : 'border-slate-800/80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {issue.severity === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    ) : issue.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-xs text-slate-100">
                        {issue.message}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-slate-400">
                        {issue.ruleId}
                      </span>
                      {issue.pageNumber && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Page {issue.pageNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {issue.detail}
                    </p>
                    {issue.suggestedFix && (
                      <div className="text-[11px] text-sky-400 font-mono pt-1">
                        Remedy: {issue.suggestedFix}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fix / Jump Action buttons */}
                <div className="flex items-center gap-2 self-start sm:self-center shrink-0 pt-2 sm:pt-0">
                  {issue.targetType === 'field' && issue.targetId && (
                    <button
                      onClick={() => onJumpToField(issue.targetId!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
                      title="Jump to this field in Visual Form Editor"
                    >
                      <span>Locate Field</span>
                      <ArrowRight className="w-3 h-3 text-sky-400" />
                    </button>
                  )}

                  {issue.autoFixable && issue.fixAction === 'fill-field' && (
                    <button
                      onClick={() => handleQuickFill(issue)}
                      disabled={isFixed}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        isFixed
                          ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                          : 'bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300'
                      }`}
                    >
                      {isFixed ? <Check className="w-3 h-3 text-emerald-400" /> : <Sparkles className="w-3 h-3 text-sky-400" />}
                      <span>{isFixed ? 'Field Filled' : 'Quick Fill'}</span>
                    </button>
                  )}

                  {issue.fixAction === 'set-metadata' && (
                    <button
                      onClick={onFixMetadata}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 rounded-md transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-sky-400" />
                      <span>Auto-Set Metadata</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredIssues.length === 0 && (
          <div className="py-12 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-200">No issues found matching this filter.</p>
            <p className="text-xs text-slate-500">Your PDF document satisfies all selected preflight verification rules.</p>
          </div>
        )}
      </div>
    </div>
  );
};
