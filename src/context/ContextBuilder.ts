import type { IndexSnapshot } from '../storage/IndexFormat.js';
import type { CodeChunk } from '../types/CodeChunk.js';
import type { FileRecord } from '../types/FileRecord.js';
import type { RelationRecord } from '../types/Relation.js';
import type { SymbolRecord } from '../types/Symbol.js';

export interface ContextOptions {
  maxTokens?: number;
  maxFiles?: number;
}

export interface CodeContext {
  files: Array<Pick<FileRecord, 'path' | 'language'>>;
  symbols: SymbolRecord[];
  relations: RelationRecord[];
  chunks: CodeChunk[];
  estimatedTokens: number;
}

export class ContextBuilder {
  build(snapshot: IndexSnapshot, query: string, rankedFiles: FileRecord[], options: ContextOptions = {}): CodeContext {
    const maxTokens = options.maxTokens ?? 6000;
    const maxFiles = options.maxFiles ?? 8;
    const selectedFiles = rankedFiles.slice(0, maxFiles);
    const filePaths = new Set(selectedFiles.map((file) => file.path));
    const terms = query.toLowerCase().match(/[\p{L}\p{N}_$.-]+/gu) ?? [];
    const chunks = snapshot.chunks.filter((chunk) => filePaths.has(chunk.filePath))
      .map((chunk) => ({ chunk, score: scoreText(chunk.text, terms) }))
      .sort((left, right) => right.score - left.score || left.chunk.startLine - right.chunk.startLine);
    const selectedChunks: CodeChunk[] = [];
    let estimatedTokens = 0;
    for (const { chunk } of chunks) {
      const cost = Math.ceil(chunk.text.length / 4);
      if (estimatedTokens + cost > maxTokens) continue;
      selectedChunks.push(chunk);
      estimatedTokens += cost;
    }
    const symbolIds = new Set(selectedChunks.flatMap((chunk) => chunk.symbolId ? [chunk.symbolId] : []));
    const symbols = snapshot.symbols.filter((symbol) => symbolIds.has(symbol.id));
    const expanded = new Set(symbolIds);
    for (const relation of snapshot.relations) {
      if (relation.fromSymbolId && symbolIds.has(relation.fromSymbolId) && relation.toSymbolId) expanded.add(relation.toSymbolId);
      if (relation.toSymbolId && symbolIds.has(relation.toSymbolId) && relation.fromSymbolId) expanded.add(relation.fromSymbolId);
    }
    const selectedRelations = snapshot.relations.filter((relation) =>
      (relation.fromSymbolId && expanded.has(relation.fromSymbolId)) ||
      (relation.toSymbolId && expanded.has(relation.toSymbolId)) || filePaths.has(relation.filePath));
    const relatedSymbols = snapshot.symbols.filter((symbol) => expanded.has(symbol.id));
    const uniqueSymbols = [...new Map([...symbols, ...relatedSymbols].map((symbol) => [symbol.id, symbol])).values()];
    return {
      files: selectedFiles.map(({ path, language }) => ({ path, language })),
      symbols: uniqueSymbols,
      relations: selectedRelations,
      chunks: selectedChunks,
      estimatedTokens
    };
  }
}

function scoreText(text: string, terms: string[]): number {
  const normalized = text.toLowerCase();
  return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}