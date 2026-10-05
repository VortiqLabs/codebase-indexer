import type { IndexSnapshot } from '../storage/IndexFormat.js';

export interface TestMapping {
  testFile: string;
  testSymbol?: string;
  targetFile?: string;
  targetSymbol?: string;
  relationship: 'imports' | 'calls' | 'references' | 'naming_convention';
  confidence: number;
}

export function isTestFile(filePath: string): boolean {
  return (
    /\b(test|spec|tests|__tests__)\b/iu.test(filePath) ||
    /\.(test|spec)\.[a-z0-9]+$/iu.test(filePath)
  );
}

export function findTests(snapshot: IndexSnapshot, query: string): TestMapping[] {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return [];

  const mappings: TestMapping[] = [];

  const matchingSymbols = snapshot.symbols.filter(
    (s) => s.name.toLowerCase() === normalized || s.id === query
  );
  const matchingFiles = snapshot.files.filter((f) => f.path.toLowerCase() === normalized);

  const targetSymbolIds = new Set(matchingSymbols.map((s) => s.id));
  const targetSymbolNames = new Set(matchingSymbols.map((s) => s.name.toLowerCase()));
  const targetFiles = new Set([
    ...matchingFiles.map((f) => f.path),
    ...matchingSymbols.map((s) => s.filePath)
  ]);

  for (const rel of snapshot.relations) {
    if (!isTestFile(rel.filePath)) continue;

    const isMatch =
      (rel.toSymbolId && targetSymbolIds.has(rel.toSymbolId)) ||
      targetSymbolNames.has(rel.targetName.toLowerCase()) ||
      [...targetFiles].some((tf) => tf.includes(rel.targetName) || rel.filePath.includes(tf));

    if (isMatch) {
      const sourceSymbol = snapshot.symbols.find((s) => s.id === rel.fromSymbolId);
      mappings.push({
        testFile: rel.filePath,
        ...(sourceSymbol ? { testSymbol: sourceSymbol.name } : {}),
        targetFile: rel.filePath,
        targetSymbol: rel.targetName,
        relationship: rel.kind === 'imports' || rel.kind === 'calls' ? rel.kind : 'references',
        confidence: rel.confidence
      });
    }
  }

  // Naming convention matching (e.g. auth.ts -> auth.test.ts)
  for (const targetFile of targetFiles) {
    const baseName = targetFile.replace(/\.[^/.]+$/u, '').split('/').at(-1);
    if (!baseName) continue;

    for (const file of snapshot.files) {
      if (!isTestFile(file.path)) continue;
      if (file.path.toLowerCase().includes(baseName.toLowerCase()) && file.path !== targetFile) {
        if (!mappings.some((m) => m.testFile === file.path)) {
          mappings.push({
            testFile: file.path,
            targetFile,
            relationship: 'naming_convention',
            confidence: 0.85
          });
        }
      }
    }
  }

  return mappings;
}

export function findAffectedTests(snapshot: IndexSnapshot, changedFiles: string[]): TestMapping[] {
  const result: TestMapping[] = [];
  const processedTests = new Set<string>();

  for (const file of changedFiles) {
    const tests = findTests(snapshot, file);
    for (const test of tests) {
      const key = `${test.testFile}:${test.targetSymbol ?? ''}`;
      if (!processedTests.has(key)) {
        processedTests.add(key);
        result.push(test);
      }
    }
  }

  return result;
}
