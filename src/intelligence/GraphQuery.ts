import type { IndexSnapshot } from '../storage/IndexFormat.js';
import type { RelationKind, RelationRecord } from '../types/Relation.js';

export interface GraphPathResult {
  nodes: string[];
  edges: Array<{ from: string; to: string; kind: RelationKind; confidence: number }>;
  depth: number;
}

export interface GraphQueryOptions {
  maxDepth?: number;
  maxNodes?: number;
}

export interface GraphCycle {
  id: string;
  symbols: string[];
  files: string[];
  length: number;
}

export interface MatrixGraph {
  nodes: Array<{ id: string; name: string; type: string; inbound: number; outbound: number }>;
  matrix: number[][];
}

export interface RadialGraphNode {
  id: string;
  name: string;
  kind: string;
  depth: number;
  relationKind?: string;
}

export interface RadialGraph {
  center: string;
  nodes: RadialGraphNode[];
  edges: Array<{ source: string; target: string; kind: string }>;
}

export interface FlowGraph {
  nodes: Array<{ id: string; name: string; kind: string; level: number }>;
  edges: Array<{ source: string; target: string; kind: string }>;
}

export function findSymbolPath(snapshot: IndexSnapshot, fromName: string, toName: string, options: GraphQueryOptions = {}): GraphPathResult {
  const maxDepth = options.maxDepth ?? 4;
  const maxNodes = options.maxNodes ?? 32;
  const normalizedFrom = fromName.trim();
  const normalizedTo = toName.trim();
  if (!normalizedFrom || !normalizedTo) {
    return { nodes: [normalizedFrom || normalizedTo].filter(Boolean), edges: [], depth: 0 };
  }

  const symbolById = new Map(snapshot.symbols.map((symbol) => [symbol.id, symbol.name]));
  const adjacency = new Map<string, Array<{ to: string; kind: RelationKind; confidence: number }>>();
  for (const relation of snapshot.relations) {
    if (!relation.fromSymbolId || !relation.toSymbolId) continue;
    const list = adjacency.get(relation.fromSymbolId) ?? [];
    list.push({ to: relation.toSymbolId, kind: relation.kind, confidence: relation.confidence });
    adjacency.set(relation.fromSymbolId, list);
  }

  const startIds = new Set(
    snapshot.symbols
      .filter((symbol) => symbol.name.toLowerCase() === normalizedFrom.toLowerCase() || symbol.filePath.toLowerCase().includes(normalizedFrom.toLowerCase()))
      .map((symbol) => symbol.id)
  );
  const targetIds = new Set(
    snapshot.symbols
      .filter((symbol) => symbol.name.toLowerCase() === normalizedTo.toLowerCase() || symbol.filePath.toLowerCase().includes(normalizedTo.toLowerCase()))
      .map((symbol) => symbol.id)
  );

  if (startIds.size === 0 || targetIds.size === 0) {
    return { nodes: [normalizedFrom, normalizedTo], edges: [], depth: 0 };
  }

  const queue: Array<{ id: string; path: string[]; edges: GraphPathResult['edges'] }> = [];
  const seen = new Set<string>();
  for (const id of startIds) {
    const name = symbolById.get(id) ?? id;
    queue.push({ id, path: [name], edges: [] });
    seen.add(id);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.path.length >= maxNodes || current.path.length > maxDepth + 1) continue;
    if (targetIds.has(current.id)) {
      return { nodes: current.path, edges: current.edges, depth: Math.max(0, current.path.length - 1) };
    }
    for (const edge of adjacency.get(current.id) ?? []) {
      const nextId = edge.to;
      if (seen.has(nextId)) continue;
      const nextName = symbolById.get(nextId) ?? nextId;
      const nextPath = [...current.path, nextName];
      const nextEdges = [...current.edges, { from: current.path.at(-1) ?? current.id, to: nextName, kind: edge.kind, confidence: edge.confidence }];
      queue.push({ id: nextId, path: nextPath, edges: nextEdges });
      seen.add(nextId);
    }
  }

  return { nodes: [...startIds].map((id) => symbolById.get(id) ?? id).slice(0, maxNodes), edges: [], depth: 0 };
}

export function findDependencyRelations(snapshot: IndexSnapshot, query: string, reverse = false, depth = 1): RelationRecord[] {
  const normalized = query.trim();
  if (!normalized) return [];
  const normalizedQuery = normalized.toLowerCase();
  const queryStem = normalizedQuery.replace(/\.[^/.]+$/u, '').replace(/\/index$/u, '');
  const symbolIds = new Set(
    snapshot.symbols
      .filter((symbol) => symbol.name.toLowerCase() === normalizedQuery || symbol.filePath.toLowerCase() === normalizedQuery || symbol.filePath.toLowerCase().includes(normalizedQuery) || symbol.filePath.toLowerCase().includes(queryStem))
      .map((symbol) => symbol.id)
  );
  const fileMatches = new Set(snapshot.files.filter((file) => file.path.toLowerCase() === normalizedQuery || file.path.toLowerCase().includes(normalizedQuery) || file.path.toLowerCase().includes(queryStem)).map((file) => file.path));

  const matches: RelationRecord[] = [];
  for (const relation of snapshot.relations) {
    if (depth < 1) continue;
    const isRelevantKind = ['imports', 'exports', 'calls', 'references', 'contains', 'extends', 'implements', 'depends-on'].includes(relation.kind);
    if (!isRelevantKind) continue;
    const fromMatches = !!relation.fromSymbolId && symbolIds.has(relation.fromSymbolId);
    const toMatches = !!relation.toSymbolId && symbolIds.has(relation.toSymbolId);
    const targetName = relation.targetName.toLowerCase().replace(/^['"]|['"]$/gu, '').replace(/^\.\/?/, '').replace(/\/index$/u, '');
    const targetStem = targetName.replace(/\.[^/.]+$/u, '');
    const queryBasename = normalizedQuery.split('/').at(-1)?.replace(/\.[^/.]+$/u, '') ?? '';
    const fileMatch = fileMatches.has(relation.filePath)
      || relation.targetName.toLowerCase().includes(normalizedQuery)
      || targetName.includes(queryStem)
      || targetStem.includes(queryBasename)
      || queryStem.includes(targetStem)
      || normalizedQuery.includes(targetStem);
    const directMatch = reverse ? (toMatches || (relation.toSymbolId === undefined && fileMatch)) : (fromMatches || (relation.fromSymbolId === undefined && fileMatch));
    if (directMatch || (!reverse && fileMatch) || (reverse && fileMatch)) {
      matches.push(relation);
    }
  }
  return matches.sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0) || left.line - right.line);
}

export function findGraphCycles(snapshot: IndexSnapshot): GraphCycle[] {
  const symbolById = new Map(snapshot.symbols.map((s) => [s.id, s]));
  const adjacency = new Map<string, string[]>();
  for (const relation of snapshot.relations) {
    if (!relation.fromSymbolId || !relation.toSymbolId) continue;
    const list = adjacency.get(relation.fromSymbolId) ?? [];
    if (!list.includes(relation.toSymbolId)) list.push(relation.toSymbolId);
    adjacency.set(relation.fromSymbolId, list);
  }

  const cycles: GraphCycle[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  function dfs(nodeId: string) {
    visited.add(nodeId);
    inStack.add(nodeId);
    stack.push(nodeId);

    for (const neighborId of adjacency.get(nodeId) ?? []) {
      if (!visited.has(neighborId)) {
        dfs(neighborId);
      } else if (inStack.has(neighborId)) {
        const cycleStartIndex = stack.indexOf(neighborId);
        if (cycleStartIndex !== -1) {
          const cycleIds = stack.slice(cycleStartIndex);
          const cycleSymbols = cycleIds.map((id) => symbolById.get(id)?.name ?? id);
          const cycleFiles = [...new Set(cycleIds.map((id) => symbolById.get(id)?.filePath).filter(Boolean) as string[])];
          if (cycles.length < 20) {
            cycles.push({
              id: `cycle-${cycles.length + 1}`,
              symbols: cycleSymbols,
              files: cycleFiles,
              length: cycleSymbols.length
            });
          }
        }
      }
    }

    stack.pop();
    inStack.delete(nodeId);
  }

  for (const symbol of snapshot.symbols) {
    if (!visited.has(symbol.id) && cycles.length < 20) {
      dfs(symbol.id);
    }
  }

  return cycles;
}

export function getMatrixGraph(snapshot: IndexSnapshot): MatrixGraph {
  const topFiles = snapshot.files.slice(0, 30);
  const fileIndices = new Map(topFiles.map((f, i) => [f.path, i]));
  const matrix: number[][] = Array.from({ length: topFiles.length }, () => Array(topFiles.length).fill(0));
  const inbound = Array(topFiles.length).fill(0);
  const outbound = Array(topFiles.length).fill(0);

  const symbolFile = new Map(snapshot.symbols.map((s) => [s.id, s.filePath]));
  for (const relation of snapshot.relations) {
    const fromFile = relation.filePath;
    const toFile = relation.toSymbolId ? symbolFile.get(relation.toSymbolId) : undefined;
    if (fromFile && toFile && fromFile !== toFile) {
      const fromIdx = fileIndices.get(fromFile);
      const toIdx = fileIndices.get(toFile);
      if (fromIdx !== undefined && toIdx !== undefined) {
        matrix[fromIdx]![toIdx]! += 1;
        outbound[fromIdx]! += 1;
        inbound[toIdx]! += 1;
      }
    }
  }

  return {
    nodes: topFiles.map((f, i) => ({
      id: f.path,
      name: f.path.split('/').pop() || f.path,
      type: f.language,
      inbound: inbound[i]!,
      outbound: outbound[i]!
    })),
    matrix
  };
}

export function getRadialGraph(snapshot: IndexSnapshot, centerQuery?: string): RadialGraph {
  let rootSymbol = snapshot.symbols[0];
  if (centerQuery) {
    const found = snapshot.symbols.find((s) => s.name.toLowerCase().includes(centerQuery.toLowerCase()) || s.filePath.toLowerCase().includes(centerQuery.toLowerCase()));
    if (found) rootSymbol = found;
  }

  if (!rootSymbol) {
    return { center: 'None', nodes: [], edges: [] };
  }

  const nodesMap = new Map<string, RadialGraphNode>();
  const edges: Array<{ source: string; target: string; kind: string }> = [];

  nodesMap.set(rootSymbol.id, {
    id: rootSymbol.id,
    name: rootSymbol.name,
    kind: rootSymbol.kind,
    depth: 0
  });

  const symbolById = new Map(snapshot.symbols.map((s) => [s.id, s]));
  for (const rel of snapshot.relations) {
    if (rel.fromSymbolId === rootSymbol.id && rel.toSymbolId) {
      const target = symbolById.get(rel.toSymbolId);
      if (target && !nodesMap.has(target.id)) {
        nodesMap.set(target.id, {
          id: target.id,
          name: target.name,
          kind: target.kind,
          depth: 1,
          relationKind: rel.kind
        });
        edges.push({ source: rootSymbol.id, target: target.id, kind: rel.kind });
      }
    } else if (rel.toSymbolId === rootSymbol.id && rel.fromSymbolId) {
      const source = symbolById.get(rel.fromSymbolId);
      if (source && !nodesMap.has(source.id)) {
        nodesMap.set(source.id, {
          id: source.id,
          name: source.name,
          kind: source.kind,
          depth: 1,
          relationKind: rel.kind
        });
        edges.push({ source: source.id, target: rootSymbol.id, kind: rel.kind });
      }
    }
  }

  return {
    center: rootSymbol.name,
    nodes: Array.from(nodesMap.values()),
    edges
  };
}

export function getFlowGraph(snapshot: IndexSnapshot): FlowGraph {
  const nodes: Array<{ id: string; name: string; kind: string; level: number }> = [];
  const edges: Array<{ source: string; target: string; kind: string }> = [];

  const topSymbols = snapshot.symbols.slice(0, 40);
  const symbolSet = new Set(topSymbols.map((s) => s.id));

  for (const sym of topSymbols) {
    nodes.push({
      id: sym.id,
      name: sym.name,
      kind: sym.kind,
      level: sym.parentId ? 2 : 1
    });
  }

  for (const rel of snapshot.relations) {
    if (rel.fromSymbolId && rel.toSymbolId && symbolSet.has(rel.fromSymbolId) && symbolSet.has(rel.toSymbolId)) {
      edges.push({ source: rel.fromSymbolId, target: rel.toSymbolId, kind: rel.kind });
    }
  }

  return { nodes, edges };
}
