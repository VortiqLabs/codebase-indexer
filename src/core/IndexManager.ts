import { createHash } from 'node:crypto';
import { readFile, realpath, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileScanner, type FileScannerOptions } from '../scanner/FileScanner.js';
import { TreeSitterParser } from '../parser/TreeSitterParser.js';
import { SemanticChunker } from '../chunks/SemanticChunker.js';
import { IndexReader, IndexWriter } from '../storage/BinaryIndex.js';
import { INDEX_FORMAT_VERSION, type IndexMetadata, type IndexSnapshot } from '../storage/IndexFormat.js';
import type { CodeChunk } from '../types/CodeChunk.js';
import type { FileRecord } from '../types/FileRecord.js';
import type { RelationRecord } from '../types/Relation.js';
import type { SymbolRecord } from '../types/Symbol.js';
import type { VectorRecord } from '../types/VectorRecord.js';
import type { EmbeddingProvider } from '../embeddings/EmbeddingProvider.js';
import { EmbeddingCache } from '../embeddings/EmbeddingCache.js';
import { EmbeddingQueue } from '../embeddings/EmbeddingQueue.js';
import { detectApiEndpoints, type ApiEndpoint } from '../intelligence/ApiDetector.js';
import { findDependencyRelations, findSymbolPath, type GraphQueryOptions, type GraphPathResult } from '../intelligence/GraphQuery.js';
import { buildRepositoryMap, type RepositoryMap } from '../intelligence/RepositoryMap.js';
import { classifyQuery, type QueryIntent } from '../intelligence/QueryIntent.js';
import { detectSensitiveRegions, type SensitiveRegion } from '../intelligence/SensitiveDetector.js';

export interface IndexManagerOptions extends FileScannerOptions {
  workspacePath: string;
  indexDir?: string;
  partitionId?: string;
  indexLabel?: string;
  indexGroup?: string;
  indexPart?: number;
  indexPartCount?: number;
  embeddingProvider?: EmbeddingProvider;
}

export interface IndexUpdateResult {
  indexPath: string;
  snapshot: IndexSnapshot;
  added: number;
  changed: number;
  unchanged: number;
  deleted: number;
  errors: number;
}

export interface IndexProgress {
  stage: 'scan' | 'parse' | 'relations' | 'embedding' | 'persist' | 'complete';
  message: string;
  current?: number;
  total?: number;
}

export class IndexManager {
  readonly workspacePath: string;
  readonly uid: string;
  readonly indexPath: string;
  private readonly options: IndexManagerOptions;
  private readonly parser = new TreeSitterParser();
  private readonly chunker = new SemanticChunker();
  private readonly embeddingQueue = new EmbeddingQueue();

  private constructor(options: IndexManagerOptions, workspacePath: string, uid: string, indexPath: string) {
    this.options = options;
    this.workspacePath = workspacePath;
    this.uid = uid;
    this.indexPath = indexPath;
  }

  static async create(options: IndexManagerOptions): Promise<IndexManager> {
    const workspacePath = await realpath(options.workspacePath);
    const uid = createHash('sha256')
      .update(options.partitionId ? `${workspacePath}\0${options.partitionId}` : workspacePath)
      .digest('hex').slice(0, 32);
    const indexDir = options.indexDir ?? path.join(os.homedir(), '.cache', 'codebase-indexer');
    return new IndexManager(options, workspacePath, uid, path.join(path.resolve(indexDir), `${uid}.index`));
  }

  async index(force = false, onProgress?: (progress: IndexProgress) => void): Promise<IndexUpdateResult> {
    const scanner = await FileScanner.create(this.workspacePath, this.options);
    onProgress?.({ stage: 'scan', message: `Scanning ${this.workspacePath}` });
    const scan = await scanner.scan((visitedFiles, acceptedFiles) => {
      onProgress?.({
        stage: 'scan',
        current: visitedFiles,
        message: `Scanned ${visitedFiles.toLocaleString()} files; ${acceptedFiles.toLocaleString()} are within index limits`
      });
    });
    onProgress?.({ stage: 'scan', current: scan.files.length, total: scan.files.length, message: `Scan complete: ${scan.files.length.toLocaleString()} files accepted` });
    let previous: IndexSnapshot | undefined;
    if (!force) {
      try {
        previous = await IndexReader.read(this.indexPath, this.uid);
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }
    }

    const oldFiles = new Map(previous?.files.map((file) => [file.path, file]) ?? []);
    const changedPaths = new Set<string>();
    let added = 0;
    let changed = 0;
    let unchanged = 0;
    const files = scan.files.map((file) => {
      const oldFile = oldFiles.get(file.path);
      oldFiles.delete(file.path);
      if (oldFile?.hash === file.hash) {
        unchanged++;
        return oldFile;
      }
      if (oldFile) changed++;
      else added++;
      changedPaths.add(file.path);
      return file;
    });
    const deleted = oldFiles.size;
    const now = new Date().toISOString();
    const currentPaths = new Set(files.map((file) => file.path));
    const symbols = (previous?.symbols ?? []).filter((symbol) => currentPaths.has(symbol.filePath) && !changedPaths.has(symbol.filePath));
    const relations = (previous?.relations ?? []).filter((relation) => currentPaths.has(relation.filePath) && !changedPaths.has(relation.filePath));
    const chunks = (previous?.chunks ?? []).filter((chunk) => currentPaths.has(chunk.filePath) && !changedPaths.has(chunk.filePath));
    let parseErrors = 0;
    const changedFilePaths = [...changedPaths];
    const filesByPath = new Map(files.map((file) => [file.path, file]));
    onProgress?.({ stage: 'parse', current: 0, total: changedFilePaths.length, message: `Parsing ${changedFilePaths.length.toLocaleString()} added or changed files` });
    for (let index = 0; index < changedFilePaths.length; index++) {
      const filePath = changedFilePaths[index]!;
      if (index === 0 || (index + 1) % 100 === 0 || index + 1 === changedFilePaths.length) {
        onProgress?.({ stage: 'parse', current: index + 1, total: changedFilePaths.length, message: `Parsing files: ${(index + 1).toLocaleString()} of ${changedFilePaths.length.toLocaleString()}` });
      }
      const file = filesByPath.get(filePath)!;
      try {
        const source = await readFile(path.join(this.workspacePath, filePath), 'utf8');
        const parsed = await this.parser.parse(file.path, source, file.language);
        if (parsed) {
          symbols.push(...parsed.symbols);
          relations.push(...parsed.relations);
          chunks.push(...(parsed.chunks.length > 0 ? parsed.chunks : this.chunker.chunk(file.path, source)));
        } else {
          chunks.push(...this.chunker.chunk(file.path, source));
        }
      } catch {
        parseErrors++;
        try {
          const source = await readFile(path.join(this.workspacePath, filePath), 'utf8');
          chunks.push(...this.chunker.chunk(file.path, source));
        } catch {
          parseErrors++;
        }
      }
    }
    onProgress?.({ stage: 'relations', message: `Resolving ${relations.length.toLocaleString()} relations` });
    resolveRelations(relations, symbols);
    const provider = this.options.embeddingProvider;
    let vectors: VectorRecord[] = [];
    let embeddingProvider = previous?.metadata.embeddingProvider;
    let embeddingDimensions = previous?.metadata.embeddingDimensions;
    if (provider) {
      onProgress?.({ stage: 'embedding', current: 0, total: chunks.length, message: `Preparing embeddings for ${chunks.length.toLocaleString()} chunks` });
      const dimensions = provider.dimensions();
      if (!Number.isSafeInteger(dimensions) || dimensions < 1) throw new Error('Embedding provider dimensions must be a positive safe integer');
      const providerId = provider.id ?? provider.constructor.name;
      const compatible = previous?.metadata.embeddingProvider === providerId && previous.metadata.embeddingDimensions === dimensions;
      const cache = new EmbeddingCache(compatible ? previous?.vectors : []);
      const uniqueMissing = [...new Map(chunks.filter((chunk) => !cache.get(chunk.hash)).map((chunk) => [chunk.hash, chunk])).values()];
      for (const vector of await this.embeddingQueue.embed(provider, uniqueMissing, providerId)) cache.set(vector);
      vectors = chunks.flatMap((chunk) => {
        const cached = cache.get(chunk.hash);
        return cached ? [{ ...cached, chunkId: chunk.id }] : [];
      });
      embeddingProvider = providerId;
      embeddingDimensions = dimensions;
    } else if (previous?.vectors.length) {
      const chunksByHash = new Map(chunks.map((chunk) => [chunk.hash, chunk]));
      vectors = previous.vectors.flatMap((vector) => {
        const chunk = chunksByHash.get(vector.chunkHash);
        return chunk ? [{ ...vector, chunkId: chunk.id }] : [];
      });
    }
    const metadata: IndexMetadata = {
      uid: this.uid,
      workspaceRoot: this.workspacePath,
      formatVersion: INDEX_FORMAT_VERSION,
      indexerVersion: '0.1.0',
      createdAt: previous?.metadata.createdAt ?? now,
      updatedAt: now,
      fileCount: files.length,
      symbolCount: symbols.length,
      relationCount: relations.length,
      chunkCount: chunks.length,
      vectorCount: vectors.length,
      ...(embeddingProvider ? { embeddingProvider } : {}),
      ...(embeddingDimensions ? { embeddingDimensions } : {}),
      ...(this.options.indexLabel ? { indexLabel: this.options.indexLabel } : {}),
      ...(this.options.indexGroup ? { indexGroup: this.options.indexGroup } : {}),
      ...(this.options.indexPart ? { indexPart: this.options.indexPart } : {}),
      ...(this.options.indexPartCount ? { indexPartCount: this.options.indexPartCount } : {}),
      configurationHash: createHash('sha256').update(JSON.stringify({
        maxFileSize: this.options.maxFileSize ?? 1024 * 1024,
        patterns: this.options.patterns ?? [],
        partitionId: this.options.partitionId,
        includeFiles: this.options.includeFiles
      })).digest('hex')
    };
    const snapshot: IndexSnapshot = {
      metadata,
      files,
      symbols,
      relations,
      chunks,
      vectors
    };
    onProgress?.({ stage: 'persist', message: 'Writing the binary index atomically' });
    await IndexWriter.writeAtomic(this.indexPath, snapshot);
    onProgress?.({ stage: 'complete', current: files.length, total: files.length, message: 'Indexing complete' });
    return { indexPath: this.indexPath, snapshot, added, changed, unchanged, deleted, errors: scan.errors.length + parseErrors };
  }

  async read(): Promise<IndexSnapshot> {
    return IndexReader.read(this.indexPath, this.uid);
  }

  async remove(): Promise<boolean> {
    try {
      await rm(this.indexPath);
      return true;
    } catch (error) {
      if (isMissingFile(error)) return false;
      throw error;
    }
  }

  async search(query: string, limit = 10): Promise<Array<{ file: FileRecord; score: number }>> {
    const snapshot = await this.read();
    const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}_$.-]+/gu) ?? [])];
    if (terms.length === 0) return [];
    const symbolsByPath = new Map<string, SymbolRecord[]>();
    for (const symbol of snapshot.symbols) {
      symbolsByPath.set(symbol.filePath, [...(symbolsByPath.get(symbol.filePath) ?? []), symbol]);
    }
    return snapshot.files.map((file) => {
      const haystack = new Set(file.terms);
      const matches = terms.filter((term) => haystack.has(term));
      const pathMatches = terms.filter((term) => file.path.toLowerCase().includes(term));
      const symbolMatches = (symbolsByPath.get(file.path) ?? []).reduce((count, symbol) =>
        count + terms.filter((term) => symbol.name.toLowerCase().includes(term)).length, 0);
      return { file, score: matches.length * 2 + pathMatches.length + symbolMatches * 4 };
    }).filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score || left.file.path.localeCompare(right.file.path))
      .slice(0, limit);
  }

  async findSymbol(query: string): Promise<SymbolRecord[]> {
    const normalized = query.toLowerCase();
    return (await this.read()).symbols.filter((symbol) => symbol.name.toLowerCase().includes(normalized));
  }

  async findReferences(query: string): Promise<RelationRecord[]> {
    const normalized = query.toLowerCase();
    return (await this.read()).relations.filter((relation) => relation.targetName.toLowerCase() === normalized);
  }

  async findCallers(query: string): Promise<RelationRecord[]> {
    const snapshot = await this.read();
    const symbolIds = new Set(snapshot.symbols.filter((symbol) => symbol.name.toLowerCase() === query.toLowerCase()).map((symbol) => symbol.id));
    return snapshot.relations.filter((relation) => relation.kind === 'calls' && relation.toSymbolId && symbolIds.has(relation.toSymbolId));
  }

  async findCallees(query: string): Promise<RelationRecord[]> {
    const snapshot = await this.read();
    const symbolIds = new Set(snapshot.symbols.filter((symbol) => symbol.name.toLowerCase() === query.toLowerCase()).map((symbol) => symbol.id));
    return snapshot.relations.filter((relation) => relation.kind === 'calls' && relation.fromSymbolId && symbolIds.has(relation.fromSymbolId));
  }

  async findDependencies(query: string, depth = 1): Promise<RelationRecord[]> {
    const snapshot = await this.read();
    return findDependencyRelations(snapshot, query, false, depth);
  }

  async findDependents(query: string, depth = 1): Promise<RelationRecord[]> {
    const snapshot = await this.read();
    return findDependencyRelations(snapshot, query, true, depth);
  }

  async findPath(from: string, to: string, options: GraphQueryOptions = {}): Promise<GraphPathResult> {
    return findSymbolPath(await this.read(), from, to, options);
  }

  async getRepositoryMap(): Promise<RepositoryMap> {
    return buildRepositoryMap(await this.read());
  }

  async classifyQuery(query: string): Promise<QueryIntent> {
    return classifyQuery(query);
  }

  async findApiEndpoints(): Promise<ApiEndpoint[]> {
    return detectApiEndpoints(await this.read());
  }

  async findSensitiveRegions(): Promise<SensitiveRegion[]> {
    return detectSensitiveRegions(await this.read());
  }

  async semanticSearch(query: string, limit = 10): Promise<Array<{ file: FileRecord; chunk: CodeChunk; score: number }>> {
    const provider = this.options.embeddingProvider;
    if (!provider) throw new Error('Semantic search requires an explicitly configured embedding provider');
    const snapshot = await this.read();
    const dimensions = provider.dimensions();
    if (snapshot.metadata.embeddingProvider !== (provider.id ?? provider.constructor.name) || snapshot.metadata.embeddingDimensions !== dimensions) {
      throw new Error('Embedding provider does not match vectors stored in this index; reindex with the configured provider');
    }
    const queryVector = await provider.embed(query);
    if (queryVector.length !== dimensions || queryVector.some((value) => !Number.isFinite(value))) {
      throw new Error('Embedding provider returned an invalid query vector');
    }
    const files = new Map(snapshot.files.map((file) => [file.path, file]));
    const chunks = new Map(snapshot.chunks.map((chunk) => [chunk.id, chunk]));
    return snapshot.vectors.flatMap((vector) => {
      const chunk = chunks.get(vector.chunkId);
      const file = chunk ? files.get(chunk.filePath) : undefined;
      return file && chunk ? [{ file, chunk, score: cosineSimilarity(queryVector, vector.values) }] : [];
    }).sort((left, right) => right.score - left.score).slice(0, limit);
  }

  async hybridSearch(query: string, limit = 10): Promise<Array<{ file: FileRecord; score: number }>> {
    const lexical = await this.search(query, limit * 2);
    if (!this.options.embeddingProvider) return lexical.slice(0, limit);
    const semantic = await this.semanticSearch(query, limit * 2);
    const maximumLexical = Math.max(1, ...lexical.map((result) => result.score));
    const combined = new Map<string, { file: FileRecord; score: number }>();
    for (const result of lexical) combined.set(result.file.path, { file: result.file, score: result.score / maximumLexical * 0.5 });
    for (const result of semantic) {
      const existing = combined.get(result.file.path);
      const score = (result.score + 1) / 2 * 0.5;
      combined.set(result.file.path, { file: result.file, score: (existing?.score ?? 0) + score });
    }
    return [...combined.values()].sort((left, right) => right.score - left.score).slice(0, limit);
  }

  async status(): Promise<{ indexed: boolean; snapshot?: IndexSnapshot; size?: number }> {
    try {
      const [snapshot, fileStats] = await Promise.all([this.read(), stat(this.indexPath)]);
      return { indexed: true, snapshot, size: fileStats.size };
    } catch (error) {
      if (isMissingFile(error)) return { indexed: false };
      throw error;
    }
  }
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function resolveRelations(relations: RelationRecord[], symbols: SymbolRecord[]): void {
  const byName = new Map<string, SymbolRecord[]>();
  for (const symbol of symbols) {
    const names = new Set<string>([symbol.name, normalizeRelationTarget(symbol.name), normalizeRelationTarget(symbol.filePath), symbol.filePath.split('/').at(-1)?.replace(/\.[^/.]+$/u, '') ?? '']);
    for (const name of names) {
      if (!name) continue;
      byName.set(name, [...(byName.get(name) ?? []), symbol]);
    }
  }
  for (let index = 0; index < relations.length; index++) {
    const relation = relations[index]!;
    const candidates = new Set<SymbolRecord>();
    for (const candidateName of relationTargetCandidates(relation.targetName)) {
      for (const candidate of byName.get(candidateName) ?? []) candidates.add(candidate);
    }
    const local = [...candidates].find((candidate) => candidate.filePath === relation.filePath);
    const target = local ?? [...candidates][0];
    if (target) relations[index] = { ...relation, toSymbolId: target.id, confidence: local ? 0.9 : 0.72 };
  }
}

function relationTargetCandidates(targetName: string): string[] {
  const normalized = normalizeRelationTarget(targetName);
  const values = new Set<string>([targetName, normalized]);
  const split = targetName.split(/[\/]/u).filter(Boolean);
  for (const part of split) {
    const cleaned = normalizeRelationTarget(part);
    if (cleaned) values.add(cleaned);
  }
  if (normalized) values.add(normalized.replace(/\.[^/.]+$/u, ''));
  return [...values].filter(Boolean);
}

function normalizeRelationTarget(value: string): string {
  return value
    .replace(/^['"]|['"]$/gu, '')
    .replace(/^\.?\.?\//u, '')
    .replace(/^[A-Za-z]+:/u, '')
    .replace(/[?#].*$/u, '')
    .replace(/\/index$/u, '')
    .replace(/\.[a-z0-9]+$/iu, '')
    .split(/[\\/]+/u).filter(Boolean).at(-1) ?? value
    .replace(/^['"]|['"]$/gu, '');
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length) return -1;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index++) {
    dot += left[index]! * right[index]!;
    leftMagnitude += left[index]! ** 2;
    rightMagnitude += right[index]! ** 2;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}