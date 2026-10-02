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
