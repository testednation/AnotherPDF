import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FolderTree,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  Search,
  X,
  Type,
  AlignLeft,
  CheckSquare,
  ListFilter,
  Hash,
  Calendar,
  PenTool,
  HelpCircle,
  CheckCircle2,
  Filter,
  Layers,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { XFASubform, XFAField } from '../types/pdf';

interface QuickNavTreeProps {
  subforms?: XFASubform[];
  fields: XFAField[];
  selectedFieldId: string | null;
  onSelectField: (field: XFAField) => void;
  currentPage: number;
  onClose?: () => void;
}

export const QuickNavTree: React.FC<QuickNavTreeProps> = ({
  subforms = [],
  fields = [],
  selectedFieldId,
  onSelectField,
  currentPage,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [filterType, setFilterType] = useState<string>('all');
  const [onlyCurrentPage, setOnlyCurrentPage] = useState<boolean>(false);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Normalize / fallback structure if subforms array is empty or fields are unassigned
  const structuredHierarchy = useMemo<XFASubform[]>(() => {
    // If subforms provided and has at least one subform with fields or subforms
    const hasValidSubforms =
      subforms.length > 0 &&
      subforms.some(sf => (sf.fields && sf.fields.length > 0) || (sf.subforms && sf.subforms.length > 0));

    if (hasValidSubforms) {
      return subforms;
    }

    // Fallback: Group fields by parentSubform or by page
    const grouped: Record<string, XFAField[]> = {};
    fields.forEach(field => {
      const groupName =
        field.parentSubform && field.parentSubform.trim() !== ''
          ? field.parentSubform
          : `Page ${field.bounds?.pageNumber || 1} Form Fields`;
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(field);
    });

    return Object.entries(grouped).map(([name, groupFields], idx) => ({
      id: `generated-subform-${idx}`,
      name: name,
      title: name,
      fields: groupFields,
      subforms: [],
      pageNumber: groupFields[0]?.bounds?.pageNumber || 1,
    }));
  }, [subforms, fields]);

  // Expand / collapse all subforms
  const toggleNode = (nodeId: string) => {
    setCollapsedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const expandAll = () => {
    setCollapsedNodes({});
  };

  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    const collectIds = (nodes: XFASubform[]) => {
      nodes.forEach(node => {
        allCollapsed[node.id] = true;
        if (node.subforms && node.subforms.length > 0) {
          collectIds(node.subforms);
        }
      });
    };
    collectIds(structuredHierarchy);
    setCollapsedNodes(allCollapsed);
  };

  // Auto-scroll to selected field item if in view
  useEffect(() => {
    if (selectedFieldId && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedFieldId]);

  // Helper for field icon
  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'multiline':
        return <AlignLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case 'numeric':
        return <Hash className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'choice':
        return <ListFilter className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case 'check':
        return <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'date':
        return <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'signature':
        return <PenTool className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  // Filter evaluation
  const queryLower = searchQuery.toLowerCase().trim();

  const isFieldMatching = (field: XFAField): boolean => {
    if (filterType !== 'all' && field.type !== filterType) {
      return false;
    }
    if (onlyCurrentPage && (field.bounds?.pageNumber || 1) !== currentPage) {
      return false;
    }
    if (!queryLower) return true;

    return (
      field.name.toLowerCase().includes(queryLower) ||
      field.caption.toLowerCase().includes(queryLower) ||
      (field.value ? field.value.toLowerCase().includes(queryLower) : false) ||
      (field.dataRef ? field.dataRef.toLowerCase().includes(queryLower) : false) ||
      (field.parentSubform ? field.parentSubform.toLowerCase().includes(queryLower) : false)
    );
  };

  // Filter subforms recursively
  const filterSubform = (node: XFASubform): XFASubform | null => {
    const matchingFields = node.fields ? node.fields.filter(isFieldMatching) : [];
    const matchingChildren: XFASubform[] = [];

    if (node.subforms && node.subforms.length > 0) {
      node.subforms.forEach(child => {
        const filteredChild = filterSubform(child);
        if (filteredChild) matchingChildren.push(filteredChild);
      });
    }

    const subformMatchesQuery =
      queryLower.length > 0 &&
      (node.name.toLowerCase().includes(queryLower) || node.title.toLowerCase().includes(queryLower));

    if (matchingFields.length > 0 || matchingChildren.length > 0 || subformMatchesQuery) {
      return {
        ...node,
        fields: matchingFields.length > 0 ? matchingFields : (subformMatchesQuery ? node.fields : []),
        subforms: matchingChildren,
      };
    }

    return null;
  };

  const filteredTree = useMemo(() => {
    if (!queryLower && filterType === 'all' && !onlyCurrentPage) {
      return structuredHierarchy;
    }
    return structuredHierarchy
      .map(node => filterSubform(node))
      .filter((n): n is XFASubform => n !== null);
  }, [structuredHierarchy, queryLower, filterType, onlyCurrentPage]);

  // Count total matching fields
  const totalMatchingFields = useMemo(() => {
    let count = 0;
    const countFields = (nodes: XFASubform[]) => {
      nodes.forEach(n => {
        count += n.fields.length;
        if (n.subforms.length > 0) countFields(n.subforms);
      });
    };
    countFields(filteredTree);
    return count;
  }, [filteredTree]);

  // Recursive Tree Node Renderer
  const renderSubformNode = (node: XFASubform, depth = 0) => {
    const isCollapsed = collapsedNodes[node.id] ?? false;
    const hasChildren = (node.subforms && node.subforms.length > 0) || (node.fields && node.fields.length > 0);
    const totalFieldsInNode =
      node.fields.length +
      (node.subforms?.reduce((acc, c) => acc + (c.fields?.length || 0), 0) || 0);

    return (
      <div key={node.id} className="select-none text-xs">
        {/* Subform Row Header */}
        <div
          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-slate-800/70 transition-colors cursor-pointer group ${
            depth > 0 ? 'ml-3 border-l border-slate-800/80 pl-2' : ''
          }`}
          onClick={() => toggleNode(node.id)}
        >
          {hasChildren ? (
            <button
              type="button"
              className="p-0.5 text-slate-400 group-hover:text-slate-200 transition-transform"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {isCollapsed ? (
            <Folder className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
          ) : (
            <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          )}

          <span
            className="font-medium text-slate-200 truncate flex-1 group-hover:text-sky-300 transition-colors"
            title={`${node.title || node.name} (${node.name})`}
          >
            {node.title || node.name}
          </span>

          {node.pageNumber && (
            <span className="text-[10px] px-1 py-0.2 bg-slate-800 text-slate-400 rounded font-mono shrink-0">
              P.{node.pageNumber}
            </span>
          )}

          <span className="text-[10px] px-1.5 py-0.2 bg-slate-800/90 text-slate-400 rounded-full font-mono shrink-0">
            {totalFieldsInNode}
          </span>
        </div>

        {/* Subform Children & Fields (if not collapsed) */}
        {!isCollapsed && (
          <div className="mt-0.5 space-y-0.5">
            {/* Child Subforms */}
            {node.subforms &&
              node.subforms.map(child => renderSubformNode(child, depth + 1))}

            {/* Subform Fields */}
            {node.fields && node.fields.length > 0 && (
              <div className={`space-y-0.5 ${depth > 0 ? 'ml-4 border-l border-slate-800/80 pl-2' : 'ml-3'}`}>
                {node.fields.map(field => {
                  const isSelected = field.id === selectedFieldId;
                  const fieldPage = field.bounds?.pageNumber || 1;
                  const isCurrentPageField = fieldPage === currentPage;
                  const hasValue = field.value && field.value.trim().length > 0;

                  return (
                    <button
                      key={field.id}
                      ref={isSelected ? selectedItemRef : undefined}
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectField(field);
                      }}
                      className={`w-full text-left py-1.5 px-2 rounded-lg transition-all flex items-center gap-2 group cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/20 border border-sky-500/50 text-white shadow-xs'
                          : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                      }`}
                      title={`Jump to ${field.caption || field.name} (Page ${fieldPage}, ${field.type})`}
                    >
                      {/* Field Type Icon */}
                      <span className="shrink-0">{getFieldIcon(field.type)}</span>

                      {/* Field Name & Caption */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`truncate text-xs ${
                              isSelected ? 'font-semibold text-white' : 'font-medium text-slate-200 group-hover:text-sky-300'
                            }`}
                          >
                            {field.caption || field.name}
                          </span>
                          {field.required && (
                            <span className="text-rose-400 font-bold text-xs" title="Required field">
                              *
                            </span>
                          )}
                        </div>

                        {/* Subtext info */}
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono truncate">
                          <span className="truncate">{field.name}</span>
                          {hasValue && (
                            <span className="text-emerald-400/90 truncate flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate max-w-[80px]">{field.value}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Page Tag */}
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono shrink-0 transition-colors ${
                          isCurrentPageField
                            ? 'bg-sky-900/60 text-sky-300 border border-sky-700/60'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                        title={`Located on Page ${fieldPage}`}
                      >
                        P.{fieldPage}
                      </span>

                      {/* Jump arrow indicator on hover or selected */}
                      <ArrowRight
                        className={`w-3 h-3 shrink-0 transition-opacity ${
                          isSelected
                            ? 'text-sky-400 opacity-100'
                            : 'text-slate-500 opacity-0 group-hover:opacity-100'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-200 select-none overflow-hidden">
      {/* Top Header Bar */}
      <div className="px-3 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-sky-500/10 border border-sky-500/30 rounded-md text-sky-400 shrink-0">
            <FolderTree className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
              <span>Quick Navigation</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded font-mono">
                {fields.length}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 truncate">Subform & field tree</p>
          </div>
        </div>

        {/* Tree Actions: Expand/Collapse All and Close */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={expandAll}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Expand All Subforms"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Collapse All Subforms"
          >
            <ChevronsDownUp className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded transition-colors ml-1"
              title="Close Quick Navigation"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-2.5 bg-slate-950/60 border-b border-slate-800/80 space-y-2 shrink-0">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search subforms or fields..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-md pl-8 pr-7 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filters Row: Field Type & Current Page Only */}
        <div className="flex items-center justify-between gap-1 text-[11px]">
          <div className="flex items-center gap-1 min-w-0">
            <Filter className="w-3 h-3 text-slate-500 shrink-0" />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="text">Text</option>
              <option value="check">Checkbox</option>
              <option value="choice">Dropdown</option>
              <option value="numeric">Numeric</option>
              <option value="date">Date</option>
              <option value="signature">Signature</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 select-none shrink-0">
            <input
              type="checkbox"
              checked={onlyCurrentPage}
              onChange={e => setOnlyCurrentPage(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 w-3 h-3 cursor-pointer"
            />
            <span>Page {currentPage} only</span>
          </label>
        </div>
      </div>

      {/* Main Hierarchical Tree View Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredTree.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <Search className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-400">No matching fields found</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Try adjusting your search query or type filter
            </p>
            {(searchQuery || filterType !== 'all' || onlyCurrentPage) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setOnlyCurrentPage(false);
                }}
                className="mt-3 px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-sky-400 rounded transition-colors"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          filteredTree.map(subform => renderSubformNode(subform))
        )}
      </div>

      {/* Bottom Summary Footer */}
      <div className="px-3 py-2 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <span className="truncate">
          {totalMatchingFields} of {fields.length} fields
        </span>
        {selectedFieldId && (
          <span className="text-[10px] text-sky-400 font-mono flex items-center gap-1 shrink-0">
            <Eye className="w-3 h-3" />
            Selected
          </span>
        )}
      </div>
    </div>
  );
};
