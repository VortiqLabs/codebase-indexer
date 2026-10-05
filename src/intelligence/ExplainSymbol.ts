import type { IndexSnapshot } from '../storage/IndexFormat.js';
import { detectApiEndpoints } from './ApiDetector.js';
import { analyzeDatabaseSchema } from './DatabaseAnalyzer.js';
import { findTests } from './TestAnalyzer.js';

export interface SymbolExplanation {
  symbolName: string;
  kind?: string;
  definition?: {
    filePath: string;
    startLine: number;
    endLine: number;
  };
  callers: string[];
  callees: string[];
  references: string[];
  isExported: boolean;
  relatedTypes: string[];
  tests: string[];
  apis: string[];
  databaseRelations: string[];
}

export async function explainSymbol(snapshot: IndexSnapshot, symbolName: string): Promise<SymbolExplanation> {
  const normalized = symbolName.trim().toLowerCase();

  const matchingSymbol = snapshot.symbols.find((s) => s.name.toLowerCase() === normalized);

  const callers = snapshot.relations
    .filter((r) => r.kind === 'calls' && r.targetName.toLowerCase() === normalized)
    .map((r) => `${r.filePath}:${r.line}`);

  const callees = matchingSymbol
    ? snapshot.relations
        .filter((r) => r.kind === 'calls' && r.fromSymbolId === matchingSymbol.id)
        .map((r) => r.targetName)
    : [];

  const references = snapshot.relations
    .filter((r) => r.targetName.toLowerCase() === normalized)
    .map((r) => `${r.filePath}:${r.line}`);

  const isExported = matchingSymbol
    ? snapshot.relations.some((r) => r.kind === 'exports' && r.toSymbolId === matchingSymbol.id)
    : false;

  const relatedTypes = snapshot.relations
    .filter((r) => (r.kind === 'extends' || r.kind === 'implements') && r.filePath === matchingSymbol?.filePath)
    .map((r) => `${r.kind} ${r.targetName}`);

  const testMappings = findTests(snapshot, symbolName);
  const tests = testMappings.map((t) => t.testFile);

  const apis = (await detectApiEndpoints(snapshot))
    .filter((a) => a.symbolId === matchingSymbol?.id || a.fileId === matchingSymbol?.filePath)
    .map((a) => `${a.method} ${a.path}`);

  const dbModels = await analyzeDatabaseSchema(snapshot);
  const databaseRelations = dbModels
    .filter((m) => m.name.toLowerCase() === normalized || m.filePath === matchingSymbol?.filePath)
    .map((m) => `${m.kind}: ${m.tableOrModel}`);

  return {
    symbolName,
    ...(matchingSymbol ? { kind: matchingSymbol.kind } : {}),
    ...(matchingSymbol ? { definition: { filePath: matchingSymbol.filePath, startLine: matchingSymbol.startLine, endLine: matchingSymbol.endLine } } : {}),
    callers: [...new Set(callers)],
    callees: [...new Set(callees)],
    references: [...new Set(references)],
    isExported,
    relatedTypes: [...new Set(relatedTypes)],
    tests: [...new Set(tests)],
    apis: [...new Set(apis)],
    databaseRelations: [...new Set(databaseRelations)]
  };
}
