import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { IndexSnapshot } from '../storage/IndexFormat.js';

export interface SymbolComplexity {
  symbolName: string;
  filePath: string;
  kind: string;
  startLine: number;
  endLine: number;
  loc: number;
  cyclomaticComplexity: number;
}

export interface FileComplexity {
  filePath: string;
  loc: number;
  cyclomaticComplexity: number;
  symbolCount: number;
  symbols: SymbolComplexity[];
}

export async function analyzeComplexity(snapshot: IndexSnapshot): Promise<FileComplexity[]> {
  const result: FileComplexity[] = [];

  for (const file of snapshot.files) {
    const fullPath = path.join(snapshot.metadata.workspaceRoot, file.path);
    const source = await readFile(fullPath, 'utf8').catch(() => '');
    if (!source) continue;

    const lines = source.split('\n');
    const loc = lines.length;
    const fileComplexityScore = calculateSourceComplexity(source);

    const fileSymbols = snapshot.symbols.filter((s) => s.filePath === file.path);
    const symbolComplexities: SymbolComplexity[] = [];

    for (const sym of fileSymbols) {
      const symLines = lines.slice(sym.startLine - 1, sym.endLine);
      const symSource = symLines.join('\n');
      const symLoc = symLines.length;
      const symComplexity = calculateSourceComplexity(symSource);

      symbolComplexities.push({
        symbolName: sym.name,
        filePath: file.path,
        kind: sym.kind,
        startLine: sym.startLine,
        endLine: sym.endLine,
        loc: symLoc,
        cyclomaticComplexity: symComplexity
      });
    }

    result.push({
      filePath: file.path,
      loc,
      cyclomaticComplexity: fileComplexityScore,
      symbolCount: fileSymbols.length,
      symbols: symbolComplexities
    });
  }

  return result.sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity);
}

function calculateSourceComplexity(source: string): number {
  let complexity = 1;
  const matches = source.match(/\b(if|else\s+if|for|while|catch|case|&&|\|\||\?)\b/gu);
  if (matches) complexity += matches.length;
  return complexity;
}
