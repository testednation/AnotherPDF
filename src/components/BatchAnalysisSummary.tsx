import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileText,
  TrendingUp,
  Award,
  Sliders,
  Eye,
  Sparkles,
  CheckSquare,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import {
  BatchFileItem,
  BatchSchemaColumn,
  BatchMergeResult,
} from '../utils/batchProcessor';

export interface BatchAnalysisSummaryProps {
  items: BatchFileItem[];
  selectedMergeIds: string[];
  schema: BatchSchemaColumn[];
  lastMergeResult?: BatchMergeResult | null;
  onInspectDocument?: (item: BatchFileItem) => void;
  onExportMergedAnalytics?: (format: 'csv' | 'json') => void;
  compact?: boolean;
}

export interface DocumentCompletionMetric {
  id: string;
  orderIndex: number;
  shortLabel: string;
  filename: string;
  formTitle: string;
  xfaType: string;
  totalFields: number;
  filledFields: number;
  emptyFields: number;
  completionRate: number;
  requiredTotal: number;
  requiredFilled: number;
  requiredRate: number;
  optionalRate: number;
  subformCount: number;
  rawItem: BatchFileItem;
}

export interface FieldBatchMetric {
  key: string;
  label: string;
  shortLabel: string;
  type: string;
  subform: string;
  populatedDocs: number;
  emptyDocs: number;
  completionRate: number;
}

export interface SubformBatchMetric {
  subform: string;
  totalFields: number;
  filledFields: number;
  emptyFields: number;
  completionRate: number;
}

export function BatchAnalysisSummary({
  items,
  selectedMergeIds,
  schema,
  lastMergeResult,
  onInspectDocument,
  onExportMergedAnalytics,
  compact = false,
}: BatchAnalysisSummaryProps) {
  const [chartViewMode, setChartViewMode] = useState<'completion_rate' | 'field_volume' | 'per_field'>('completion_rate');
  const [sortBy, setSortBy] = useState<'merge_order' | 'completion_desc' | 'completion_asc'>('merge_order');

  // Filter to merged documents (or all completed documents if none selected)
  const mergedDocuments = useMemo(() => {
    const completed = items.filter(i => i.status === 'completed');
    if (selectedMergeIds.length > 0) {
      const selectedSet = new Set(selectedMergeIds);
      const filtered = completed.filter(i => selectedSet.has(i.id));
      if (filtered.length > 0) return filtered;
    }
    return completed;
  }, [items, selectedMergeIds]);

  // Iterate through all merged documents to build comparative completion metrics
  const documentMetrics = useMemo<DocumentCompletionMetric[]>(() => {
    const metrics = mergedDocuments.map((doc, idx) => {
      const totalFields = doc.fields.length;
      const filledFields = doc.fields.filter(f => f.value.trim().length > 0).length;
      const emptyFields = Math.max(0, totalFields - filledFields);
      const completionRate =
        totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : doc.metadata.completionPercentage;

      const requiredFields = doc.fields.filter(f => f.required);
      const requiredTotal = requiredFields.length;
      const requiredFilled = requiredFields.filter(f => f.value.trim().length > 0).length;
      const requiredRate =
        requiredTotal > 0 ? Math.round((requiredFilled / requiredTotal) * 100) : completionRate;

      const optionalFields = doc.fields.filter(f => !f.required);
      const optionalTotal = optionalFields.length;
      const optionalFilled = optionalFields.filter(f => f.value.trim().length > 0).length;
      const optionalRate =
        optionalTotal > 0 ? Math.round((optionalFilled / optionalTotal) * 100) : completionRate;

      const cleanBaseName = doc.filename.replace(/\.pdf$/i, '');
      const shortLabel =
        cleanBaseName.length > 18
          ? `#${idx + 1} ${cleanBaseName.slice(0, 15)}…`
          : `#${idx + 1} ${cleanBaseName}`;

      return {
        id: doc.id,
        orderIndex: idx + 1,
        shortLabel,
        filename: doc.filename,
        formTitle: doc.metadata.formTitle,
        xfaType: doc.metadata.xfaType,
        totalFields,
        filledFields,
        emptyFields,
        completionRate,
        requiredTotal,
        requiredFilled,
        requiredRate,
        optionalRate,
        subformCount: doc.metadata.subformCount,
        rawItem: doc,
      };
    });

    if (sortBy === 'completion_desc') {
      return [...metrics].sort((a, b) => b.completionRate - a.completionRate);
    }
    if (sortBy === 'completion_asc') {
      return [...metrics].sort((a, b) => a.completionRate - b.completionRate);
    }
    return metrics;
  }, [mergedDocuments, sortBy]);

  // Cross-Batch Field Completion Rates (iterating across all merged documents for each schema field)
  const fieldMetrics = useMemo<FieldBatchMetric[]>(() => {
    if (mergedDocuments.length === 0) return [];

    return schema.map(col => {
      let populatedDocs = 0;

      for (const doc of mergedDocuments) {
        const directVal = doc.dataMap[col.key];
        const fieldMatch = doc.fields.find(f => f.name === col.key || f.caption === col.label);
        const val = (directVal ?? fieldMatch?.value ?? '').trim();
        if (val.length > 0) {
          populatedDocs++;
        }
      }

      const emptyDocs = Math.max(0, mergedDocuments.length - populatedDocs);
      const completionRate = Math.round((populatedDocs / mergedDocuments.length) * 100);
      const shortLabel = col.label.length > 22 ? `${col.label.slice(0, 20)}…` : col.label;

      return {
        key: col.key,
        label: col.label,
        shortLabel,
        type: col.type,
        subform: col.subform || 'Root',
        populatedDocs,
        emptyDocs,
        completionRate,
      };
    });
  }, [mergedDocuments, schema]);

  // Subform-level completion aggregation across merged documents
  const subformMetrics = useMemo<SubformBatchMetric[]>(() => {
    const map = new Map<string, { total: number; filled: number }>();

    for (const doc of mergedDocuments) {
      for (const field of doc.fields) {
        const sf = field.subform || 'RootForm';
        const entry = map.get(sf) || { total: 0, filled: 0 };
        entry.total += 1;
        if (field.value.trim().length > 0) {
          entry.filled += 1;
        }
        map.set(sf, entry);
      }
    }

    return Array.from(map.entries())
      .map(([subform, counts]) => ({
        subform,
        totalFields: counts.total,
        filledFields: counts.filled,
        emptyFields: Math.max(0, counts.total - counts.filled),
        completionRate: counts.total > 0 ? Math.round((counts.filled / counts.total) * 100) : 0,
      }))
      .sort((a, b) => b.totalFields - a.totalFields);
  }, [mergedDocuments]);

  // Overall Batch Analysis KPIs
  const batchKpis = useMemo(() => {
    if (documentMetrics.length === 0) {
      return {
        mergedDocCount: 0,
        avgCompletionRate: 0,
        avgRequiredRate: 0,
        totalFields: 0,
        totalFilled: 0,
        totalEmpty: 0,
        highestDoc: null as DocumentCompletionMetric | null,
        lowestDoc: null as DocumentCompletionMetric | null,
        fullFieldsCount: 0,
      };
    }

    const totalFields = documentMetrics.reduce((acc, d) => acc + d.totalFields, 0);
    const totalFilled = documentMetrics.reduce((acc, d) => acc + d.filledFields, 0);
    const totalEmpty = Math.max(0, totalFields - totalFilled);

    const avgCompletionRate = Math.round(
      documentMetrics.reduce((acc, d) => acc + d.completionRate, 0) / documentMetrics.length
    );

    const avgRequiredRate = Math.round(
      documentMetrics.reduce((acc, d) => acc + d.requiredRate, 0) / documentMetrics.length
    );

    const sortedByCompletion = [...documentMetrics].sort(
      (a, b) => b.completionRate - a.completionRate
    );
    const highestDoc = sortedByCompletion[0] || null;
    const lowestDoc = sortedByCompletion[sortedByCompletion.length - 1] || null;

    const fullFieldsCount = fieldMetrics.filter(f => f.completionRate === 100).length;

    return {
      mergedDocCount: documentMetrics.length,
      avgCompletionRate,
      avgRequiredRate,
      totalFields,
      totalFilled,
      totalEmpty,
      highestDoc,
      lowestDoc,
      fullFieldsCount,
    };
  }, [documentMetrics, fieldMetrics]);

  // Pie chart data for overall batch field fill status
  const pieDistributionData = useMemo(() => {
    return [
      {
        name: 'Populated Fields',
        value: batchKpis.totalFilled,
        color: '#10b981', // emerald-500
      },
      {
        name: 'Unfilled / Empty Fields',
        value: batchKpis.totalEmpty,
        color: '#334155', // slate-700
      },
    ];
  }, [batchKpis]);

  if (mergedDocuments.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <BarChart3 className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-200">
          No Merged Documents Available for Batch Analysis
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Upload or select at least one completed XFA PDF document to generate comparative field completion charts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Section Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400 shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100">
                Batch Analysis — Comparative Field Completion Summary
              </h2>
              <span className="text-[10px] px-2 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded-full font-mono">
                {batchKpis.mergedDocCount} Merged Document{batchKpis.mergedDocCount === 1 ? '' : 's'} Analyzed
              </span>
              {lastMergeResult && (
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full font-mono flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Synced with {lastMergeResult.filename}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
              Comparative visual analytics iterating across all merged XFA documents, measuring overall field completion rates, mandatory field readiness, and cross-batch schema population density.
            </p>
          </div>
        </div>

        {/* Chart Mode & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-1 flex items-center gap-1 text-xs">
            <button
              onClick={() => setChartViewMode('completion_rate')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                chartViewMode === 'completion_rate'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Completion Rates (%)
            </button>
            <button
              onClick={() => setChartViewMode('field_volume')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                chartViewMode === 'field_volume'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Filled vs Empty Volume
            </button>
            <button
              onClick={() => setChartViewMode('per_field')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                chartViewMode === 'per_field'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Per-Field Coverage
            </button>
          </div>

          {chartViewMode !== 'per_field' && (
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="bg-transparent text-slate-200 focus:outline-none text-xs cursor-pointer"
                title="Sort documents on chart X-axis"
              >
                <option value="merge_order" className="bg-slate-900">
                  Order: Merge Sequence
                </option>
                <option value="completion_desc" className="bg-slate-900">
                  Order: Highest Completion First
                </option>
                <option value="completion_asc" className="bg-slate-900">
                  Order: Lowest Completion First
                </option>
              </select>
            </div>
          )}

          {onExportMergedAnalytics && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onExportMergedAnalytics('csv')}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Aggregate field data from all merged XFA PDFs into a single CSV export for external analytics"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Merged CSV</span>
              </button>
              <button
                onClick={() => onExportMergedAnalytics('json')}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Aggregate field data from all merged XFA PDFs into a single JSON export for external analytics"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Export Merged JSON</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Scorecard Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Batch Average Completion */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Batch Avg Completion Rate
            </span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-3xl font-bold font-mono ${
                batchKpis.avgCompletionRate >= 85
                  ? 'text-emerald-400'
                  : batchKpis.avgCompletionRate >= 65
                  ? 'text-sky-400'
                  : 'text-amber-400'
              }`}
            >
              {batchKpis.avgCompletionRate}%
            </span>
            <span className="text-xs text-slate-400">
              across {batchKpis.mergedDocCount} docs
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-sky-400 h-full transition-all duration-500"
              style={{ width: `${batchKpis.avgCompletionRate}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Mandatory / Required Field Readiness */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Required Fields Completion
            </span>
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-emerald-400">
              {batchKpis.avgRequiredRate}%
            </span>
            <span className="text-xs text-slate-400">mandatory readiness</span>
          </div>
          <div className="text-[11px] text-emerald-400/80 font-medium mt-1">
            {batchKpis.fullFieldsCount} of {schema.length} schema fields 100% populated
          </div>
        </div>

        {/* KPI 3: Total Consolidated Field Population */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Populated vs Total Fields
            </span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-purple-400">
              {batchKpis.totalFilled}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              / {batchKpis.totalFields} fields ({batchKpis.totalEmpty} empty)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Unified across {subformMetrics.length} XFA subform container(s)
          </div>
        </div>

        {/* KPI 4: Highest & Lowest Completion Spread */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Batch Completion Spread
            </span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-1.5 space-y-1 text-xs">
            {batchKpis.highestDoc && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 truncate" title={batchKpis.highestDoc.filename}>
                  Best: <strong className="text-slate-200">{batchKpis.highestDoc.filename}</strong>
                </span>
                <span className="font-mono font-bold text-emerald-400 shrink-0">
                  {batchKpis.highestDoc.completionRate}%
                </span>
              </div>
            )}
            {batchKpis.lowestDoc && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 truncate" title={batchKpis.lowestDoc.filename}>
                  Lowest: <strong className="text-slate-200">{batchKpis.lowestDoc.filename}</strong>
                </span>
                <span className="font-mono font-bold text-amber-400 shrink-0">
                  {batchKpis.lowestDoc.completionRate}%
                </span>
              </div>
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Variance:{' '}
            {batchKpis.highestDoc && batchKpis.lowestDoc
              ? `${batchKpis.highestDoc.completionRate - batchKpis.lowestDoc.completionRate}% delta`
              : '0%'}
          </div>
        </div>
      </div>

      {/* Main Recharts Comparative Visualization Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left/Primary Chart Card (8 columns) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-400" />
                <span>
                  {chartViewMode === 'completion_rate'
                    ? 'Comparative Document Field Completion Rate (%)'
                    : chartViewMode === 'field_volume'
                    ? 'Populated vs. Unfilled Field Volume per Merged Document'
                    : 'Cross-Batch Schema Field Population Rate (%)'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {chartViewMode === 'completion_rate'
                  ? `Comparing overall field completion (%) and required field completion (%) across ${documentMetrics.length} merged document(s) against the ${batchKpis.avgCompletionRate}% batch mean.`
                  : chartViewMode === 'field_volume'
                  ? 'Stacked count of populated XFA fields versus empty/unfilled fields for each document in the merged package.'
                  : `Percentage of merged documents that contain a non-empty value for each of the ${fieldMetrics.length} discovered XFA schema fields.`}
              </p>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              {chartViewMode === 'completion_rate' && (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" />
                    Overall Completion %
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 inline-block" />
                    Required Fields %
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="w-full h-[320px] mt-1">
            {chartViewMode === 'completion_rate' && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={documentMetrics}
                  margin={{ top: 16, right: 24, left: 0, bottom: 28 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="shortLabel"
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      color: '#f1f5f9',
                      fontSize: '12px',
                    }}
                    formatter={(value, name) => [`${value}%`, String(name)]}
                    labelFormatter={(_, payload) => {
                      const item = payload?.[0]?.payload as DocumentCompletionMetric | undefined;
                      return item
                        ? `${item.filename} (${item.formTitle}) — ${item.filledFields}/${item.totalFields} fields`
                        : '';
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <ReferenceLine
                    y={batchKpis.avgCompletionRate}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{
                      value: `Batch Avg (${batchKpis.avgCompletionRate}%)`,
                      position: 'insideTopRight',
                      fill: '#fbbf24',
                      fontSize: 10,
                    }}
                  />
                  <Bar
                    dataKey="completionRate"
                    name="Overall Field Completion (%)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  >
                    {documentMetrics.map(entry => (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={
                          entry.completionRate >= 90
                            ? '#0ea5e9' // sky-500
                            : entry.completionRate >= 70
                            ? '#6366f1' // indigo-500
                            : '#f59e0b' // amber-500
                        }
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="requiredRate"
                    name="Required Fields Completion (%)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#10b981', strokeWidth: 1.5, stroke: '#064e3b' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {chartViewMode === 'field_volume' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={documentMetrics}
                  margin={{ top: 16, right: 24, left: 0, bottom: 28 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="shortLabel"
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      color: '#f1f5f9',
                      fontSize: '12px',
                    }}
                    labelFormatter={(_, payload) => {
                      const item = payload?.[0]?.payload as DocumentCompletionMetric | undefined;
                      return item
                        ? `${item.filename} — ${item.completionRate}% completed`
                        : '';
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar
                    dataKey="filledFields"
                    name="Populated Fields"
                    stackId="fields"
                    fill="#10b981"
                    radius={[0, 0, 4, 4]}
                    maxBarSize={48}
                  />
                  <Bar
                    dataKey="emptyFields"
                    name="Unfilled / Empty Fields"
                    stackId="fields"
                    fill="#475569"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartViewMode === 'per_field' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={fieldMetrics.slice(0, 14)}
                  layout="vertical"
                  margin={{ top: 8, right: 28, left: 16, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    unit="%"
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortLabel"
                    width={145}
                    stroke="#94a3b8"
                    tick={{ fill: '#cbd5e1', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      color: '#f1f5f9',
                      fontSize: '12px',
                    }}
                    formatter={(value, name, props) => {
                      const payload = props.payload as FieldBatchMetric;
                      return [
                        `${value}% (${payload.populatedDocs} of ${mergedDocuments.length} docs)`,
                        String(name),
                      ];
                    }}
                  />
                  <Bar
                    dataKey="completionRate"
                    name="Cross-Batch Field Fill Rate (%)"
                    radius={[0, 6, 6, 0]}
                    barSize={16}
                  >
                    {fieldMetrics.slice(0, 14).map(entry => (
                      <Cell
                        key={`field-cell-${entry.key}`}
                        fill={
                          entry.completionRate === 100
                            ? '#10b981'
                            : entry.completionRate >= 60
                            ? '#38bdf8'
                            : '#f59e0b'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Column (4 columns): Batch Field Distribution Pie + Subform Completion */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Consolidated Portfolio Field Ratio</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Aggregate breakdown of populated vs. empty fields and XFA subform completion across the merged batch.
            </p>
          </div>

          {/* Donut / Pie Chart */}
          <div className="w-full h-[175px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieDistributionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {pieDistributionData.map((entry, idx) => (
                    <Cell key={`pie-${idx}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.5rem',
                    color: '#f1f5f9',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label inside Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold font-mono text-emerald-400">
                {batchKpis.avgCompletionRate}%
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                Populated
              </span>
            </div>
          </div>

          {/* Subform Completion Breakdown List */}
          <div className="border-t border-slate-800 pt-3">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Subform Container Completion</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {subformMetrics.length} containers
              </span>
            </div>
            <div className="space-y-2 max-h-[125px] overflow-auto pr-1">
              {subformMetrics.slice(0, 5).map(sf => (
                <div key={sf.subform} className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-slate-300 truncate max-w-[160px]" title={sf.subform}>
                      &lt;{sf.subform}&gt;
                    </span>
                    <span className="font-mono text-[11px] text-sky-400">
                      {sf.filledFields}/{sf.totalFields} ({sf.completionRate}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${
                        sf.completionRate >= 85
                          ? 'bg-emerald-400'
                          : sf.completionRate >= 60
                          ? 'bg-sky-400'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${sf.completionRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Comparative Document Completion Table */}
      {!compact && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              <span className="font-semibold text-slate-200">
                Merged Document Field Completion Ledger
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">
                Document-by-document breakdown of populated fields, mandatory field readiness, and XFA structure
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-semibold w-14">#</th>
                  <th className="py-2.5 px-3 font-semibold">Document Filename</th>
                  <th className="py-2.5 px-3 font-semibold">Form Title</th>
                  <th className="py-2.5 px-3 font-semibold">XFA Architecture</th>
                  <th className="py-2.5 px-3 font-semibold">Populated / Total</th>
                  <th className="py-2.5 px-3 font-semibold min-w-[170px]">Overall Completion Rate</th>
                  <th className="py-2.5 px-3 font-semibold min-w-[160px]">Required Fields Rate</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  {onInspectDocument && (
                    <th className="py-2.5 px-3 font-semibold text-right">Inspect</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {documentMetrics.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      #{doc.orderIndex}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate max-w-[200px]" title={doc.filename}>
                          {doc.filename}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 truncate max-w-[180px]" title={doc.formTitle}>
                      {doc.formTitle}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                          doc.xfaType === 'Dynamic XFA'
                            ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                            : doc.xfaType === 'Static XFA'
                            ? 'bg-sky-950/60 text-sky-300 border-sky-800/60'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {doc.xfaType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      <span className="text-emerald-400 font-semibold">{doc.filledFields}</span>
                      <span className="text-slate-500"> / {doc.totalFields}</span>
                      {doc.emptyFields > 0 && (
                        <span className="text-[10px] text-slate-500 ml-1.5">
                          ({doc.emptyFields} empty)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${
                              doc.completionRate >= 90
                                ? 'bg-emerald-400'
                                : doc.completionRate >= 70
                                ? 'bg-sky-400'
                                : 'bg-amber-400'
                            }`}
                            style={{ width: `${doc.completionRate}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-200">
                          {doc.completionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${
                              doc.requiredRate === 100
                                ? 'bg-emerald-400'
                                : doc.requiredRate >= 75
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                            }`}
                            style={{ width: `${doc.requiredRate}%` }}
                          />
                        </div>
                        <span className="font-mono text-slate-300">
                          {doc.requiredRate}% ({doc.requiredFilled}/{doc.requiredTotal})
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {doc.completionRate >= 85 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          Partial ({doc.emptyFields} missing)
                        </span>
                      )}
                    </td>
                    {onInspectDocument && (
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onInspectDocument(doc.rawItem)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs rounded inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Fields</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
