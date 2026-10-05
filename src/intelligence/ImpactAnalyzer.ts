import type { IndexSnapshot } from '../storage/IndexFormat.js';
import { detectApiEndpoints } from './ApiDetector.js';

export interface ImpactDependent {
  name: string;
  filePath: string;
  kind: string;
  confidence: 'DIRECT' | 'TRANSITIVE' | 'POSSIBLE';
  depth: number;
}

export interface ImpactAnalysisResult {
  target: string;
  directDependents: ImpactDependent[];
  transitiveDependents: ImpactDependent[];
  affectedFiles: string[];
  affectedSymbols: string[];
  affectedApis: string[];
  affectedTests: string[];
}

export async function analyzeImpact(snapshot: IndexSnapshot, target: string, maxDepth = 5): Promise<ImpactAnalysisResult> {
  const normalizedTarget = target.trim().toLowerCase();
  if (!normalizedTarget) {
    return {
      target,
      directDependents: [],
      transitiveDependents: [],
      affectedFiles: [],
      affectedSymbols: [],
      affectedApis: [],
      affectedTests: []
    };
  }

  // Find target symbols or files
  const matchingSymbols = snapshot.symbols.filter(
    (s) => s.name.toLowerCase() === normalizedTarget || s.id === target
  );
  const matchingFiles = snapshot.files.filter((f) => f.path.toLowerCase() === normalizedTarget);

  const targetSymbolIds = new Set<string>(matchingSymbols.map((s) => s.id));
  const targetFilePaths = new Set<string>([
    ...matchingFiles.map((f) => f.path),
    ...matchingSymbols.map((s) => s.filePath)
  ]);

  const directDependentsMap = new Map<string, ImpactDependent>();
  const transitiveDependentsMap = new Map<string, ImpactDependent>();
  const affectedFilesSet = new Set<string>(targetFilePaths);
  const affectedSymbolsSet = new Set<string>(matchingSymbols.map((s) => s.name));

  const visitedSymbolIds = new Set<string>(targetSymbolIds);
  const visitedFilePaths = new Set<string>(targetFilePaths);

  // Queue for BFS traversal: { symbolId?, filePath?, depth }
  const queue: Array<{ symbolId?: string; filePath?: string; depth: number }> = [];

  for (const symId of targetSymbolIds) queue.push({ symbolId: symId, depth: 0 });
  for (const fPath of targetFilePaths) queue.push({ filePath: fPath, depth: 0 });

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    for (const rel of snapshot.relations) {
      let isTargetMatch = false;

      if (current.symbolId && rel.toSymbolId === current.symbolId) isTargetMatch = true;
      if (current.filePath && rel.filePath !== current.filePath && rel.targetName.toLowerCase() === normalizedTarget) {
        isTargetMatch = true;
      }

      if (isTargetMatch) {
        const sourceFile = rel.filePath;
        const sourceSymbol = snapshot.symbols.find((s) => s.id === rel.fromSymbolId);
        const name = sourceSymbol ? sourceSymbol.name : rel.filePath;
        const key = `${sourceFile}:${name}:${current.depth + 1}`;

        const isDirect = current.depth === 0;
        const confidenceCategory: 'DIRECT' | 'TRANSITIVE' | 'POSSIBLE' = isDirect
          ? 'DIRECT'
          : rel.confidence >= 0.8
            ? 'TRANSITIVE'
            : 'POSSIBLE';

        const dependent: ImpactDependent = {
          name,
          filePath: sourceFile,
          kind: rel.kind,
          confidence: confidenceCategory,
          depth: current.depth + 1
        };

        if (isDirect) {
          if (!directDependentsMap.has(key)) directDependentsMap.set(key, dependent);
        } else {
          if (!transitiveDependentsMap.has(key)) transitiveDependentsMap.set(key, dependent);
        }

        affectedFilesSet.add(sourceFile);
        if (sourceSymbol) affectedSymbolsSet.add(sourceSymbol.name);

        if (sourceSymbol && !visitedSymbolIds.has(sourceSymbol.id)) {
          visitedSymbolIds.add(sourceSymbol.id);
          queue.push({ symbolId: sourceSymbol.id, depth: current.depth + 1 });
        }
        if (!visitedFilePaths.has(sourceFile)) {
          visitedFilePaths.add(sourceFile);
          queue.push({ filePath: sourceFile, depth: current.depth + 1 });
        }
      }
    }
  }

  // Cross-reference affected APIs
  const apiEndpoints = await detectApiEndpoints(snapshot);
  const affectedApis = apiEndpoints
    .filter((api) => affectedFilesSet.has(api.fileId))
    .map((api) => `${api.method} ${api.path}`);

  // Cross-reference affected tests
  const isTestFile = (pathStr: string) =>
    /\b(test|spec|tests|__tests__)\b/iu.test(pathStr) ||
    /\.(test|spec)\.[a-z0-9]+$/iu.test(pathStr);

  const affectedTests: string[] = [...affectedFilesSet].filter((f): f is string => isTestFile(f));

  return {
    target,
    directDependents: [...directDependentsMap.values()],
    transitiveDependents: [...transitiveDependentsMap.values()],
    affectedFiles: [...affectedFilesSet],
    affectedSymbols: [...affectedSymbolsSet],
    affectedApis: [...new Set(affectedApis)],
    affectedTests
  };
}
