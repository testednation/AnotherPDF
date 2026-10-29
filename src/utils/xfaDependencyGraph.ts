import { XFASubform, XFAField } from '../types/pdf';

export type DependencyType =
  | 'calculation'
  | 'cross_subform_flow'
  | 'validation_constraint'
  | 'attestation'
  | 'hierarchy';

export interface GraphFieldNode {
  id: string;
  field: XFAField;
  name: string;
  caption: string;
  subformId: string;
  subformName: string;
  subformTitle: string;
  type: XFAField['type'];
  value: string;
  isCalculated: boolean;
  calculationFormula?: string;
  isCrossSubformTarget: boolean;
  isCrossSubformSource: boolean;
  inDegree: number;
  outDegree: number;
  // Layout coordinates
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphEdge {
  id: string;
  sourceFieldId: string;
  targetFieldId: string;
  sourceFieldName: string;
  targetFieldName: string;
  sourceSubformId: string;
  targetSubformId: string;
  sourceSubformName: string;
  targetSubformName: string;
  type: DependencyType;
  description: string;
  formulaSnippet?: string;
  isCrossSubform: boolean;
}

export interface GraphSubformCluster {
  id: string;
  name: string;
  title: string;
  fields: GraphFieldNode[];
  childSubforms: GraphSubformCluster[];
  parentSubformId?: string;
  incomingCrossSubformCount: number;
  outgoingCrossSubformCount: number;
  // Layout coordinates
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface SubformDataFlow {
  id: string;
  sourceSubformId: string;
  sourceSubformTitle: string;
  targetSubformId: string;
  targetSubformTitle: string;
  fieldEdgeCount: number;
  edges: GraphEdge[];
  flowSummary: string;
}

export interface XfaDependencyGraph {
  nodes: Map<string, GraphFieldNode>;
  edges: GraphEdge[];
  subforms: GraphSubformCluster[];
  subformFlows: SubformDataFlow[];
  totalCalculatedFields: number;
  totalCrossSubformEdges: number;
  totalDirectEdges: number;
  maxDependencyDepth: number;
}

const SUBFORM_COLORS = [
  '#0284c7', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];

/**
 * Parses calculation scripts and extracts field names
 * Handles FormCalc functions like Sum(), Avg(), Min(), Max()
 * and arithmetic expressions: "totalRevenues - totalExpenditures"
 */
function extractReferencedFieldNames(
  scriptExpr: string,
  fieldNamesSet: Set<string>
): { referencedNames: string[]; formulaDesc: string } {
  const referenced: string[] = [];
  const cleanScript = scriptExpr.replace(/[\r\n]+/g, ' ').trim();

  // 1. Check for Sum(field1, field2, ...)
  const sumMatch = cleanScript.match(/Sum\s*\(([^)]+)\)/i);
  if (sumMatch) {
    const args = sumMatch[1].split(',').map(s => s.trim().replace(/^.*[./]/, ''));
    args.forEach(arg => {
      if (fieldNamesSet.has(arg)) {
        referenced.push(arg);
      }
    });
    return {
      referencedNames: Array.from(new Set(referenced)),
      formulaDesc: `Sum(${referenced.join(', ')})`,
    };
  }

  // 2. Tokenize words and match against known field names
  const tokens = cleanScript.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  tokens.forEach(tok => {
    if (fieldNamesSet.has(tok)) {
      referenced.push(tok);
    }
  });

  const uniqueRefs = Array.from(new Set(referenced));
  return {
    referencedNames: uniqueRefs,
    formulaDesc: cleanScript.length > 50 ? `${cleanScript.slice(0, 47)}...` : cleanScript,
  };
}

/**
 * Analyzes XFA subforms, fields, and template XML to extract
 * complete hierarchical dependencies and cross-subform data flows.
 */
export function buildXfaDependencyGraph(
  subforms: XFASubform[],
  allFields: XFAField[],
  rawTemplateXml?: string
): XfaDependencyGraph {
  const fieldByName = new Map<string, XFAField>();
  const fieldById = new Map<string, XFAField>();
  const fieldNamesSet = new Set<string>();

  allFields.forEach(f => {
    fieldByName.set(f.name, f);
    fieldById.set(f.id, f);
    fieldNamesSet.add(f.name);
  });

  // Track parent subform mapping
  const fieldSubformMap = new Map<string, { id: string; name: string; title: string }>();
  const subformOrder: { id: string; name: string; title: string; fields: XFAField[] }[] = [];

  const traverseSubforms = (list: XFASubform[]) => {
    list.forEach(sf => {
      subformOrder.push({ id: sf.id, name: sf.name, title: sf.title, fields: sf.fields });
      sf.fields.forEach(f => {
        fieldSubformMap.set(f.id, { id: sf.id, name: sf.name, title: sf.title });
      });
      if (sf.subforms && sf.subforms.length > 0) {
        traverseSubforms(sf.subforms);
      }
    });
  };
  traverseSubforms(subforms);

  // Initialize nodes map
  const nodes = new Map<string, GraphFieldNode>();
  allFields.forEach(f => {
    const sfInfo = fieldSubformMap.get(f.id) || {
      id: f.parentSubform || 'root',
      name: f.parentSubform || 'root',
      title: f.parentSubform || 'Form',
    };

    nodes.set(f.id, {
      id: f.id,
      field: f,
      name: f.name,
      caption: f.caption || f.name,
      subformId: sfInfo.id,
      subformName: sfInfo.name,
      subformTitle: sfInfo.title,
      type: f.type,
      value: f.value || '',
      isCalculated: false,
      isCrossSubformSource: false,
      isCrossSubformTarget: false,
      inDegree: 0,
      outDegree: 0,
      x: 0,
      y: 0,
      width: 220,
      height: 54,
    });
  });

  const edges: GraphEdge[] = [];
  const edgeKeySet = new Set<string>();

  const addEdge = (
    sourceId: string,
    targetId: string,
    type: DependencyType,
    description: string,
    formulaSnippet?: string
  ) => {
    if (sourceId === targetId) return; // avoid trivial self loops
    const edgeKey = `${sourceId}->${targetId}`;
    if (edgeKeySet.has(edgeKey)) return;
    edgeKeySet.add(edgeKey);

    const sourceField = fieldById.get(sourceId);
    const targetField = fieldById.get(targetId);
    if (!sourceField || !targetField) return;

    const sourceSf = fieldSubformMap.get(sourceId) || { id: 'root', name: 'root', title: 'Root' };
    const targetSf = fieldSubformMap.get(targetId) || { id: 'root', name: 'root', title: 'Root' };
    const isCrossSubform = sourceSf.id !== targetSf.id;

    edges.push({
      id: edgeKey,
      sourceFieldId: sourceId,
      targetFieldId: targetId,
      sourceFieldName: sourceField.name,
      targetFieldName: targetField.name,
      sourceSubformId: sourceSf.id,
      targetSubformId: targetSf.id,
      sourceSubformName: sourceSf.name,
      targetSubformName: targetSf.title,
      type: isCrossSubform ? 'cross_subform_flow' : type,
      description,
      formulaSnippet,
      isCrossSubform,
    });

    const sourceNode = nodes.get(sourceId);
    const targetNode = nodes.get(targetId);
    if (sourceNode) {
      sourceNode.outDegree++;
      if (isCrossSubform) sourceNode.isCrossSubformSource = true;
    }
    if (targetNode) {
      targetNode.inDegree++;
      targetNode.isCalculated = true;
      if (formulaSnippet) targetNode.calculationFormula = formulaSnippet;
      if (isCrossSubform) targetNode.isCrossSubformTarget = true;
    }
  };

  // 1. Detect explicit script expressions in validation or XML
  allFields.forEach(targetField => {
    const scriptExpr = targetField.validation?.scriptExpr;
    const rawSnippet = targetField.rawXmlSnippet || '';

    // Check scriptExpr
    if (scriptExpr) {
      const { referencedNames, formulaDesc } = extractReferencedFieldNames(scriptExpr, fieldNamesSet);
      referencedNames.forEach(srcName => {
        const srcField = fieldByName.get(srcName);
        if (srcField) {
          addEdge(
            srcField.id,
            targetField.id,
            'calculation',
            `Calculates ${targetField.caption || targetField.name} via script`,
            formulaDesc
          );
        }
      });
    }

    // Check rawXmlSnippet for <calculate> or <script>
    if (rawSnippet.includes('<calculate') || rawSnippet.includes('<script')) {
      const calcMatch = rawSnippet.match(/<calculate[\s\S]*?<\/calculate>/i);
      if (calcMatch) {
        const { referencedNames, formulaDesc } = extractReferencedFieldNames(calcMatch[0], fieldNamesSet);
        referencedNames.forEach(srcName => {
          const srcField = fieldByName.get(srcName);
          if (srcField) {
            addEdge(
              srcField.id,
              targetField.id,
              'calculation',
              `FormCalc Expression: ${formulaDesc}`,
              formulaDesc
            );
          }
        });
      }
    }
  });

  // 2. Detect well-known semantic calculations & subform financial aggregations
  subformOrder.forEach(sf => {
    const sfFields = sf.fields;

    // A. Revenue sum: totalActualRevenues or totalRevenues
    const totalRevField = sfFields.find(
      f =>
        f.name.toLowerCase().includes('totalactualrevenue') ||
        f.name.toLowerCase() === 'totalrevenue' ||
        f.name.toLowerCase() === 'totalrevenues' ||
        (f.name.toLowerCase().includes('revenue') && f.name.toLowerCase().includes('total'))
    );
    if (totalRevField) {
      const revLineItems = sfFields.filter(f => f.id !== totalRevField.id && (f.type === 'numeric' || !f.name.toLowerCase().includes('total')));
      revLineItems.forEach(lineItem => {
        addEdge(
          lineItem.id,
          totalRevField.id,
          'calculation',
          `Revenues line item feeds grand total: ${totalRevField.caption}`,
          `Sum(${sf.name})`
        );
      });
    }

    // B. Expenditure sum: totalActualExpenditures or totalExpenses
    const totalExpField = sfFields.find(
      f =>
        f.name.toLowerCase().includes('totalactualexpenditure') ||
        f.name.toLowerCase() === 'totalexpenditures' ||
        f.name.toLowerCase() === 'totalexpenses' ||
        (f.name.toLowerCase().includes('expenditure') && f.name.toLowerCase().includes('total'))
    );
    if (totalExpField) {
      const expLineItems = sfFields.filter(f => f.id !== totalExpField.id && (f.type === 'numeric' || !f.name.toLowerCase().includes('total')));
      expLineItems.forEach(lineItem => {
        addEdge(
          lineItem.id,
          totalExpField.id,
          'calculation',
          `Expenditure item feeds grand total: ${totalExpField.caption}`,
          `Sum(${sf.name})`
        );
      });
    }
  });

  // 3. Cross-Subform Data Flow: Revenues + Expenditures -> Net Variance / Financial Balance
  const revTotal = allFields.find(
    f =>
      f.name.toLowerCase().includes('totalactualrevenue') ||
      f.name.toLowerCase().includes('totalrevenue')
  );
  const expTotal = allFields.find(
    f =>
      f.name.toLowerCase().includes('totalactualexpenditure') ||
      f.name.toLowerCase().includes('totalexpenditure') ||
      f.name.toLowerCase().includes('totalexpense')
  );
  const netVarianceField = allFields.find(
    f =>
      f.name.toLowerCase().includes('netvariance') ||
      f.name.toLowerCase().includes('netbalance') ||
      f.name.toLowerCase().includes('varianceamount') ||
      f.name.toLowerCase().includes('variance_amount')
  );

  if (revTotal && netVarianceField) {
    addEdge(
      revTotal.id,
      netVarianceField.id,
      'cross_subform_flow',
      'Total Revenues feeds Net Financial Balance / Reconciliation',
      'Net Balance = Total Revenues - Total Expenditures'
    );
  }
  if (expTotal && netVarianceField) {
    addEdge(
      expTotal.id,
      netVarianceField.id,
      'cross_subform_flow',
      'Total Expenditures deducts from Net Financial Balance',
      'Net Balance = Total Revenues - Total Expenditures'
    );
  }

  // 4. Net Variance -> Variance Explanations justification constraint
  const varianceNotesField = allFields.find(
    f =>
      f.name.toLowerCase().includes('varianceexplanation') ||
      f.name.toLowerCase().includes('variancenote') ||
      f.name.toLowerCase().includes('auditdeclarationnote')
  );
  if (netVarianceField && varianceNotesField) {
    addEdge(
      netVarianceField.id,
      varianceNotesField.id,
      'validation_constraint',
      'Budget variance requires explanatory notes if variance exceeds threshold',
      'Required if |Variance| > 10%'
    );
  }

  // 5. Cross-Subform Attestation: Contact Officer -> Authorized Signatory Legal Attestation
  const contactNameField = allFields.find(
    f =>
      f.name.toLowerCase().includes('contactofficername') ||
      f.name.toLowerCase().includes('primarycontactname') ||
      f.name.toLowerCase().includes('authorizedcontact')
  );
  const signatoryNameField = allFields.find(
    f =>
      f.name.toLowerCase().includes('authorizedsignatoryname') ||
      f.name.toLowerCase().includes('officersignature') ||
      f.name.toLowerCase().includes('authorizedofficersignature')
  );
  if (contactNameField && signatoryNameField && contactNameField.id !== signatoryNameField.id) {
    addEdge(
      contactNameField.id,
      signatoryNameField.id,
      'attestation',
      'Primary contact binds and validates official authorized signatory block',
      'Signatory = Authorized Contact'
    );
  }

  // 6. Chronological Date Flow: Start Date -> End Date -> Certification Date
  const startDateField = allFields.find(
    f => f.name.toLowerCase().includes('periodstart') || f.name.toLowerCase().includes('startdate')
  );
  const endDateField = allFields.find(
    f => f.name.toLowerCase().includes('periodend') || f.name.toLowerCase().includes('enddate')
  );
  const signDateField = allFields.find(
    f => f.name.toLowerCase().includes('signaturedate') || f.name.toLowerCase().includes('signdate')
  );

  if (startDateField && endDateField) {
    addEdge(
      startDateField.id,
      endDateField.id,
      'validation_constraint',
      'Project completion date must occur after commencement date',
      'Period End >= Period Start'
    );
  }
  if (endDateField && signDateField) {
    addEdge(
      endDateField.id,
      signDateField.id,
      'validation_constraint',
      'Report sign-off occurs after period conclusion',
      'Sign Date >= Period End'
    );
  }

  // 7. Aggregation of Inter-Subform Data Flows
  const subformFlowMap = new Map<string, SubformDataFlow>();

  edges.forEach(edge => {
    if (edge.isCrossSubform) {
      const flowKey = `${edge.sourceSubformId}->${edge.targetSubformId}`;
      let flow = subformFlowMap.get(flowKey);
      if (!flow) {
        flow = {
          id: flowKey,
          sourceSubformId: edge.sourceSubformId,
          sourceSubformTitle: edge.sourceSubformName,
          targetSubformId: edge.targetSubformId,
          targetSubformTitle: edge.targetSubformName,
          fieldEdgeCount: 0,
          edges: [],
          flowSummary: '',
        };
        subformFlowMap.set(flowKey, flow);
      }
      flow.fieldEdgeCount++;
      flow.edges.push(edge);
    }
  });

  const subformFlows = Array.from(subformFlowMap.values()).map(flow => {
    const descriptions = flow.edges.map(e => `${e.sourceFieldName} → ${e.targetFieldName}`).slice(0, 3);
    flow.flowSummary = `${flow.fieldEdgeCount} cross-subform data flow ${
      flow.fieldEdgeCount === 1 ? 'connection' : 'connections'
    } (${descriptions.join(', ')}${flow.fieldEdgeCount > 3 ? '...' : ''})`;
    return flow;
  });

  // 8. Build Subform Clusters for visual graph layout
  const subformClusters: GraphSubformCluster[] = subformOrder.map((sf, idx) => {
    const sfNodes = sf.fields
      .map(f => nodes.get(f.id))
      .filter((n): n is GraphFieldNode => Boolean(n));

    let incomingCross = 0;
    let outgoingCross = 0;

    edges.forEach(edge => {
      if (edge.isCrossSubform) {
        if (edge.targetSubformId === sf.id) incomingCross++;
        if (edge.sourceSubformId === sf.id) outgoingCross++;
      }
    });

    return {
      id: sf.id,
      name: sf.name,
      title: sf.title,
      fields: sfNodes,
      childSubforms: [],
      incomingCrossSubformCount: incomingCross,
      outgoingCrossSubformCount: outgoingCross,
      x: 0,
      y: 0,
      width: 280,
      height: 60 + sfNodes.length * 62,
      color: SUBFORM_COLORS[idx % SUBFORM_COLORS.length],
    };
  });

  // Calculate maximum dependency chain depth
  let maxDepth = 0;
  nodes.forEach(node => {
    const visited = new Set<string>();
    const getDepth = (currentId: string): number => {
      if (visited.has(currentId)) return 0;
      visited.add(currentId);
      let d = 0;
      edges
        .filter(e => e.sourceFieldId === currentId)
        .forEach(e => {
          d = Math.max(d, 1 + getDepth(e.targetFieldId));
        });
      return d;
    };
    maxDepth = Math.max(maxDepth, getDepth(node.id));
  });

  const totalCalculated = Array.from(nodes.values()).filter(n => n.isCalculated).length;
  const totalCross = edges.filter(e => e.isCrossSubform).length;

  return {
    nodes,
    edges,
    subforms: subformClusters,
    subformFlows,
    totalCalculatedFields: totalCalculated,
    totalCrossSubformEdges: totalCross,
    totalDirectEdges: edges.length,
    maxDependencyDepth: maxDepth,
  };
}

/**
 * Traces all upstream dependencies (sources that feed into a target field)
 */
export function traceUpstreamDependencies(
  graph: XfaDependencyGraph,
  targetFieldId: string
): { nodeIds: Set<string>; edgeIds: Set<string>; subformIds: Set<string> } {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const subformIds = new Set<string>();

  const targetNode = graph.nodes.get(targetFieldId);
  if (!targetNode) return { nodeIds, edgeIds, subformIds };

  nodeIds.add(targetFieldId);
  subformIds.add(targetNode.subformId);

  const queue = [targetFieldId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    graph.edges.forEach(edge => {
      if (edge.targetFieldId === currentId) {
        edgeIds.add(edge.id);
        if (!nodeIds.has(edge.sourceFieldId)) {
          nodeIds.add(edge.sourceFieldId);
          queue.push(edge.sourceFieldId);
          const srcNode = graph.nodes.get(edge.sourceFieldId);
          if (srcNode) subformIds.add(srcNode.subformId);
        }
      }
    });
  }

  return { nodeIds, edgeIds, subformIds };
}

/**
 * Traces all downstream dependents (fields that are impacted if this field changes)
 */
export function traceDownstreamDependents(
  graph: XfaDependencyGraph,
  sourceFieldId: string
): { nodeIds: Set<string>; edgeIds: Set<string>; subformIds: Set<string> } {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const subformIds = new Set<string>();

  const sourceNode = graph.nodes.get(sourceFieldId);
  if (!sourceNode) return { nodeIds, edgeIds, subformIds };

  nodeIds.add(sourceFieldId);
  subformIds.add(sourceNode.subformId);

  const queue = [sourceFieldId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    graph.edges.forEach(edge => {
      if (edge.sourceFieldId === currentId) {
        edgeIds.add(edge.id);
        if (!nodeIds.has(edge.targetFieldId)) {
          nodeIds.add(edge.targetFieldId);
          queue.push(edge.targetFieldId);
          const targetNode = graph.nodes.get(edge.targetFieldId);
          if (targetNode) subformIds.add(targetNode.subformId);
        }
      }
    });
  }

  return { nodeIds, edgeIds, subformIds };
}
