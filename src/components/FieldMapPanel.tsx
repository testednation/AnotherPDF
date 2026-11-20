import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  GitBranch,
  Network,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Filter,
  Layers,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Info,
  Calendar,
  Hash,
  Mail,
  CheckCircle,
  AlertCircle,
  Lock,
  ExternalLink,
  Zap,
  Sliders,
  X,
  Share2,
  Compass,
  CornerDownRight,
  Activity,
  FileText,
  ShieldAlert,
  AlertTriangle,
  Tag,
  Plus,
  Check,
} from 'lucide-react';
import { XFASubform, XFAField } from '../types/pdf';
import {
  buildXfaDependencyGraph,
  traceUpstreamDependencies,
  traceDownstreamDependents,
  GraphFieldNode,
  GraphEdge,
  GraphSubformCluster,
  SubformDataFlow,
  DependencyType,
} from '../utils/xfaDependencyGraph';
import {
  CustomFieldRegexRule,
  evaluateCustomRegexRule,
} from '../utils/customValidationRules';
import { CustomValidationRulesPanel } from './CustomValidationRulesPanel';
import {
  FieldTagDefinition,
  FieldTagStore,
  TagColorKey,
  TagMatchMode,
  TAG_COLOR_KEYS,
  TAG_COLOR_PALETTE,
  EMPTY_FIELD_TAG_STORE,
  createTagId,
  getFieldTagDefinitions,
  getTagUsageCounts,
  matchesFieldTagFilter,
} from '../utils/fieldTags';
import { FieldTagManagerPanel } from './FieldTagManagerPanel';

interface FieldMapPanelProps {
  subforms: XFASubform[];
  allFields: XFAField[];
  templateXml?: string;
  customValidationRules?: Record<string, CustomFieldRegexRule>;
  onSaveCustomValidationRule?: (rule: CustomFieldRegexRule) => void;
  onDeleteCustomValidationRule?: (fieldId: string) => void;
  onToggleCustomValidationRule?: (fieldId: string, enabled: boolean) => void;
  fieldTagStore?: FieldTagStore;
  onCreateFieldTag?: (name: string, color: TagColorKey, description?: string) => FieldTagDefinition | null;
  onUpdateFieldTag?: (tagId: string, updates: { name?: string; color?: TagColorKey; description?: string }) => void;
  onDeleteFieldTag?: (tagId: string) => void;
  onToggleFieldTag?: (fieldId: string, tagId: string) => void;
  onBulkAssignFieldTag?: (fieldIds: string[], tagId: string) => void;
  onBulkRemoveFieldTag?: (fieldIds: string[], tagId: string) => void;
  onNavigateToField?: (fieldId: string) => void;
  onNavigateToFormEditor?: (fieldId: string) => void;
}

type ViewMode = 'graph' | 'flows' | 'tree' | 'tags' | 'validation';
type FilterMode = 'all' | 'calculated' | 'cross_subform' | 'inputs';

export const FieldMapPanel: React.FC<FieldMapPanelProps> = ({
  subforms,
  allFields,
  templateXml,
  customValidationRules = {},
  onSaveCustomValidationRule,
  onDeleteCustomValidationRule,
  onToggleCustomValidationRule,
  fieldTagStore,
  onCreateFieldTag,
  onUpdateFieldTag,
  onDeleteFieldTag,
  onToggleFieldTag,
  onBulkAssignFieldTag,
  onBulkRemoveFieldTag,
  onNavigateToField,
  onNavigateToFormEditor,
}) => {
  // Build dependency graph
  const graph = useMemo(() => {
    return buildXfaDependencyGraph(subforms, allFields, templateXml);
  }, [subforms, allFields, templateXml]);

  // Fallback internal tag store if parent doesn't supply controlled tag props
  const [localTagStore, setLocalTagStore] = useState<FieldTagStore>(EMPTY_FIELD_TAG_STORE);
  const activeTagStore = fieldTagStore ?? localTagStore;

  const handleCreateTag = (
    name: string,
    color: TagColorKey,
    description?: string
  ): FieldTagDefinition | null => {
    if (onCreateFieldTag) {
      return onCreateFieldTag(name, color, description);
    }
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = localTagStore.definitions.find(
      d => d.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return existing;
    const created: FieldTagDefinition = {
      id: createTagId(trimmed),
      name: trimmed,
      color,
      description,
      createdAt: new Date().toISOString(),
    };
    setLocalTagStore(prev => ({
      ...prev,
      definitions: [...prev.definitions, created],
    }));
    return created;
  };

  const handleUpdateTag = (
    tagId: string,
    updates: { name?: string; color?: TagColorKey; description?: string }
  ) => {
    if (onUpdateFieldTag) {
      onUpdateFieldTag(tagId, updates);
      return;
    }
    setLocalTagStore(prev => ({
      ...prev,
      definitions: prev.definitions.map(d =>
        d.id === tagId
          ? {
              ...d,
              name: updates.name !== undefined ? updates.name.trim() || d.name : d.name,
              color: updates.color ?? d.color,
              description: updates.description !== undefined ? updates.description : d.description,
            }
          : d
      ),
    }));
  };

  const handleDeleteTag = (tagId: string) => {
    setSelectedFilterTagIds(prev => prev.filter(id => id !== tagId));
    if (onDeleteFieldTag) {
      onDeleteFieldTag(tagId);
      return;
    }
    setLocalTagStore(prev => {
      const nextAssignments: Record<string, string[]> = {};
      Object.entries(prev.assignments).forEach(([fid, tids]) => {
        const filtered = tids.filter(id => id !== tagId);
        if (filtered.length > 0) nextAssignments[fid] = filtered;
      });
      return {
        definitions: prev.definitions.filter(d => d.id !== tagId),
        assignments: nextAssignments,
      };
    });
  };

  const handleToggleFieldTag = (fieldId: string, tagId: string) => {
    if (onToggleFieldTag) {
      onToggleFieldTag(fieldId, tagId);
      return;
    }
    setLocalTagStore(prev => {
      const current = prev.assignments[fieldId] || [];
      const nextList = current.includes(tagId)
        ? current.filter(id => id !== tagId)
        : [...current, tagId];
      const nextAssignments = { ...prev.assignments };
      if (nextList.length > 0) nextAssignments[fieldId] = nextList;
      else delete nextAssignments[fieldId];
      return { ...prev, assignments: nextAssignments };
    });
  };

  const handleBulkAssignTag = (fieldIds: string[], tagId: string) => {
    if (onBulkAssignFieldTag) {
      onBulkAssignFieldTag(fieldIds, tagId);
      return;
    }
    setLocalTagStore(prev => {
      const nextAssignments = { ...prev.assignments };
      fieldIds.forEach(fid => {
        const current = nextAssignments[fid] || [];
        if (!current.includes(tagId)) {
          nextAssignments[fid] = [...current, tagId];
        }
      });
      return { ...prev, assignments: nextAssignments };
    });
  };

  const handleBulkRemoveTag = (fieldIds: string[], tagId: string) => {
    if (onBulkRemoveFieldTag) {
      onBulkRemoveFieldTag(fieldIds, tagId);
      return;
    }
    setLocalTagStore(prev => {
      const nextAssignments = { ...prev.assignments };
      fieldIds.forEach(fid => {
        const current = nextAssignments[fid] || [];
        const filtered = current.filter(id => id !== tagId);
        if (filtered.length > 0) nextAssignments[fid] = filtered;
        else delete nextAssignments[fid];
      });
      return { ...prev, assignments: nextAssignments };
    });
  };

  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [validationTargetFieldId, setValidationTargetFieldId] = useState<string | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Custom Tag Filter state shared across Graph, Flows, Tree, and Tag Manager
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<TagMatchMode>('any');
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [inspectorTagInput, setInspectorTagInput] = useState('');

  // Keep selectedFilterTagIds pruned if a tag definition is removed externally
  useEffect(() => {
    const validIds = new Set(activeTagStore.definitions.map(d => d.id));
    setSelectedFilterTagIds(prev => {
      const next = prev.filter(id => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [activeTagStore.definitions]);

  const toggleFilterTag = (tagId: string) => {
    setUntaggedOnly(false);
    setSelectedFilterTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const toggleUntaggedOnly = () => {
    setUntaggedOnly(prev => {
      const next = !prev;
      if (next) setSelectedFilterTagIds([]);
      return next;
    });
  };

  const clearTagFilters = () => {
    setSelectedFilterTagIds([]);
    setUntaggedOnly(false);
  };

  const isTagFilterActive = untaggedOnly || selectedFilterTagIds.length > 0;

  const validGraphFieldIds = useMemo(() => new Set(graph.nodes.keys()), [graph]);
  const tagUsageCounts = useMemo(
    () => getTagUsageCounts(activeTagStore, validGraphFieldIds),
    [activeTagStore, validGraphFieldIds]
  );

  const customRulesCount = Object.keys(customValidationRules).length;
  const violatedCustomRulesCount = useMemo(() => {
    let count = 0;
    Object.values(customValidationRules).forEach(rule => {
      if (!rule.enabled) return;
      const field = allFields.find(f => f.id === rule.fieldId);
      const res = evaluateCustomRegexRule(rule, field?.value || '');
      if (res.status === 'violation') count++;
    });
    return count;
  }, [customValidationRules, allFields]);

  // Zoom & Pan state for SVG canvas
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Active Traced Dependencies
  const activeTrace = useMemo(() => {
    if (!selectedFieldId) return null;
    const upstream = traceUpstreamDependencies(graph, selectedFieldId);
    const downstream = traceDownstreamDependents(graph, selectedFieldId);

    return {
      selectedId: selectedFieldId,
      upstreamNodeIds: upstream.nodeIds,
      upstreamEdgeIds: upstream.edgeIds,
      downstreamNodeIds: downstream.nodeIds,
      downstreamEdgeIds: downstream.edgeIds,
      allConnectedNodeIds: new Set([...upstream.nodeIds, ...downstream.nodeIds]),
      allConnectedEdgeIds: new Set([...upstream.edgeIds, ...downstream.edgeIds]),
    };
  }, [graph, selectedFieldId]);

  // Selected Field Node Object
  const selectedNode = useMemo(() => {
    if (!selectedFieldId) return null;
    return graph.nodes.get(selectedFieldId) || null;
  }, [graph, selectedFieldId]);

  // Search matches (also matches custom tag names)
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const set = new Set<string>();
    graph.nodes.forEach(node => {
      const nodeTags = getFieldTagDefinitions(activeTagStore, node.id);
      if (
        node.name.toLowerCase().includes(q) ||
        node.caption.toLowerCase().includes(q) ||
        node.subformTitle.toLowerCase().includes(q) ||
        (node.value && node.value.toLowerCase().includes(q)) ||
        nodeTags.some(t => t.name.toLowerCase().includes(q))
      ) {
        set.add(node.id);
      }
    });
    return set;
  }, [graph, searchQuery, activeTagStore]);

  // Shared field visibility predicate (quick filter + custom tag filter)
  const isNodeVisibleInMap = (f: GraphFieldNode): boolean => {
    if (filterMode === 'calculated' && !f.isCalculated) return false;
    if (filterMode === 'cross_subform' && !f.isCrossSubformSource && !f.isCrossSubformTarget) return false;
    if (filterMode === 'inputs' && !(f.inDegree === 0 && f.outDegree > 0)) return false;
    if (
      !matchesFieldTagFilter(
        activeTagStore,
        f.id,
        selectedFilterTagIds,
        tagMatchMode,
        untaggedOnly
      )
    ) {
      return false;
    }
    return true;
  };

  // Filtered subforms for Outline Tree view (applies quick filter, custom tag filter, and search query)
  const filteredOutlineSubforms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return graph.subforms
      .map(sf => {
        const fields = sf.fields.filter(f => {
          if (!isNodeVisibleInMap(f)) return false;
          if (!q) return true;
          const nodeTags = getFieldTagDefinitions(activeTagStore, f.id);
          return (
            f.name.toLowerCase().includes(q) ||
            f.caption.toLowerCase().includes(q) ||
            sf.title.toLowerCase().includes(q) ||
            (f.value && f.value.toLowerCase().includes(q)) ||
            nodeTags.some(t => t.name.toLowerCase().includes(q))
          );
        });
        return { ...sf, fields };
      })
      .filter(sf => sf.fields.length > 0);
  }, [graph, filterMode, activeTagStore, selectedFilterTagIds, tagMatchMode, untaggedOnly, searchQuery]);

  // Filtered cross-subform flows when tag filter is active
  const filteredSubformFlows = useMemo(() => {
    if (!isTagFilterActive) return graph.subformFlows;
    return graph.subformFlows
      .map(flow => {
        const edges = flow.edges.filter(
          e =>
            matchesFieldTagFilter(activeTagStore, e.sourceFieldId, selectedFilterTagIds, tagMatchMode, untaggedOnly) ||
            matchesFieldTagFilter(activeTagStore, e.targetFieldId, selectedFilterTagIds, tagMatchMode, untaggedOnly)
        );
        return { ...flow, edges, fieldEdgeCount: edges.length };
      })
      .filter(flow => flow.edges.length > 0);
  }, [graph.subformFlows, isTagFilterActive, activeTagStore, selectedFilterTagIds, tagMatchMode, untaggedOnly]);

  // Layout computation: Arrange subforms in hierarchical columns / lanes
  const layout = useMemo(() => {
    const clusterWidth = 300;
    const nodeHeight = 60;
    const nodeSpacing = 10;
    const clusterSpacingX = 110;
    const clusterHeaderHeight = 64;

    // Pre-filter subforms when tag/quick filters hide all nodes in a subform
    const clustersWithVisible = graph.subforms
      .map(sf => ({
        sf,
        visibleFields: sf.fields.filter(isNodeVisibleInMap),
      }))
      .filter(item => !isTagFilterActive || item.visibleFields.length > 0);

    // Arrange clusters in columns (2-3 columns depending on count)
    const columns: typeof clustersWithVisible[] = [];
    const numCols = Math.min(3, Math.max(1, Math.ceil(clustersWithVisible.length / 2)));
    for (let c = 0; c < numCols; c++) {
      columns.push([]);
    }

    clustersWithVisible.forEach((item, idx) => {
      const colIdx = idx % numCols;
      columns[colIdx].push(item);
    });

    const positionedClusters: (GraphSubformCluster & {
      renderedNodes: (GraphFieldNode & { absX: number; absY: number })[];
    })[] = [];

    const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();

    columns.forEach((colClusters, colIdx) => {
      let currentY = 50;
      const currentX = 60 + colIdx * (clusterWidth + clusterSpacingX);

      colClusters.forEach(({ sf, visibleFields }) => {
        const clusterHeight = clusterHeaderHeight + Math.max(1, visibleFields.length) * (nodeHeight + nodeSpacing) + 20;

        const renderedNodes = visibleFields.map((f, fIdx) => {
          const absX = currentX + 16;
          const absY = currentY + clusterHeaderHeight + fIdx * (nodeHeight + nodeSpacing);
          const w = clusterWidth - 32;
          const h = nodeHeight;

          nodePositions.set(f.id, { x: absX, y: absY, width: w, height: h });

          return {
            ...f,
            absX,
            absY,
            width: w,
            height: h,
          };
        });

        positionedClusters.push({
          ...sf,
          x: currentX,
          y: currentY,
          width: clusterWidth,
          height: clusterHeight,
          renderedNodes,
        });

        currentY += clusterHeight + 40;
      });
    });

    // Compute bounding canvas box
    let maxX = 800;
    let maxY = 600;
    positionedClusters.forEach(c => {
      maxX = Math.max(maxX, c.x + c.width + 100);
      maxY = Math.max(maxY, c.y + c.height + 100);
    });

    return {
      clusters: positionedClusters,
      nodePositions,
      canvasWidth: maxX,
      canvasHeight: maxY,
    };
  }, [graph, filterMode, activeTagStore, selectedFilterTagIds, tagMatchMode, untaggedOnly, isTagFilterActive]);

  // Handle Pan & Zoom events
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(prev => Math.min(2.5, Math.max(0.35, prev * zoomFactor)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 40, y: 40 });
  };

  const fitToScreen = () => {
    if (!svgContainerRef.current) return;
    const rect = svgContainerRef.current.getBoundingClientRect();
    const scaleX = (rect.width - 80) / layout.canvasWidth;
    const scaleY = (rect.height - 80) / layout.canvasHeight;
    const newZoom = Math.min(1.2, Math.max(0.4, Math.min(scaleX, scaleY)));
    setZoom(newZoom);
    setPan({ x: 40, y: 40 });
  };

  // Upstream and downstream field objects for inspector
  const upstreamFields = useMemo(() => {
    if (!selectedFieldId) return [];
    const directSources: { field: GraphFieldNode; edge: GraphEdge }[] = [];
    graph.edges.forEach(edge => {
      if (edge.targetFieldId === selectedFieldId) {
        const srcNode = graph.nodes.get(edge.sourceFieldId);
        if (srcNode) directSources.push({ field: srcNode, edge });
      }
    });
    return directSources;
  }, [graph, selectedFieldId]);

  const downstreamFields = useMemo(() => {
    if (!selectedFieldId) return [];
    const directTargets: { field: GraphFieldNode; edge: GraphEdge }[] = [];
    graph.edges.forEach(edge => {
      if (edge.sourceFieldId === selectedFieldId) {
        const tgtNode = graph.nodes.get(edge.targetFieldId);
        if (tgtNode) directTargets.push({ field: tgtNode, edge });
      }
    });
    return directTargets;
  }, [graph, selectedFieldId]);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Top Controls Toolbar */}
      <div className="px-5 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100">XFA Field Map &amp; Dependency Graph</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                Data Flow Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Interactive structural map visualizing subform containment, calculation pipelines, and cross-subform data flows.
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'graph'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Hierarchical Graph</span>
            </button>
            <button
              onClick={() => setViewMode('flows')}
              className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'flows'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Subform Flows ({graph.subformFlows.length})</span>
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'tree'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Outline Tree</span>
            </button>
            <button
              onClick={() => setViewMode('tags')}
              className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'tags'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-sky-300/90 hover:text-sky-200 hover:bg-sky-950/40'
              }`}
              title="Apply custom tags to fields and filter the field list by tag"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Field Tags</span>
              {activeTagStore.definitions.length > 0 && (
                <span
                  className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-full ${
                    isTagFilterActive
                      ? 'bg-sky-400 text-slate-950 font-bold'
                      : viewMode === 'tags'
                      ? 'bg-white/20 text-white'
                      : 'bg-sky-500/20 text-sky-300'
                  }`}
                >
                  {activeTagStore.definitions.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('validation')}
              className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'validation'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-300/90 hover:text-amber-200 hover:bg-amber-950/40'
              }`}
              title="Define custom regex validation rules for XFA fields"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Validation Rules</span>
              {customRulesCount > 0 && (
                <span
                  className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-full ${
                    violatedCustomRulesCount > 0
                      ? 'bg-rose-500 text-white'
                      : viewMode === 'validation'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {customRulesCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Metric Strip */}
      <div className="px-5 py-2 bg-slate-900/60 border-b border-slate-800/80 space-y-2 text-xs shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Metric Summary */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
              <strong className="text-white">{graph.subforms.length}</strong> Subforms
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
              <strong className="text-white">{graph.nodes.size}</strong> Total Fields
            </span>
            <span className="px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-800/60 text-amber-300">
              <strong className="text-amber-200">{graph.totalCalculatedFields}</strong> Calculated (fx)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-sky-950/60 border border-sky-800/60 text-sky-300">
              <strong className="text-sky-200">{graph.totalCrossSubformEdges}</strong> Cross-Subform Flows
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
              Max Depth: <strong className="text-slate-200">{graph.maxDependencyDepth}</strong>
            </span>
          </div>

          {/* Filter and Search Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Filter */}
            <div className="flex items-center gap-1 text-[11px]">
              <Filter className="w-3 h-3 text-slate-500" />
              {(['all', 'calculated', 'cross_subform', 'inputs'] as FilterMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`px-2 py-0.5 rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filterMode === mode
                      ? 'bg-slate-800 text-sky-300 border-sky-700 font-medium'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {mode === 'all'
                    ? 'All'
                    : mode === 'calculated'
                    ? 'Calculated Only'
                    : mode === 'cross_subform'
                    ? 'Cross-Subform'
                    : 'Root Inputs'}
                </button>
              ))}
            </div>

            {/* Search Field */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search field, subform, or tag..."
                className="w-48 bg-slate-950 border border-slate-800 rounded-md pl-8 pr-6 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Clear Trace Button */}
            {selectedFieldId && (
              <button
                onClick={() => setSelectedFieldId(null)}
                className="px-2.5 py-1 text-xs rounded-md bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Clear highlighted dependency path"
              >
                <X className="w-3 h-3" />
                <span>Clear Trace</span>
              </button>
            )}
          </div>
        </div>

        {/* Custom Tag Filter Bar (visible whenever tags exist, or quick CTA to add tags) */}
        {viewMode !== 'validation' && viewMode !== 'tags' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-800/70 text-[11px]">
            <span className="text-slate-400 flex items-center gap-1 mr-1 shrink-0">
              <Tag className="w-3 h-3 text-sky-400" />
              <span>Filter by tag:</span>
            </span>

            {activeTagStore.definitions.length === 0 ? (
              <button
                type="button"
                onClick={() => setViewMode('tags')}
                className="px-2 py-0.5 rounded border border-slate-800 hover:border-sky-600/70 bg-slate-950 text-slate-300 hover:text-sky-200 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3 h-3 text-sky-400" />
                <span>Create custom tags to filter fields</span>
              </button>
            ) : (
              <>
                {activeTagStore.definitions.map(tag => {
                  const style = TAG_COLOR_PALETTE[tag.color] || TAG_COLOR_PALETTE.sky;
                  const active = !untaggedOnly && selectedFilterTagIds.includes(tag.id);
                  const count = tagUsageCounts[tag.id] || 0;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleFilterTag(tag.id)}
                      className={`px-2 py-0.5 rounded border font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                        active ? style.activeBtnClass : style.inactiveBtnClass
                      }`}
                      title={`Toggle filter for tag "${tag.name}" (${count} fields)`}
                    >
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{ backgroundColor: style.hex }}
                      />
                      <span>{tag.name}</span>
                      <span className="text-[10px] font-mono opacity-75">{count}</span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={toggleUntaggedOnly}
                  className={`px-2 py-0.5 rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    untaggedOnly
                      ? 'bg-slate-800 border-sky-500 text-sky-300 font-medium'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Untagged
                </button>

                {selectedFilterTagIds.length > 1 && !untaggedOnly && (
                  <button
                    type="button"
                    onClick={() => setTagMatchMode(prev => (prev === 'any' ? 'all' : 'any'))}
                    className="px-2 py-0.5 rounded border border-indigo-800 bg-indigo-950/60 text-indigo-300 hover:text-indigo-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    title="Switch between matching any selected tag or all selected tags"
                  >
                    Mode: {tagMatchMode === 'any' ? 'Any' : 'All'}
                  </button>
                )}

                {isTagFilterActive && (
                  <button
                    type="button"
                    onClick={clearTagFilters}
                    className="px-2 py-0.5 rounded text-slate-400 hover:text-rose-300 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear tags</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setViewMode('tags')}
                  className="ml-auto px-2 py-0.5 rounded text-sky-400 hover:text-sky-300 hover:bg-slate-800/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Manage tags →
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* VIEW 1: INTERACTIVE HIERARCHICAL GRAPH CANVAS */}
        {viewMode === 'graph' && (
          <div
            ref={svgContainerRef}
            className="flex-1 relative overflow-hidden bg-slate-950 cursor-grab active:cursor-grabbing select-none"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {/* Canvas floating zoom/pan controls */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1 shadow-lg backdrop-blur-md">
              <button
                onClick={() => setZoom(prev => Math.min(2.5, prev * 1.2))}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(prev => Math.max(0.35, prev / 1.2))}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={resetView}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={fitToScreen}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800"
                title="Fit to Screen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-mono text-slate-400 px-2 border-l border-slate-800">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Tracing Banner */}
            {selectedNode && (
              <div className="absolute top-4 right-4 z-10 max-w-md bg-slate-900/95 border border-indigo-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
                    <span className="text-xs font-bold text-sky-300">Tracing Data Flow:</span>
                  </div>
                  <button
                    onClick={() => setSelectedFieldId(null)}
                    className="p-0.5 text-slate-400 hover:text-slate-200 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-xs text-slate-200 font-semibold mb-1">
                  {selectedNode.caption || selectedNode.name}
                </div>
                <div className="text-[11px] text-slate-400 space-y-1">
                  <p>
                    <span className="text-emerald-400 font-medium">
                      {(activeTrace?.upstreamNodeIds.size || 1) - 1} Upstream Inputs
                    </span>{' '}
                    feed into this field.
                  </p>
                  <p>
                    <span className="text-amber-400 font-medium">
                      {(activeTrace?.downstreamNodeIds.size || 1) - 1} Downstream Dependents
                    </span>{' '}
                    recalculate when this field changes.
                  </p>
                </div>
              </div>
            )}

            {/* SVG Rendered Graph */}
            <svg
              className="w-full h-full"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                transition: isPanning ? 'none' : 'transform 0.05s ease-out',
              }}
            >
              <defs>
                {/* Arrow markers */}
                <marker
                  id="arrow-calc"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
                </marker>
                <marker
                  id="arrow-cross"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
                </marker>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#10b981" />
                </marker>
                <marker
                  id="arrow-downstream"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
                </marker>
                <marker
                  id="arrow-dimmed"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#334155" />
                </marker>
              </defs>

              {/* Subform Cluster Background Bounding Boxes */}
              {layout.clusters.map(cluster => {
                const isClusterHighlighted =
                  activeTrace &&
                  cluster.renderedNodes.some(n => activeTrace.allConnectedNodeIds.has(n.id));

                return (
                  <g key={`cluster-${cluster.id}`} className="transition-all duration-200">
                    {/* Bounding box */}
                    <rect
                      x={cluster.x}
                      y={cluster.y}
                      width={cluster.width}
                      height={cluster.height}
                      rx={14}
                      fill="#0f172a"
                      fillOpacity={0.85}
                      stroke={isClusterHighlighted ? cluster.color : '#1e293b'}
                      strokeWidth={isClusterHighlighted ? 2 : 1}
                      strokeDasharray={isClusterHighlighted ? 'none' : '4 2'}
                    />

                    {/* Cluster Header */}
                    <rect
                      x={cluster.x}
                      y={cluster.y}
                      width={cluster.width}
                      height={50}
                      rx={14}
                      fill="#1e293b"
                      fillOpacity={0.7}
                    />

                    {/* Subform Title and Badges */}
                    <text
                      x={cluster.x + 16}
                      y={cluster.y + 26}
                      fill="#f8fafc"
                      fontSize="13"
                      fontWeight="bold"
                      fontFamily="system-ui"
                    >
                      {cluster.title.length > 24 ? `${cluster.title.slice(0, 22)}...` : cluster.title}
                    </text>
                    <text
                      x={cluster.x + 16}
                      y={cluster.y + 42}
                      fill="#94a3b8"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      subform: {cluster.name} • {cluster.fields.length} fields
                    </text>

                    {/* Incoming / Outgoing Cross-Subform indicators */}
                    {cluster.incomingCrossSubformCount > 0 && (
                      <g>
                        <rect
                          x={cluster.x + cluster.width - 92}
                          y={cluster.y + 12}
                          width={38}
                          height={16}
                          rx={4}
                          fill="#082f49"
                          stroke="#0284c7"
                          strokeWidth={1}
                        />
                        <text
                          x={cluster.x + cluster.width - 73}
                          y={cluster.y + 24}
                          fill="#7dd3fc"
                          fontSize="9"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          ↓{cluster.incomingCrossSubformCount} in
                        </text>
                      </g>
                    )}

                    {cluster.outgoingCrossSubformCount > 0 && (
                      <g>
                        <rect
                          x={cluster.x + cluster.width - 48}
                          y={cluster.y + 12}
                          width={40}
                          height={16}
                          rx={4}
                          fill="#14532d"
                          stroke="#16a34a"
                          strokeWidth={1}
                        />
                        <text
                          x={cluster.x + cluster.width - 28}
                          y={cluster.y + 24}
                          fill="#86efac"
                          fontSize="9"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          ↑{cluster.outgoingCrossSubformCount} out
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Dependency Connector Edges */}
              {graph.edges.map(edge => {
                const srcPos = layout.nodePositions.get(edge.sourceFieldId);
                const tgtPos = layout.nodePositions.get(edge.targetFieldId);
                if (!srcPos || !tgtPos) return null;

                const isUpstreamEdge = activeTrace?.upstreamEdgeIds.has(edge.id);
                const isDownstreamEdge = activeTrace?.downstreamEdgeIds.has(edge.id);
                const isActiveEdge = isUpstreamEdge || isDownstreamEdge;
                const isHovered = hoveredEdgeId === edge.id;
                const isDimmed = activeTrace && !isActiveEdge;

                // Bezier connector coordinates
                // From right of source to left of target (or bottom to top if same subform)
                const isSameSubform = edge.sourceSubformId === edge.targetSubformId;
                let startX = srcPos.x + srcPos.width;
                let startY = srcPos.y + srcPos.height / 2;
                let endX = tgtPos.x;
                let endY = tgtPos.y + tgtPos.height / 2;

                if (isSameSubform && Math.abs(srcPos.x - tgtPos.x) < 20) {
                  // Internal column loop curve
                  startX = srcPos.x + srcPos.width;
                  endX = tgtPos.x + tgtPos.width;
                  const curveOffset = 30 + Math.abs(startY - endY) * 0.15;
                  const d = `M ${startX} ${startY} C ${startX + curveOffset} ${startY}, ${endX + curveOffset} ${endY}, ${endX} ${endY}`;

                  return (
                    <g
                      key={`edge-${edge.id}`}
                      onMouseEnter={() => setHoveredEdgeId(edge.id)}
                      onMouseLeave={() => setHoveredEdgeId(null)}
                      className="cursor-pointer"
                    >
                      <path
                        d={d}
                        fill="none"
                        stroke={
                          isActiveEdge
                            ? isUpstreamEdge
                              ? '#10b981'
                              : '#f59e0b'
                            : isDimmed
                            ? '#1e293b'
                            : '#f59e0b'
                        }
                        strokeWidth={isActiveEdge ? 2.5 : isHovered ? 2.5 : 1.5}
                        strokeDasharray={edge.isCrossSubform ? '5 3' : 'none'}
                        markerEnd={
                          isActiveEdge
                            ? isUpstreamEdge
                              ? 'url(#arrow-active)'
                              : 'url(#arrow-downstream)'
                            : isDimmed
                            ? 'url(#arrow-dimmed)'
                            : 'url(#arrow-calc)'
                        }
                        opacity={isDimmed ? 0.2 : 0.85}
                      />
                    </g>
                  );
                }

                // Cross-subform or multi-column connector
                const deltaX = Math.abs(endX - startX);
                const controlX1 = startX + deltaX * 0.45;
                const controlX2 = endX - deltaX * 0.45;
                const pathD = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`;

                return (
                  <g
                    key={`edge-${edge.id}`}
                    onMouseEnter={() => setHoveredEdgeId(edge.id)}
                    onMouseLeave={() => setHoveredEdgeId(null)}
                    className="cursor-pointer"
                  >
                    {/* Wider transparent hit-test line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                    />
                    <path
                      d={pathD}
                      fill="none"
                      stroke={
                        isActiveEdge
                          ? isUpstreamEdge
                            ? '#10b981'
                            : '#f59e0b'
                          : isDimmed
                          ? '#1e293b'
                          : edge.isCrossSubform
                          ? '#38bdf8'
                          : '#f59e0b'
                      }
                      strokeWidth={isActiveEdge ? 3 : isHovered ? 2.5 : 1.5}
                      strokeDasharray={edge.isCrossSubform ? '6 4' : 'none'}
                      markerEnd={
                        isActiveEdge
                          ? isUpstreamEdge
                            ? 'url(#arrow-active)'
                            : 'url(#arrow-downstream)'
                          : isDimmed
                          ? 'url(#arrow-dimmed)'
                          : edge.isCrossSubform
                          ? 'url(#arrow-cross)'
                          : 'url(#arrow-calc)'
                      }
                      opacity={isDimmed ? 0.15 : 0.9}
                      className={isActiveEdge ? 'animate-pulse' : ''}
                    />
                  </g>
                );
              })}

              {/* Field Nodes within Subforms */}
              {layout.clusters.flatMap(cluster =>
                cluster.renderedNodes.map(node => {
                  const isSelected = selectedFieldId === node.id;
                  const isUpstream = activeTrace?.upstreamNodeIds.has(node.id) && !isSelected;
                  const isDownstream = activeTrace?.downstreamNodeIds.has(node.id) && !isSelected;
                  const isDimmed = activeTrace && !isSelected && !isUpstream && !isDownstream;
                  const isSearchMatch = searchMatches.has(node.id);

                  let borderColor = '#334155';
                  let bgColor = '#1e293b';

                  if (isSelected) {
                    borderColor = '#38bdf8';
                    bgColor = '#0369a1';
                  } else if (isUpstream) {
                    borderColor = '#10b981';
                    bgColor = '#064e3b';
                  } else if (isDownstream) {
                    borderColor = '#f59e0b';
                    bgColor = '#78350f';
                  } else if (isSearchMatch) {
                    borderColor = '#eab308';
                    bgColor = '#713f12';
                  }

                  return (
                    <g
                      key={`node-${node.id}`}
                      transform={`translate(${node.absX}, ${node.absY})`}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedFieldId(prev => (prev === node.id ? null : node.id));
                      }}
                      onMouseEnter={() => setHoveredFieldId(node.id)}
                      onMouseLeave={() => setHoveredFieldId(null)}
                      className="cursor-pointer transition-all duration-150"
                      opacity={isDimmed ? 0.35 : 1}
                    >
                      {/* Node container card */}
                      <rect
                        width={node.width}
                        height={node.height}
                        rx={8}
                        fill={bgColor}
                        stroke={borderColor}
                        strokeWidth={isSelected ? 2.5 : isUpstream || isDownstream ? 2 : 1}
                        className="transition-colors"
                      />

                      {/* Left accent color strip */}
                      <rect
                        x={0}
                        y={0}
                        width={4}
                        height={node.height}
                        rx={2}
                        fill={
                          isSelected
                            ? '#38bdf8'
                            : isUpstream
                            ? '#10b981'
                            : isDownstream
                            ? '#f59e0b'
                            : node.isCalculated
                            ? '#f59e0b'
                            : node.isCrossSubformSource || node.isCrossSubformTarget
                            ? '#38bdf8'
                            : cluster.color
                        }
                      />

                      {/* Field Type Badge / Icon indicator */}
                      <circle
                        cx={18}
                        cy={20}
                        r={7}
                        fill={node.isCalculated ? '#78350f' : '#0f172a'}
                        stroke={node.isCalculated ? '#f59e0b' : '#475569'}
                        strokeWidth={1}
                      />
                      <text
                        x={18}
                        y={23}
                        fill={node.isCalculated ? '#fbbf24' : '#94a3b8'}
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {node.isCalculated ? 'fx' : node.type.charAt(0).toUpperCase()}
                      </text>

                      {/* Field Caption / Title */}
                      <text
                        x={32}
                        y={21}
                        fill={isSelected ? '#ffffff' : '#f1f5f9'}
                        fontSize="11"
                        fontWeight="600"
                        fontFamily="system-ui"
                      >
                        {node.caption.length > 25 ? `${node.caption.slice(0, 23)}...` : node.caption}
                      </text>

                      {/* Field Variable Name */}
                      <text
                        x={32}
                        y={34}
                        fill="#94a3b8"
                        fontSize="9"
                        fontFamily="monospace"
                      >
                        {node.name.length > 28 ? `${node.name.slice(0, 26)}...` : node.name}
                      </text>

                      {/* Current Value Preview */}
                      <text
                        x={32}
                        y={47}
                        fill={node.value ? '#38bdf8' : '#64748b'}
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight={node.value ? 'bold' : 'normal'}
                      >
                        {node.value
                          ? `= ${node.value.length > 22 ? `${node.value.slice(0, 20)}...` : node.value}`
                          : '(empty)'}
                      </text>

                      {/* Connection In/Out Counters */}
                      {(node.inDegree > 0 || node.outDegree > 0) && (
                        <g>
                          <rect
                            x={node.width - 56}
                            y={10}
                            width={48}
                            height={16}
                            rx={4}
                            fill="#020617"
                            stroke="#334155"
                            strokeWidth={0.8}
                          />
                          <text
                            x={node.width - 32}
                            y={21}
                            fill="#cbd5e1"
                            fontSize="8.5"
                            fontFamily="monospace"
                            textAnchor="middle"
                          >
                            in:{node.inDegree} out:{node.outDegree}
                          </text>
                        </g>
                      )}

                      {/* Custom Tag Indicators on SVG Node */}
                      {(() => {
                        const nodeTags = getFieldTagDefinitions(activeTagStore, node.id);
                        if (nodeTags.length === 0) return null;
                        const firstTag = nodeTags[0];
                        const firstColor = (TAG_COLOR_PALETTE[firstTag.color] || TAG_COLOR_PALETTE.sky).hex;
                        const labelText =
                          nodeTags.length > 1
                            ? `${firstTag.name.slice(0, 10)}${firstTag.name.length > 10 ? '…' : ''} +${nodeTags.length - 1}`
                            : firstTag.name.slice(0, 13) + (firstTag.name.length > 13 ? '…' : '');
                        return (
                          <g>
                            <rect
                              x={node.width - 84}
                              y={37}
                              width={76}
                              height={16}
                              rx={4}
                              fill="#020617"
                              stroke={firstColor}
                              strokeOpacity={0.7}
                              strokeWidth={0.9}
                            />
                            <circle cx={node.width - 77} cy={45} r={2.5} fill={firstColor} />
                            <text
                              x={node.width - 71}
                              y={48}
                              fill="#e2e8f0"
                              fontSize="8"
                              fontFamily="system-ui"
                            >
                              {labelText}
                            </text>
                          </g>
                        );
                      })()}
                    </g>
                  );
                })
              )}
            </svg>

            {/* Empty Filter State Overlay for Graph */}
            {layout.clusters.length === 0 && isTagFilterActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto bg-slate-900/95 border border-slate-800 rounded-xl px-6 py-5 text-center max-w-sm space-y-2 shadow-xl">
                  <Tag className="w-5 h-5 text-sky-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-100">No tagged fields match</p>
                  <p className="text-xs text-slate-400">
                    No fields in the dependency graph match the active tag filter.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={clearTagFilters}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg transition-colors cursor-pointer"
                    >
                      Clear Tag Filter
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('tags')}
                      className="px-3 py-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      Manage Tags
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: SUBFORM FLOW MATRIX / SANKEY TABLE */}
        {viewMode === 'flows' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-slate-950">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                <span>Inter-Subform Cross-Flow Matrix</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Traces high-level data transitions between distinct XFA subform containers (e.g. Applicant Profile feeding Financial Statements and Sign-offs).
              </p>
            </div>

            {filteredSubformFlows.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                <p className="text-sm text-slate-400">
                  {isTagFilterActive
                    ? 'No cross-subform data flows involve fields matching the active tag filter.'
                    : 'No cross-subform data flows detected.'}
                </p>
                {isTagFilterActive && (
                  <button
                    type="button"
                    onClick={clearTagFilters}
                    className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg transition-colors cursor-pointer"
                  >
                    Clear Tag Filter
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredSubformFlows.map(flow => (
                  <div
                    key={flow.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-sky-500/50 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                        <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                          {flow.sourceSubformTitle}
                        </span>
                        <ArrowRight className="w-4 h-4 text-sky-400 shrink-0" />
                        <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                          {flow.targetSubformTitle}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {flow.fieldEdgeCount} {flow.fieldEdgeCount === 1 ? 'connection' : 'connections'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-slate-400">Flowing Data Dependencies:</div>
                      {flow.edges.map(e => (
                        <div
                          key={e.id}
                          onClick={() => {
                            setSelectedFieldId(e.sourceFieldId);
                            setViewMode('graph');
                          }}
                          className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-sky-500/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sky-300">{e.sourceFieldName}</span>
                              <ArrowRight className="w-3 h-3 text-slate-500" />
                              <span className="font-semibold text-indigo-300">{e.targetFieldName}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{e.description}</p>
                          </div>
                          {e.formulaSnippet && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
                              {e.formulaSnippet}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: OUTLINE TREE VIEW */}
        {viewMode === 'tree' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-950">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Hierarchical Subform &amp; Field List</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Select any field to inspect dependencies and apply custom tags, or filter by tags above to focus on specific sections.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono tabular-nums text-slate-400">
                  {filteredOutlineSubforms.reduce((acc, s) => acc + s.fields.length, 0)} of {graph.nodes.size} fields
                </span>
                <button
                  type="button"
                  onClick={() => setViewMode('tags')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Bulk Tag Fields</span>
                </button>
              </div>
            </div>

            {filteredOutlineSubforms.length === 0 ? (
              <div className="py-12 px-6 text-center bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                <Filter className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-sm font-medium text-slate-300">No fields match your current filters</p>
                <p className="text-xs text-slate-500">
                  Adjust your tag filter, field type filter, or search query to see fields.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('all');
                    setSearchQuery('');
                    clearTagFilters();
                  }}
                  className="mt-1 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg transition-colors cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOutlineSubforms.map(sf => (
                  <div key={sf.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: sf.color }} />
                        <span className="text-xs font-bold text-slate-200">{sf.title}</span>
                        <span className="text-[11px] font-mono text-slate-400">({sf.name})</span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-400">{sf.fields.length} fields</span>
                    </div>

                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {sf.fields.map(node => {
                        const nodeTags = getFieldTagDefinitions(activeTagStore, node.id);
                        return (
                          <div
                            key={node.id}
                            onClick={() => setSelectedFieldId(node.id)}
                            className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                              selectedFieldId === node.id
                                ? 'bg-sky-950/60 border-sky-400 ring-1 ring-sky-500'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-semibold text-slate-200 truncate">{node.caption}</span>
                              {node.isCalculated && (
                                <span className="text-[10px] font-mono px-1 rounded bg-amber-950 text-amber-300 border border-amber-800 shrink-0">
                                  fx
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 truncate">{node.name}</div>
                            {nodeTags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px]">
                                {nodeTags.map((t, idx) => {
                                  const style = TAG_COLOR_PALETTE[t.color] || TAG_COLOR_PALETTE.sky;
                                  return (
                                    <span key={t.id} className="inline-flex items-center gap-1 text-slate-300">
                                      <span
                                        className="w-1.5 h-1.5 rounded-xs shrink-0"
                                        style={{ backgroundColor: style.hex }}
                                      />
                                      <span className="truncate max-w-[96px]">{t.name}</span>
                                      {idx < nodeTags.length - 1 && (
                                        <span aria-hidden="true" className="text-slate-600 ml-0.5">·</span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500 mt-1.5 pt-1 border-t border-slate-900">
                              <span>in: {node.inDegree} / out: {node.outDegree}</span>
                              <span className="text-sky-400 truncate max-w-[110px]">{node.value || '(empty)'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: CUSTOM FIELD TAGS MANAGER */}
        {viewMode === 'tags' && (
          <FieldTagManagerPanel
            subforms={subforms}
            allFields={allFields}
            tagStore={activeTagStore}
            activeFilterTagIds={selectedFilterTagIds}
            tagMatchMode={tagMatchMode}
            untaggedOnly={untaggedOnly}
            onToggleFilterTag={toggleFilterTag}
            onSetTagMatchMode={setTagMatchMode}
            onToggleUntaggedOnly={toggleUntaggedOnly}
            onClearTagFilters={clearTagFilters}
            onCreateTag={handleCreateTag}
            onUpdateTag={handleUpdateTag}
            onDeleteTag={handleDeleteTag}
            onToggleFieldTag={handleToggleFieldTag}
            onBulkAssignTag={handleBulkAssignTag}
            onBulkRemoveTag={handleBulkRemoveTag}
            onInspectInGraph={fieldId => {
              setSelectedFieldId(fieldId);
              setViewMode('graph');
            }}
            onNavigateToField={onNavigateToField}
            onNavigateToFormEditor={onNavigateToFormEditor}
          />
        )}

        {/* VIEW 5: CUSTOM REGEX VALIDATION RULES PANEL */}
        {viewMode === 'validation' && (
          <CustomValidationRulesPanel
            subforms={subforms}
            allFields={allFields}
            customRules={customValidationRules}
            initialFieldId={validationTargetFieldId || selectedFieldId}
            onSaveRule={rule => onSaveCustomValidationRule?.(rule)}
            onDeleteRule={fieldId => onDeleteCustomValidationRule?.(fieldId)}
            onToggleRuleEnabled={(fieldId, enabled) =>
              onToggleCustomValidationRule?.(fieldId, enabled)
            }
            onNavigateToField={onNavigateToField}
            onNavigateToFormEditor={onNavigateToFormEditor}
          />
        )}

        {/* RIGHT INSPECTOR DRAWER */}
        {selectedNode && viewMode !== 'validation' && viewMode !== 'tags' && (
          <div className="w-80 md:w-96 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-30 shadow-2xl animate-in slide-in-from-right-4 duration-150">
            {/* Inspector Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-slate-100">Field Dependency Inspector</h3>
              </div>
              <button
                onClick={() => setSelectedFieldId(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inspector Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Field Identity */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                    {selectedNode.type.toUpperCase()}
                  </span>
                  {selectedNode.isCalculated && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                      Calculated (fx)
                    </span>
                  )}
                </div>
                <div className="font-bold text-sm text-slate-100">{selectedNode.caption}</div>
                <div className="text-[11px] font-mono text-slate-400">var: {selectedNode.name}</div>
                <div className="text-[11px] text-slate-400">
                  Subform: <strong className="text-slate-200">{selectedNode.subformTitle}</strong>
                </div>
                <div className="pt-1.5 border-t border-slate-900 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-500">Current Value:</span>
                  <span className="font-bold text-sky-300">{selectedNode.value || '(empty)'}</span>
                </div>
              </div>

              {/* Calculation Formula / Rule */}
              {selectedNode.calculationFormula && (
                <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-3 space-y-1">
                  <div className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span>Calculation Logic / Formula</span>
                  </div>
                  <p className="text-xs font-mono text-amber-200 bg-black/40 p-2 rounded border border-amber-900/50">
                    {selectedNode.calculationFormula}
                  </p>
                </div>
              )}

              {/* Upstream Sources (Inputs to this field) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Upstream Inputs ({upstreamFields.length})</span>
                  </span>
                </div>

                {upstreamFields.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/60">
                    No upstream calculation inputs. This is a primary root data entry field.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {upstreamFields.map(({ field, edge }) => (
                      <div
                        key={field.id}
                        onClick={() => setSelectedFieldId(field.id)}
                        className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-emerald-900/60 hover:border-emerald-600 cursor-pointer transition-all space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200 truncate">{field.caption}</span>
                          <span className="text-[10px] font-mono text-emerald-400">Select →</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{edge.description}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {field.subformTitle} • {field.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Downstream Dependents (Impacted targets) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Downstream Dependents ({downstreamFields.length})</span>
                  </span>
                </div>

                {downstreamFields.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/60">
                    No downstream dependent fields. Changes to this value do not trigger cascade recalculations.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {downstreamFields.map(({ field, edge }) => (
                      <div
                        key={field.id}
                        onClick={() => setSelectedFieldId(field.id)}
                        className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-amber-900/60 hover:border-amber-600 cursor-pointer transition-all space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200 truncate">{field.caption}</span>
                          <span className="text-[10px] font-mono text-amber-400">Select →</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{edge.description}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {field.subformTitle} • {field.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Tags Section */}
              {(() => {
                const assignedTags = getFieldTagDefinitions(activeTagStore, selectedNode.id);
                const assignedTagIds = new Set(assignedTags.map(t => t.id));
                const handleAddInspectorTag = () => {
                  const trimmed = inspectorTagInput.trim();
                  if (!trimmed) return;
                  const existing = activeTagStore.definitions.find(
                    d => d.name.toLowerCase() === trimmed.toLowerCase()
                  );
                  if (existing) {
                    if (!assignedTagIds.has(existing.id)) {
                      handleToggleFieldTag(selectedNode.id, existing.id);
                    }
                  } else {
                    const color =
                      TAG_COLOR_KEYS[activeTagStore.definitions.length % TAG_COLOR_KEYS.length];
                    const created = handleCreateTag(trimmed, color);
                    if (created) {
                      handleToggleFieldTag(selectedNode.id, created.id);
                    }
                  }
                  setInspectorTagInput('');
                };

                return (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-sky-300 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        <span>Custom Tags</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewMode('tags')}
                        className="text-[10px] text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
                      >
                        Manage all
                      </button>
                    </div>

                    {assignedTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {assignedTags.map(tag => {
                          const style = TAG_COLOR_PALETTE[tag.color] || TAG_COLOR_PALETTE.sky;
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => handleToggleFieldTag(selectedNode.id, tag.id)}
                              className={`px-2 py-0.5 rounded border text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${style.chipClass}`}
                              title={`Remove "${tag.name}" from this field`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-xs shrink-0"
                                style={{ backgroundColor: style.hex }}
                              />
                              <span>{tag.name}</span>
                              <X className="w-2.5 h-2.5 opacity-75" />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        No tags applied to this field yet.
                      </p>
                    )}

                    {/* Available Existing Tags to Toggle */}
                    {activeTagStore.definitions.filter(d => !assignedTagIds.has(d.id)).length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-900">
                        {activeTagStore.definitions
                          .filter(d => !assignedTagIds.has(d.id))
                          .map(tag => {
                            const style = TAG_COLOR_PALETTE[tag.color] || TAG_COLOR_PALETTE.sky;
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => handleToggleFieldTag(selectedNode.id, tag.id)}
                                className="px-1.5 py-0.5 rounded border border-slate-800 hover:border-slate-600 bg-slate-900 text-[10px] text-slate-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                                title={`Apply "${tag.name}"`}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-xs shrink-0"
                                  style={{ backgroundColor: style.hex }}
                                />
                                <span>{tag.name}</span>
                                <Plus className="w-2.5 h-2.5 text-slate-500" />
                              </button>
                            );
                          })}
                      </div>
                    )}

                    {/* Quick Create & Apply Input */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        value={inspectorTagInput}
                        onChange={e => setInspectorTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddInspectorTag();
                          }
                        }}
                        placeholder="New or existing tag..."
                        className="flex-1 min-w-0 bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-md px-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddInspectorTag}
                        disabled={!inspectorTagInput.trim()}
                        className="px-2 py-1 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Custom Regex Validation Rule Card */}
              {(() => {
                const activeRule = customValidationRules[selectedNode.id];
                const evalRes = evaluateCustomRegexRule(activeRule, selectedNode.value || '');
                return (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        <span>Custom Regex Rule</span>
                      </span>
                      {activeRule ? (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                            evalRes.status === 'violation'
                              ? 'bg-amber-950 text-amber-300 border border-amber-700'
                              : evalRes.status === 'pass'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {evalRes.status === 'violation'
                            ? 'Violation'
                            : evalRes.status === 'pass'
                            ? 'Passing'
                            : activeRule.enabled
                            ? 'Active'
                            : 'Paused'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">None</span>
                      )}
                    </div>

                    {activeRule && (
                      <div className="space-y-1">
                        <div className="font-mono text-[11px] text-sky-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 break-all">
                          /{activeRule.pattern}/{activeRule.flags}
                        </div>
                        {evalRes.status === 'violation' && (
                          <div className="text-[10px] text-amber-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{evalRes.message}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setValidationTargetFieldId(selectedNode.id);
                        setViewMode('validation');
                      }}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border border-amber-700/60 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      <span>{activeRule ? 'Edit Custom Regex Rule' : 'Define Custom Regex Rule'}</span>
                    </button>
                  </div>
                );
              })()}

              {/* Action Buttons: Navigate to Graph, Editor or Canvas */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                {viewMode === 'tree' && (
                  <button
                    type="button"
                    onClick={() => setViewMode('graph')}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                  >
                    <Network className="w-3.5 h-3.5 text-sky-400" />
                    <span>Focus in Dependency Graph</span>
                  </button>
                )}
                {onNavigateToFormEditor && (
                  <button
                    onClick={() => onNavigateToFormEditor(selectedNode.id)}
                    className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Edit in Visual Form Editor</span>
                  </button>
                )}
                {onNavigateToField && (
                  <button
                    onClick={() => onNavigateToField(selectedNode.id)}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Locate on PDF Canvas</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
